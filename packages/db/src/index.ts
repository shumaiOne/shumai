import { PrismaClient, WorkflowTask } from './generated/prisma/client'
import { PrismaTestingHelper } from './prisma-testing-helper'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { generateNgrams } from './utils/ngram'

// Global callback for workflow task creation (decouples db package from workflow engine)
type WorkflowTriggerCallback = (task: WorkflowTask) => Promise<void>
let onWorkflowTaskCreated: WorkflowTriggerCallback | null = null

export function registerWorkflowTrigger(cb: WorkflowTriggerCallback) {
  onWorkflowTaskCreated = cb
}

const isTest = process.env.NODE_ENV === 'test'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prismaTestingHelper: PrismaTestingHelper<any> | null = null

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter, log: ['error'] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function touchProjectsByAssetWhere(assetWhere: any) {
    if (!assetWhere) return
    client.project
      .updateMany({
        where: { assets: { some: assetWhere } },
        data: { updatedAt: new Date() },
      })
      .catch((e) => console.error('Failed to touch project updatedAt by asset where', e))
  }

  function touchProjectById(projectId: string) {
    if (!projectId) return
    client.project
      .updateMany({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      })
      .catch((e) => console.error('Failed to touch project updatedAt by id', e))
  }

  return client.$extends({
    query: {
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
          const result = await query(args)
          // Use any here because result and args.data are complex Prisma types in extensions
          const projectId =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any)?.projectId ||
            args.data?.projectId ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (args.data?.project as any)?.connect?.id
          if (projectId) {
            touchProjectById(projectId)
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any)?.id
          ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            touchProjectsByAssetWhere({ id: (result as any).id })
          }
          return result
        },
        async update({ args, query }) {
          if (typeof args.data.name === 'string') {
            args.data.nameNgram = generateNgrams(args.data.name)
          }
          const result = await query(args)
          if (args.where) {
            touchProjectsByAssetWhere(args.where)
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
          const result = await query(args)
          if (args.where) {
            touchProjectsByAssetWhere(args.where)
          }
          return result
        },
        async updateMany({ args, query }) {
          if (typeof args.data.name === 'string') {
            args.data.nameNgram = generateNgrams(args.data.name)
          }
          const result = await query(args)
          if (args.where) {
            touchProjectsByAssetWhere(args.where)
          }
          return result
        },
        async createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              if (typeof item.name === 'string') {
                item.nameNgram = generateNgrams(item.name)
              }
            }
          }
          const result = await query(args)
          const projectIds = new Set<string>()
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              if (item.projectId) projectIds.add(item.projectId)
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } else if ((args.data as any)?.projectId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            projectIds.add((args.data as any).projectId)
          }

          if (projectIds.size > 0) {
            client.project
              .updateMany({
                where: { id: { in: Array.from(projectIds) } },
                data: { updatedAt: new Date() },
              })
              .catch((e) => console.error('Failed to touch projects by createMany', e))
          }
          return result
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

export * from './utils/ngram'
export * from './generated/prisma/client'
