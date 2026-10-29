import type { Prisma } from '@shumai/db'
import { auth } from '@shumai/core/src/auth/auth'
import { Hono } from 'hono'
import agentRoute from './agent'
import chatRoute from './chat'
import attachmentRoute from './attachment'
import authnRoute from './authn'
import collectionRoute from './collection'
import fileRoute from './file'
import folderRoute from './folder'
import inviteRoute from './invite'
import metadataRoute from './metadata'
import mcpRoute, { mcpOauthCallbackRoute } from './mcp'
import { authMiddleware } from './middleware/auth'
import { requireApiTokenMiddleware, tokenAuthMiddleware } from './middleware/tokenAuth'
import mcpServerRoute from './mcp-server'
import notificationRoute from './notification'
import operationsRoute from './operations'
import projectRoute from './project'
import providerRoute from './provider'
import publicInviteRoute from './public-invite'
import publicShareRoute from './public-share'
import s3Route from './s3'
import shareRoute from './share'
import skillRoute from './skill'
import watermarkTemplateRoute from './watermark-template'
import quotaRoute from './quota'
import teamRoute from './team'
import uploadRoute, { localUploadRoute } from './upload'
import versionStackRoute from './versionStack'
import kanbanRoute from './kanban'
import mediaGenerationRoute from './media-generation'

type User = Prisma.UserGetPayload<Record<string, never>>

export const app = new Hono()

const apiRoute = new Hono<{ Variables: { user: User } }>()
  // Public Routes
  .route('/', authnRoute)
  .route('/', publicInviteRoute)
  .route('/', publicShareRoute)
  .route('/', localUploadRoute)
  .route('/', mcpOauthCallbackRoute)

  // Programmatic endpoint for the CLI: API token required, session cookies not accepted
  .use('/ops/*', requireApiTokenMiddleware)
  .route('/', operationsRoute)

  // Selected routes supporting API token authentication
  .use('/projects', tokenAuthMiddleware)
  .use('/projects/*', tokenAuthMiddleware)
  .use('/folders', tokenAuthMiddleware)
  .use('/folders/*', tokenAuthMiddleware)
  .use('/files', tokenAuthMiddleware)
  .use('/files/*', tokenAuthMiddleware)
  .use('/teams/:teamId/upload/tasks', tokenAuthMiddleware)
  .use('/teams/:teamId/upload/tasks/*', tokenAuthMiddleware)

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
  .route('/', chatRoute)
  .route('/', attachmentRoute)
  .route('/', uploadRoute)
  .route('/', shareRoute)
  .route('/', skillRoute)
  .route('/', mcpRoute)
  .route('/', watermarkTemplateRoute)
  .route('/', quotaRoute)
  .route('/', kanbanRoute)
  .route('/', mediaGenerationRoute)

// RFC 8414 & RFC 9728 OAuth discovery endpoints
app.on(['GET', 'HEAD', 'OPTIONS'], '/.well-known/*', (c) => auth.handler(c.req.raw))

// Shumai's MCP server lives at the root (`/mcp`), next to the API rather than inside it, so
// it can also be served from a dedicated host (e.g. `https://mcp.example.com/mcp`). It supports
// both static API tokens and OAuth 2.1 authentication. The `/api/mcp/servers` routes are a separate
// feature: external MCP servers that Shumai's own agent connects to.
app.route('/', mcpServerRoute)

app.route('/files', s3Route)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const apiAppRoute = app.route('/api', apiRoute)

export type AppType = typeof apiAppRoute

export default app
