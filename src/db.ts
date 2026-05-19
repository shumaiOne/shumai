import { PrismaClient } from '@/generated/prisma/client'
import { PrismaTestingHelper } from '@/test-utils'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { generateNgrams } from '@/utils/ngram'

const isTest = process.env.NODE_ENV === 'test'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// We use any here because PrismaTestingHelper is generic and the extended client type is complex
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
          // Lazy load workflowService to avoid circular dependency
          import('@/workflow/workflow').then((mod) => {
            const service = mod?.workflowService
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const task = result as any
            if (service && task.status === 'pending') {
              // result is the created task, but the extension types are complex
              service.submit(task).catch(console.error)
            }
          })
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
