import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient, WorkflowTask } from './generated/prisma/client'
import { PrismaTestingHelper } from './prisma-testing-helper'
import { generateNgrams } from './utils/ngram'

// Ensure BigInt serializes to JSON number gracefully for DBOS/HTTP payloads
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(BigInt.prototype as any).toJSON = function () {
  return Number(this)
}

// Global callback for workflow task creation (decouples db package from workflow engine)
type WorkflowTriggerCallback = (task: WorkflowTask) => Promise<void>
let onWorkflowTaskCreated: WorkflowTriggerCallback | null = null

export function registerWorkflowTrigger(cb: WorkflowTriggerCallback) {
  onWorkflowTaskCreated = cb
}

// Global callback for workflow task cancellation (decouples db/core packages from workflow engine)
type WorkflowCancelCallback = (taskId: string) => Promise<void>
let onWorkflowTaskCancelled: WorkflowCancelCallback | null = null

export function registerWorkflowCancel(cb: WorkflowCancelCallback) {
  onWorkflowTaskCancelled = cb
}

export async function cancelWorkflowTask(taskId: string): Promise<void> {
  if (onWorkflowTaskCancelled) {
    await onWorkflowTaskCancelled(taskId)
  }
}

const isTest = process.env.NODE_ENV === 'test'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prismaTestingHelper: PrismaTestingHelper<any> | null = null

function sanitizeArrayFields<T>(data: T): T {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const arrayFields = [
      'scopes',
      'allowedScopes',
      'resources',
      'requestedUserInfoClaims',
      'contacts',
      'redirectUris',
      'postLogoutRedirectUris',
      'grantTypes',
      'responseTypes',
    ]
    for (const field of arrayFields) {
      if (record[field] === null) {
        record[field] = []
      }
    }
  }
  return data
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter, log: ['error'] })

  return client.$extends({
    query: {
      oauthResource: {
        async create({ args, query }) {
          sanitizeArrayFields(args.data)
          try {
            return await query(args)
          } catch (e: unknown) {
            if (
              e &&
              typeof e === 'object' &&
              'code' in e &&
              e.code === 'P2002' &&
              args.data.identifier
            ) {
              const existing = await client.oauthResource.findUnique({
                where: { identifier: args.data.identifier },
              })
              if (existing) return existing
            }
            throw e
          }
        },
        async update({ args, query }) {
          sanitizeArrayFields(args.data)
          return query(args)
        },
        async upsert({ args, query }) {
          sanitizeArrayFields(args.create)
          sanitizeArrayFields(args.update)
          return query(args)
        },
        async findUnique({ args, query }) {
          const result = await query(args)
          if (result && Array.isArray(result.allowedScopes) && result.allowedScopes.length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(result as any).allowedScopes = null
          }
          return result
        },
        async findFirst({ args, query }) {
          const result = await query(args)
          if (result && Array.isArray(result.allowedScopes) && result.allowedScopes.length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(result as any).allowedScopes = null
          }
          return result
        },
        async findMany({ args, query }) {
          const results = await query(args)
          if (Array.isArray(results)) {
            for (const r of results) {
              if (r && Array.isArray(r.allowedScopes) && r.allowedScopes.length === 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(r as any).allowedScopes = null
              }
            }
          }
          return results
        },
      },
      oauthClient: {
        async create({ args, query }) {
          sanitizeArrayFields(args.data)
          return query(args)
        },
        async update({ args, query }) {
          sanitizeArrayFields(args.data)
          return query(args)
        },
        async upsert({ args, query }) {
          sanitizeArrayFields(args.create)
          sanitizeArrayFields(args.update)
          return query(args)
        },
      },
      workflowTask: {
        async create({ args, query }) {
          const result = await query(args)
          if (onWorkflowTaskCreated && (result as WorkflowTask).status === 'pending') {
            onWorkflowTaskCreated(result as WorkflowTask).catch(console.error)
          }
          return result
        },
      },
      asset: {
        async create({ args, query }) {
          if (typeof args.data.name === 'string') {
            args.data.nameNgram = generateNgrams(args.data.name)
          }
          return query(args)
        },
        async update({ args, query }) {
          if (typeof args.data.name === 'string') {
            args.data.nameNgram = generateNgrams(args.data.name)
          }
          const result = await query(args)
          if (args.where) {
            await client.project.updateMany({
              where: { assets: { some: args.where } },
              data: { updatedAt: new Date() },
            })
          }
          return result
        },
        async upsert({ args, query }) {
          if (typeof args.create.name === 'string') {
            args.create.nameNgram = generateNgrams(args.create.name)
          }
          if (typeof args.update.name === 'string') {
            args.update.nameNgram = generateNgrams(args.update.name)
          }
          return query(args)
        },
        async updateMany({ args, query }) {
          if (typeof args.data.name === 'string') {
            args.data.nameNgram = generateNgrams(args.data.name)
          }
          return query(args)
        },
        async createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              if (typeof item.name === 'string') {
                item.nameNgram = generateNgrams(item.name)
              }
            }
          }
          return query(args)
        },
      },
    },
  })
}

export const prisma = (isTest
  ? getPrismaTestingHelper().getProxyClient()
  : (globalForPrisma.prisma ?? createPrismaClient())) as unknown as PrismaClient

if (!isTest && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export function getPrismaTestingHelper() {
  if (!prismaTestingHelper) {
    prismaTestingHelper = new PrismaTestingHelper(createPrismaClient())
  }
  return prismaTestingHelper
}

export * from './generated/prisma/client'
export * from './utils/ngram'
