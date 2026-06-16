import type { Prisma } from '@shumai/db'
import { Hono } from 'hono'
import agentRoute from './agent'
import attachmentRoute from './attachment'
import authnRoute from './authn'
import collectionRoute from './collection'
import fileRoute from './file'
import folderRoute from './folder'
import inviteRoute from './invite'
import metadataRoute from './metadata'
import { authMiddleware } from './middleware/auth'
import notificationRoute from './notification'
import projectRoute from './project'
import providerRoute from './provider'
import publicInviteRoute from './public-invite'
import publicShareRoute from './public-share'
import s3Route from './s3'
import shareRoute from './share'
import skillRoute from './skill'
import teamRoute from './team'
import uploadRoute from './upload'
import versionStackRoute from './versionStack'

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
