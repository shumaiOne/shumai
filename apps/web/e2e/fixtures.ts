import { test as base } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { PrismaClient } from '../../../packages/db/src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import {
  E2E_APP_URL,
  E2E_PASSWORD,
  apiSignup,
  injectAuthState,
  resolveTeamId,
  uniqueEmail,
} from './helpers/auth'
import { apiCreateProject, uniqueProjectName } from './helpers/project'
import { apiUploadFile } from './helpers/files'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(currentDir, '.env.e2e')
const fixturesDir = path.resolve(currentDir, '../../../packages/e2e/fixtures')

function loadEnv() {
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
}

// Load E2E environment variables if present
loadEnv()

export interface OwnerFixture {
  /** Page opened in a browser context logged in as the team owner. */
  page: Page
  context: BrowserContext
  teamId: string
  email: string
  password: string
}

export interface ProjectFixture extends OwnerFixture {
  projectId: string
  projectName: string
  /** The project's root folder asset id. */
  rootFolderId: string
}

/** The media kind of a seeded test file. */
export type FileMediaType = 'text' | 'binary' | 'image' | 'video' | 'pdf' | 'audio'

export interface FileFixtureOptions {
  /** Defaults to `binary` (no extension, never transcoded, no proxy). */
  mediaType?: FileMediaType
}

export interface FileFixture extends ProjectFixture {
  fileId: string
  fileName: string
  fileMediaType: FileMediaType
}

const FILE_TYPE_MAP: Record<FileMediaType, { ext: string; mime: string }> = {
  text: { ext: 'txt', mime: 'text/plain' },
  binary: { ext: '', mime: 'application/octet-stream' },
  image: { ext: 'png', mime: 'image/png' },
  video: { ext: 'mp4', mime: 'video/mp4' },
  pdf: { ext: 'pdf', mime: 'application/pdf' },
  audio: { ext: 'wav', mime: 'audio/wav' },
}

function getFileBuffer(mediaType: FileMediaType): Buffer {
  switch (mediaType) {
    case 'image':
      return fs.readFileSync(path.join(fixturesDir, 'small.png'))
    case 'video':
      return fs.readFileSync(path.join(fixturesDir, 'small.mp4'))
    case 'audio':
      return fs.readFileSync(path.join(fixturesDir, 'small.wav'))
    case 'pdf':
      return fs.readFileSync(path.join(fixturesDir, 'test.pdf'))
    case 'text':
      return Buffer.from(
        'Sample text content for PDF proxy transcode test.\nSecond line of text content.',
      )
    case 'binary':
    default:
      return Buffer.from('binary-file-content-sample')
  }
}

export const test = base.extend<{
  prisma: PrismaClient
  owner: OwnerFixture
  project: ProjectFixture
  fileOptions: FileFixtureOptions
  file: FileFixture
}>({
  fileOptions: [{ mediaType: 'binary' }, { option: true }],
  prisma: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      loadEnv()
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
  /**
   * Sets up an authenticated team owner through the API (fast, no UI): creates
   * the user, stores the session cookie in the browser context, injects the
   * persisted auth state, and opens the team page.
   */
  owner: async ({ browser }, use) => {
    const context = await browser.newContext({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      baseURL: E2E_APP_URL,
    })
    const email = uniqueEmail('owner')
    const password = E2E_PASSWORD
    try {
      // Create the owner via the API so the session cookie lands in the context
      const user = await apiSignup(context.request, email, password)
      await injectAuthState(context, user)
      const teamId = await resolveTeamId(context.request)

      // Open the app already logged in on the team page
      const page = await context.newPage()
      await page.goto(`/teams/${teamId}`)

      await use({ page, context, teamId, email, password })
    } finally {
      await context.close()
    }
  },
  /** Sets up an authenticated team owner plus a project created via the API. */
  project: async ({ owner, prisma }, use) => {
    const name = uniqueProjectName()
    const project = await apiCreateProject(owner.context.request, owner.teamId, name)
    const projectRow = await prisma.project.findUnique({ where: { id: project.id } })
    const rootFolderId = projectRow?.rootFolderId
    if (!rootFolderId) throw new Error('Project has no root folder')
    await use({ ...owner, projectId: project.id, projectName: name, rootFolderId })
  },
  /**
   * Sets up an owner + project with an uploaded file asset under the
   * project root folder via the API upload task endpoints. The media type is configurable per test via
   * `fileOptions` (defaults to `binary`).
   */
  file: async ({ project, fileOptions }, use) => {
    const mediaType: FileMediaType = fileOptions.mediaType ?? 'binary'
    const { ext, mime } = FILE_TYPE_MAP[mediaType]
    const fileName = `test-file-${Date.now()}${ext ? `.${ext}` : ''}`
    const buffer = getFileBuffer(mediaType)

    const uploaded = await apiUploadFile(
      project.context.request,
      project.teamId,
      project.rootFolderId,
      fileName,
      mime,
      buffer,
    )

    await use({ ...project, fileId: uploaded.fileId, fileName, fileMediaType: mediaType })
  },
})

export { expect } from '@playwright/test'
