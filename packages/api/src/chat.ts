import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamSSE } from 'hono/streaming'
import { prisma } from '@shumai/db'
import { chatService, mapEntryToMessage } from '@shumai/core/src/chat/chat'
import { chatRequestSchema, paginationParamsSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/chat/sessions', zValidator('query', paginationParamsSchema), async (c) => {
    const user = c.get('user')
    const query = c.req.valid('query')

    const res = await chatService.listSessions(user.id, query)
    return c.json(res, 200)
  })
  .get('/chat/sessions/:sessionId/messages', async (c) => {
    const user = c.get('user')
    const sessionId = c.req.param('sessionId')

    const res = await chatService.listMessages(user.id, sessionId)
    return c.json(res, 200)
  })
  .delete('/chat/sessions/:sessionId', async (c) => {
    const user = c.get('user')
    const sessionId = c.req.param('sessionId')

    await chatService.deleteSession(user.id, sessionId)
    return new Response(null, { status: 204 })
  })
  .post('/chat', zValidator('json', chatRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    const { sessionId, taskId } = await chatService.startOrContinueChat(user, req)

    return streamSSE(c, async (stream) => {
      // Send session info immediately at the start of the stream
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'session',
          sessionId,
          taskId,
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
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'entry',
                entry: message,
              }),
            })
          }
          lastEntryId = newEntries[newEntries.length - 1].id
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

export default route
