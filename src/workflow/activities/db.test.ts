import { describe, it, expect } from 'vitest'
import { setupTestDbHooks } from '@/db-test-hooks'
import { prisma } from '@/db'
import {
  createCommentActivity,
  updateCommentActivity,
  deleteCommentActivity,
  initializeAgentSessionActivity,
} from './db'
import type { SessionTreeEntry } from '@earendil-works/pi-agent-core'

describe('Database Activities', () => {
  setupTestDbHooks()

  it('should support comment CRUD activities (create, update, delete)', async () => {
    const team = await prisma.team.create({ data: { name: 't1' } })
    const user = await prisma.user.create({
      data: { name: 'User One', email: 'user1@example.com' },
    })
    const project = await prisma.project.create({
      data: { name: 'p1', teamId: team.id },
    })
    const file = await prisma.asset.create({
      data: {
        name: 'test-file',
        type: 'file',
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    // 1. Create Comment
    const comment = await createCommentActivity({
      assetId: file.id,
      message: 'Initial comment',
    })
    expect(comment.id).toBeDefined()
    expect(comment.message).toBe('Initial comment')

    // 2. Update Comment
    const updated = await updateCommentActivity({
      commentId: comment.id,
      message: 'Updated comment',
    })
    expect(updated.message).toBe('Updated comment')

    // 3. Delete Comment
    await deleteCommentActivity(comment.id)
    const found = await prisma.assetComment.findUnique({
      where: { id: comment.id },
    })
    expect(found).toBeNull()
  })

  it('should support multiple comments in the same session without violating unique session_id constraint', async () => {
    const team = await prisma.team.create({ data: { name: 't2' } })
    const user = await prisma.user.create({
      data: { name: 'User Two', email: 'user2@example.com' },
    })
    const project = await prisma.project.create({
      data: { name: 'p2', teamId: team.id },
    })
    const file = await prisma.asset.create({
      data: {
        name: 'test-file-2',
        type: 'file',
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    const sessionId = 'test-multi-comment-session'

    // 1. Create first agent comment in the session
    const c1 = await createCommentActivity({
      assetId: file.id,
      message: 'Agent comment 1',
      sessionId,
      agentId: 'default',
    })
    expect(c1.id).toBeDefined()
    expect(c1.sessionId).toBe(sessionId)

    // 2. Create second agent comment in the SAME session
    const c2 = await createCommentActivity({
      assetId: file.id,
      message: 'Agent comment 2',
      sessionId,
      agentId: 'default',
    })
    expect(c2.id).toBeDefined()
    expect(c2.sessionId).toBe(sessionId)
  })

  it('should initialize a new session with chronological context, prefixed usernames, and resolved user mentions', async () => {
    const team = await prisma.team.create({ data: { name: 't1' } })
    const user1 = await prisma.user.create({
      data: { name: 'User One', email: 'user1@example.com' },
    })
    const user2 = await prisma.user.create({
      data: { name: 'Matt', email: 'matt@example.com' },
    })
    const agentUser = await prisma.user.create({
      data: { id: 'agent-user-id', name: 'Smart Agent', email: 'agent@example.com', type: 'agent' },
    })
    const project = await prisma.project.create({
      data: { name: 'p1', teamId: team.id },
    })
    const file = await prisma.asset.create({
      data: {
        name: 'test-file',
        type: 'file',
        projectId: project.id,
        creatorId: user1.id,
        status: 'uploaded',
      },
    })

    // Create existing comment 1 (User mentioning user2)
    const comment1 = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: user1.id,
        message: `First comment message for <@${user2.id}>`,
      },
    })

    // Create existing comment 1.5 (Agent)
    const commentAgent = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: agentUser.id,
        message: 'I am helping',
      },
    })

    // Create triggering comment 2 (Rule 1: no reply, mentions agent)
    const comment2 = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: user1.id,
        message: 'Hello <@agent-user-id>',
      },
    })

    const sessionId = await initializeAgentSessionActivity({
      teamId: team.id,
      agentId: 'agent-user-id',
      userCommentId: comment2.id,
      userId: user1.id,
    })

    expect(sessionId).toBeDefined()

    // Verify session entries were populated with comment1 and commentAgent as context
    const entries = await prisma.agentSessionEntry.findMany({
      where: { sessionId },
      orderBy: { id: 'asc' },
    })

    expect(entries.length).toBe(2)

    // Verify User Comment Entry with resolved mention and username prefix
    const entryData1 = entries[0].entry as unknown as SessionTreeEntry
    expect(entryData1.id).toBeDefined()
    expect(entryData1.id).not.toBe(comment1.id)
    if (entryData1.type === 'message') {
      const msg = entryData1.message as { role: 'user'; content: { type: 'text'; text: string }[] }
      expect(msg.content[0].text).toBe('[User One]: First comment message for <@Matt>')
      expect(msg.role).toBe('user')
    } else {
      throw new Error('Expected entry to be a message')
    }

    // Verify Agent Comment Entry
    const entryData2 = entries[1].entry as unknown as SessionTreeEntry
    expect(entryData2.id).toBeDefined()
    expect(entryData2.id).not.toBe(commentAgent.id)
    if (entryData2.type === 'message') {
      const msg = entryData2.message as { role: 'user'; content: { type: 'text'; text: string }[] }
      expect(msg.content[0].text).toBe('[Agent Message][Smart Agent]: I am helping')
      expect(msg.role).toBe('user')
    } else {
      throw new Error('Expected entry to be a message')
    }
  })
})
