import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamSSE } from 'hono/streaming'
import { prisma } from '@shumai/db'
import { chatService, mapEntryToMessage } from '@shumai/core/src/chat/chat'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { chatRequestSchema, paginationParamsSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { workflowService } from '@shumai/workflow-core'

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
        // Query new entries from the DB
        const newEntries = await prisma.agentSessionEntry.findMany({
          where: {
            sessionId,
            ...(lastEntryId ? { id: { gt: lastEntryId } } : {}),
          },
          orderBy: { id: 'asc' },
        })

        if (newEntries.length > 0) {
          for (const record of newEntries) {
            const message = mapEntryToMessage(record)
            if (!message) continue
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'entry',
                entry: message,
              }),
            })
          }
          lastEntryId = newEntries[newEntries.length - 1].id
        } else {
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'ping',
            }),
          })
        }

        // Check if workflow has finished
        const task = await prisma.workflowTask.findUnique({
          where: { id: taskId },
          select: { status: true, output: true },
        })

        if (task && (task.status === 'completed' || task.status === 'failed')) {
          // Fetch any remaining entries one last time
          const finalEntries = await prisma.agentSessionEntry.findMany({
            where: {
              sessionId,
              ...(lastEntryId ? { id: { gt: lastEntryId } } : {}),
            },
            orderBy: { id: 'asc' },
          })
          for (const record of finalEntries) {
            const message = mapEntryToMessage(record)
            if (!message) continue
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'entry',
                entry: message,
              }),
            })
          }

          // Send done status
          const output = task.output as Record<string, unknown> | null
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

    const taskToAbort = await prisma.workflowTask.findFirst({
      where: {
        status: { in: ['pending', 'processing'] },
        type: 'chat',
        sessionId,
      },
    })

    if (!taskToAbort) {
      return c.json({ error: 'No active execution found for this session' }, 404)
    }

    await workflowService.cancel(taskToAbort.id)

    await prisma.workflowTask.update({
      where: { id: taskToAbort.id },
      data: {
        status: 'failed',
        output: { error: 'aborted' },
      },
    })

    return c.json({ success: true }, 200)
  })

export default route
