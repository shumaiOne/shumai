import { defineConfig } from 'prisma/config'
import { loadEnvConfig } from './packages/core/src/env-loader'

loadEnvConfig(process.cwd())

export default defineConfig({
  schema: 'packages/db/prisma/schema.prisma',
  migrations: {
    path: 'packages/db/prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
