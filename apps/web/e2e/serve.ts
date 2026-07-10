import { globalTestSetup } from '../../../packages/db/src/test-global-setup'
import { randomBytes } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

async function start() {
  console.log('Starting E2E test database container...')
  await globalTestSetup()

  // Generate a random S3 bucket name
  const randomSuffix = randomBytes(4).toString('hex')
  const bucketName = `shumai-e2e-${randomSuffix}`

  process.env.S3_BUCKET = bucketName
  process.env.SHUMAI_SERVER_PORT = '5200'
  process.env.BETTER_AUTH_URL = 'http://localhost:5200'
  process.env.NODE_ENV = 'development'
  process.env.SHUMAI_E2E = 'true'

  // Write variables to .env.e2e file so the teardown can load them
  const envContent = [`DATABASE_URL=${process.env.DATABASE_URL}`, `S3_BUCKET=${bucketName}`].join(
    '\n',
  )

  fs.writeFileSync(path.resolve(currentDir, '.env.e2e'), envContent)
  console.log(`E2E env file written. Starting Web App...`)

  // Now run the web app
  await import('../src/index.ts')
}

start().catch(console.error)
