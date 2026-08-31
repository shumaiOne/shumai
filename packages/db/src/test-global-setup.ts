import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

let dbContainer: import('@testcontainers/postgresql').StartedPostgreSqlContainer

export async function globalTestSetup() {
  console.log('Starting Testcontainers for global setup...')
  dbContainer = await new PostgreSqlContainer('pgvector/pgvector:pg18').start()

  const databaseUrl = dbContainer.getConnectionUri()
  console.log('Database started at:', databaseUrl)

  process.env.DATABASE_URL = databaseUrl

  console.log('Applying Prisma Migrations...')
  await execAsync('bun run prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  })
  console.log('Prisma Migrations completed.')
}

export async function setup() {
  await globalTestSetup()
}

export async function teardown() {
  await dbContainer?.stop()
}
