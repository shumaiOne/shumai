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
}

/** The media kind of a seeded test file. */
export type FileMediaType = 'text' | 'binary' | 'image' | 'video' | 'pdf'

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
  project: async ({ owner }, use) => {
    const name = uniqueProjectName()
    const project = await apiCreateProject(owner.context.request, owner.teamId, name)
    await use({ ...owner, projectId: project.id, projectName: name })
  },
  /**
   * Sets up an owner + project with a seeded processed file asset under the
   * project root folder. The media type is configurable per test via
   * `fileOptions` (defaults to `binary`).
   */
  file: async ({ project, prisma, fileOptions }, use) => {
    const mediaType: FileMediaType = fileOptions.mediaType ?? 'binary'
    const { ext, mime } = FILE_TYPE_MAP[mediaType]
    const fileName = `test-file-${Date.now()}${ext ? `.${ext}` : ''}`

    const projectRow = await prisma.project.findUnique({ where: { id: project.projectId } })
    const rootFolderId = projectRow?.rootFolderId
    if (!rootFolderId) throw new Error('Project has no root folder')

    const file = await prisma.asset.create({
      data: {
        name: fileName,
        type: 'file',
        status: 'processed',
        sizeByte: 10,
        mediaType: mime,
        projectId: project.projectId,
        parentId: rootFolderId,
      },
    })

    await use({ ...project, fileId: file.id, fileName, fileMediaType: mediaType })
  },
})

export { expect } from '@playwright/test'
