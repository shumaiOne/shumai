import { test as base } from '@playwright/test'
import { PrismaClient } from '../../../packages/db/src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(currentDir, '.env.e2e')

// Load E2E environment variables if present
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const parts = line.split('=')
    if (parts.length >= 2) {
      const key = parts[0].trim()
      const value = parts.slice(1).join('=').trim()
      process.env[key] = value
    }
  })
}

export const test = base.extend<{ prisma: PrismaClient }>({
  prisma: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const connectionString = process.env.DATABASE_URL
      const pool = new Pool({ connectionString })
      const adapter = new PrismaPg(pool)
      const prisma = new PrismaClient({ adapter })

      // Reset database state before the test runs
      await prisma.$executeRawUnsafe(`
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') LOOP
              EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE;';
          END LOOP;
      END $$;
    `)

      // Provide the clean prisma instance to the test
      await use(prisma)

      // Disconnect and clean up resources after the test finishes
      await prisma.$disconnect()
      await pool.end()
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
