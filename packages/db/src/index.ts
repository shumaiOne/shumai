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
          return query(args)
        },
        async update({ args, query }) {
          if (typeof args.data.name === 'string') {
            args.data.nameNgram = generateNgrams(args.data.name)
          }
          return query(args)
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

export * from './utils/ngram'
export * from './generated/prisma/client'
