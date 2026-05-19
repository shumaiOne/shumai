import index from '@/ui/index.html'

import type { Prisma } from '@/generated/prisma/client'
import { Hono } from 'hono'
import agentRoute from '@/api/agent'
import attachmentRoute from '@/api/attachment'
import authnRoute from '@/api/authn'
import fileRoute from '@/api/file'
import folderRoute from '@/api/folder'
import inviteRoute from '@/api/invite'
import metadataRoute from '@/api/metadata'
import { authMiddleware } from '@/api/middleware/auth'
import notificationRoute from '@/api/notification'
import projectRoute from '@/api/project'
import providerRoute from '@/api/provider'
import publicInviteRoute from '@/api/public-invite'
import publicShareRoute from '@/api/public-share'
import s3Route from '@/api/s3'
import shareRoute from '@/api/share'
import skillRoute from '@/api/skill'
import teamRoute from '@/api/team'
import uploadRoute from '@/api/upload'
import versionStackRoute from '@/api/versionStack'
import { metadataService } from '@/services/metadata/metadata'
import { workflowService } from '@/workflow/workflow'

type User = Prisma.UserGetPayload<Record<string, never>>

const app = new Hono()

const apiRoute = new Hono<{ Variables: { user: User } }>()
  // Public Routes
  .route('/', authnRoute)
  .route('/', publicInviteRoute)
  .route('/', publicShareRoute)

  // Protected Routes
  .use('*', authMiddleware)
  .route('/', inviteRoute)
  .route('/', providerRoute)
  .route('/', notificationRoute)
  .route('/', metadataRoute)
  .route('/', projectRoute)
  .route('/', teamRoute)
  .route('/', versionStackRoute)
  .route('/', fileRoute)
  .route('/', folderRoute)
  .route('/', agentRoute)
  .route('/', attachmentRoute)
  .route('/', uploadRoute)
  .route('/', shareRoute)
  .route('/', skillRoute)

app.route('/files', s3Route)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const apiAppRoute = app.route('/api', apiRoute)

export type AppType = typeof apiAppRoute

export async function run() {
  // Start services
  await metadataService.syncSystemFields().catch(console.error)
  workflowService.start()
  if (process.env.WORKFLOW_EXECUTOR === 'temporal') {
    const args = process.argv.slice(2)
    let workersOption = ''
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--workers') {
        workersOption = args[i + 1] || ''
      } else if (args[i].startsWith('--workers=')) {
        workersOption = args[i].split('=')[1]
      }
    }

    const queuesToStart = ['db_queue']
    if (workersOption === 'agent' || workersOption === 'ai') {
      queuesToStart.push('agent_queue')
    } else if (workersOption === 'transcode') {
      queuesToStart.push('transcode_queue')
    } else if (workersOption === 'all') {
      queuesToStart.push('agent_queue', 'transcode_queue')
    }

    Promise.all(queuesToStart.map((q) => workflowService.startWorkers(q))).catch(console.error)
  }

  const server = Bun.serve({
    port: 3000,
    fetch: app.fetch,
    routes: {
      // Serve index.html for root
      '/': index,

      // Proxy API requests to Hono
      '/api/*': app.fetch,
      '/files/*': app.fetch,

      // Catch-all for SPA routing (fallback to index.html)
      '/*': index,
    },
    development: process.env.NODE_ENV !== 'production',
  })

  console.log(`🚀 Server running at ${server.url}`)
}
