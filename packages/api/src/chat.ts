import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamSSE } from 'hono/streaming'
import { chatService } from '@shumai/core/src/chat/chat'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { chatRequestSchema, paginationParamsSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/chat/sessions', zValidator('query', paginationParamsSchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const query = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const res = await chatService.listSessions(user.id, teamId, query)
    return c.json(res, 200)
  })
  .get('/teams/:teamId/chat/sessions/:sessionId/messages', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const sessionId = c.req.param('sessionId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const res = await chatService.listMessages(user.id, teamId, sessionId)
    return c.json(res, 200)
  })
  .delete('/teams/:teamId/chat/sessions/:sessionId', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const sessionId = c.req.param('sessionId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    await chatService.deleteSession(user.id, teamId, sessionId)
    return new Response(null, { status: 204 })
  })
  .post('/teams/:teamId/chat', zValidator('json', chatRequestSchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const { sessionId, taskId } = await chatService.startOrContinueChat(user, teamId, req)

    c.header('x-session-id', sessionId)

    return streamSSE(c, async (stream) => {
      // Send session ID as the first event
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'session',
          sessionId,
        }),
      })

      let lastEntryId = ''
      const timeoutMs = 5 * 60 * 1000 // 5 minutes timeout
      const startTime = Date.now()

      while (Date.now() - startTime < timeoutMs) {
        if (stream.aborted) {
          break
        }
        // Query new entries from the DB via chatService
        const { messages, lastEntryId: newLastId } = await chatService.getNewSessionMessages(
          sessionId,
          lastEntryId || undefined,
        )

        if (messages.length > 0) {
          for (const message of messages) {
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'entry',
                entry: message,
              }),
            })
          }
        } else {
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'ping',
            }),
          })
        }

        if (newLastId) {
          lastEntryId = newLastId
        }

        // Check if workflow has finished via chatService
        const task = await chatService.getChatWorkflowStatus(taskId)

        if (task && (task.status === 'completed' || task.status === 'failed')) {
          // Fetch any remaining entries one last time
          const { messages: finalMessages } = await chatService.getNewSessionMessages(
            sessionId,
            lastEntryId || undefined,
          )
          for (const message of finalMessages) {
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'entry',
                entry: message,
              }),
            })
          }

          // Send done status
          const output = task.output
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'done',
              status: task.status,
              error:
                task.status === 'failed'
                  ? (output?.error as string) || 'Workflow failed'
                  : undefined,
            }),
          })
          break
        }

        // Wait before polling again
        await stream.sleep(1000)
      }

      if (Date.now() - startTime >= timeoutMs) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'done',
            status: 'failed',
            error: 'Request timed out',
          }),
        })
      }
    })
  })
  .post('/teams/:teamId/chat/sessions/:sessionId/abort', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const sessionId = c.req.param('sessionId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    try {
      await chatService.abortSession(user.id, sessionId)
      return c.json({ success: true }, 200)
    } catch (error: unknown) {
      const err = error as Error
      if (
        err.message === 'Session not found' ||
        err.message === 'Unauthorized session access' ||
        err.message === 'No active execution found for this session'
      ) {
        return c.json({ error: err.message }, 404)
      }
      throw error
    }
  })

export default route
