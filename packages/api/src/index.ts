import type { Prisma } from '@shumai/db'
import { Hono } from 'hono'
import agentRoute from './api/agent'
import attachmentRoute from './api/attachment'
import authnRoute from './api/authn'
import collectionRoute from './api/collection'
import fileRoute from './api/file'
import folderRoute from './api/folder'
import inviteRoute from './api/invite'
import metadataRoute from './api/metadata'
import { authMiddleware } from './api/middleware/auth'
import notificationRoute from './api/notification'
import projectRoute from './api/project'
import providerRoute from './api/provider'
import publicInviteRoute from './api/public-invite'
import publicShareRoute from './api/public-share'
import s3Route from './api/s3'
import shareRoute from './api/share'
import skillRoute from './api/skill'
import teamRoute from './api/team'
import uploadRoute from './api/upload'
import versionStackRoute from './api/versionStack'

type User = Prisma.UserGetPayload<Record<string, never>>

export const app = new Hono()

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
  .route('/', collectionRoute)
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

export default app
