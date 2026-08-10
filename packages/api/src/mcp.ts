import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { mcpService } from '@shumai/core/src/mcp/mcp-service'
import {
  createMcpServerRequestSchema,
  updateMcpServerRequestSchema,
  updateMcpServerPermissionRequestSchema,
  mcpAuthCompleteRequestSchema,
  AuditAction,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/mcp/servers', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const servers = await mcpService.listServers(teamId)
    return c.json({ servers })
  })
  .post(
    '/teams/:teamId/mcp/servers',
    zValidator('json', createMcpServerRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const server = await mcpService.createServer(teamId, req)

      await auditLogService.logAction({
        action: AuditAction.mcp_server_create,
        teamId,
        userId: user?.id,
        itemId: server.id,
      })

      return c.json(server)
    },
  )
  .get('/mcp/servers/:id', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    const server = await mcpService.getServer(id)
    if (!server) return c.json({ error: 'MCP server not found' }, 404)
    return c.json(server)
  })
  .patch('/mcp/servers/:id', zValidator('json', updateMcpServerRequestSchema), async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    const existing = await mcpService.getServerRecord(id)
    if (!existing) return c.json({ error: 'MCP server not found' }, 404)

    const server = await mcpService.updateServer(id, req)

    await auditLogService.logAction({
      action: AuditAction.mcp_server_update,
      teamId: existing.teamId,
      userId: user?.id,
      itemId: id,
    })

    return c.json(server)
  })
  .patch(
    '/mcp/servers/:id/permission',
    zValidator('json', updateMcpServerPermissionRequestSchema),
    async (c) => {
      const user = c.get('user')
      const id = c.req.param('id')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.McpServer,
        id,
      })

      const existing = await mcpService.getServerRecord(id)
      if (!existing) return c.json({ error: 'MCP server not found' }, 404)

      const server = await mcpService.updateServerPermission(id, req.permission)

      await auditLogService.logAction({
        action: AuditAction.mcp_server_update,
        teamId: existing.teamId,
        userId: user?.id,
        itemId: id,
      })

      return c.json(server)
    },
  )
  .delete('/mcp/servers/:id', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    const existing = await mcpService.getServerRecord(id)

    await mcpService.deleteServer(id)

    if (existing) {
      await auditLogService.logAction({
        action: AuditAction.mcp_server_delete,
        teamId: existing.teamId,
        userId: user?.id,
        itemId: id,
      })
    }

    return new Response(null, { status: 204 })
  })
  .post('/mcp/servers/:id/tools/refresh', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    try {
      const tools = await mcpService.discoverTools(id)
      return c.json({ tools })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 502)
    }
  })
  .get('/mcp/servers/:id/tools', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    const server = await mcpService.getServer(id)
    if (!server) return c.json({ error: 'MCP server not found' }, 404)
    const record = await mcpService.getServerRecord(id)
    return c.json({ tools: record?.tools ?? [] })
  })
  .post('/mcp/servers/:id/auth/start', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    try {
      const result = await mcpService.startAuth(id)
      if (result.alreadyAuthenticated) {
        return c.json({ status: 'authenticated' })
      }
      return c.json({ authorizationUrl: result.authorizationUrl, status: 'in_progress' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 502)
    }
  })
  .post(
    '/mcp/servers/:id/auth/complete',
    zValidator('json', mcpAuthCompleteRequestSchema),
    async (c) => {
      const user = c.get('user')
      const id = c.req.param('id')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.McpServer,
        id,
      })

      try {
        const status = await mcpService.completeAuth(id, { code: req.code, iss: req.iss })
        return c.json({ status })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ error: message }, 502)
      }
    },
  )
  .get('/mcp/servers/:id/auth/status', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    try {
      const status = await mcpService.getAuthStatus(id)
      return c.json({ status })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 404)
    }
  })
  .delete('/mcp/servers/:id/auth', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    await mcpService.removeAuth(id)
    return new Response(null, { status: 204 })
  })
  .post('/mcp/servers/:id/test', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.McpServer,
      id,
    })

    const result = await mcpService.testServer(id)
    return c.json(result)
  })

export default route

// ---------------------------------------------------------------------------
// Public OAuth callback route (mounted BEFORE authMiddleware in index.ts).
// The OAuth provider redirects the user's browser here after approval.
// ---------------------------------------------------------------------------

function renderCallbackPage(payload: { ok: boolean; message?: string }): string {
  const escaped = JSON.stringify(payload).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>MCP OAuth</title>
</head>
<body>
<script>
  (function () {
    var payload = ${escaped};
    try {
      if (window.opener) {
        window.opener.postMessage({ source: 'shumai-mcp-oauth', payload: payload }, '*');
      }
    } catch (e) {
      /* ignore cross-origin postMessage failures */
    }
    setTimeout(function () {
      window.close();
      document.body.textContent = payload.ok ? 'Authentication complete. You can close this window.' : 'Authentication failed: ' + (payload.message || 'unknown error');
    }, 300);
  })();
</script>
</body>
</html>`
}

export const mcpOauthCallbackRoute = new Hono()
  .get('/mcp/oauth/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const iss = c.req.query('iss') || undefined

    if (!code || !state) {
      return c.html(
        renderCallbackPage({ ok: false, message: 'Missing code or state parameter' }),
        400,
      )
    }

    const result = await mcpService.handleOauthCallback(code, state, iss)
    return c.html(
      renderCallbackPage(result.ok ? { ok: true } : { ok: false, message: result.message }),
    )
  })
  .post('/mcp/oauth/callback', async (c) => {
    const body = await c.req.parseBody()
    const code = typeof body['code'] === 'string' ? body['code'] : undefined
    const state = typeof body['state'] === 'string' ? body['state'] : undefined
    const iss = typeof body['iss'] === 'string' ? body['iss'] : undefined

    if (!code || !state) {
      return c.html(
        renderCallbackPage({ ok: false, message: 'Missing code or state parameter' }),
        400,
      )
    }

    const result = await mcpService.handleOauthCallback(code, state, iss)
    return c.html(
      renderCallbackPage(result.ok ? { ok: true } : { ok: false, message: result.message }),
    )
  })
