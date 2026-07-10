import { teardown as dbTeardown } from '../../../packages/db/src/test-global-setup'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export default async function globalTeardown() {
  const envPath = path.resolve(currentDir, '.env.e2e')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    let bucketName: string | undefined

    content.split('\n').forEach((line) => {
      const parts = line.split('=')
      if (parts.length >= 2 && parts[0].trim() === 'S3_BUCKET') {
        bucketName = parts.slice(1).join('=').trim()
      }
    })

    if (bucketName) {
      const bucketDir = path.resolve('data', bucketName)
      if (fs.existsSync(bucketDir)) {
        console.log(`Cleaning up E2E local storage bucket: ${bucketDir}`)
        fs.rmSync(bucketDir, { recursive: true, force: true })
      }
    }

    // Delete the temp .env.e2e file
    fs.unlinkSync(envPath)
  }

  // Stop pgvector container
  await dbTeardown()
  console.log('Global teardown complete.')
}
