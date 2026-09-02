import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { resolveAnnotationsById } from './annotation-resolver'
import { DatabaseSessionStorage } from '../database-session-storage'
import type { SessionTreeEntry } from '@earendil-works/pi-agent-core'

describe('resolveAnnotationsById', () => {
  setupTestDbHooks()

  beforeEach(() => {
    // DB hooks automatically manage transactions
  })

  it('returns null annotations and null timestamp when annotationId is undefined or empty', async () => {
    const result1 = await resolveAnnotationsById('asset-1', undefined)
    expect(result1).toEqual({ annotations: null, timestamp: null })

    const result2 = await resolveAnnotationsById('asset-1', '')
    expect(result2).toEqual({ annotations: null, timestamp: null })
  })

  it('resolves annotations and timestamp from AssetComment (Comments Mode)', async () => {
    const user = await prisma.user.create({
      data: { name: 'Comment Author', email: 'author@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({
      data: { name: 'Test Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Test Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'video.mp4',
        type: 'file',
        projectId: project.id,
        status: 'uploaded',
      },
    })

    const comment = await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        creatorId: user.id,
        message: 'Look at the highlighted area',
        second: 18.5,
        annotation: [
          {
            type: 'line',
            color: '#ff0000',
            points: [
              [10, 10],
              [50, 50],
            ],
          },
        ],
      },
    })

    const result = await resolveAnnotationsById(asset.id, comment.id)
    expect(result.timestamp).toBe(18.5)
    expect(result.annotations).toEqual([
      {
        type: 'line',
        color: '#ff0000',
        points: [
          [10, 10],
          [50, 50],
        ],
      },
    ])
  })

  it('throws an error when AssetComment belongs to a different asset', async () => {
    const user = await prisma.user.create({
      data: { name: 'Author', email: 'author2@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({
      data: { name: 'Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Project', teamId: team.id },
    })
    const assetA = await prisma.asset.create({
      data: { name: 'videoA.mp4', type: 'file', projectId: project.id, status: 'uploaded' },
    })
    const assetB = await prisma.asset.create({
      data: { name: 'videoB.mp4', type: 'file', projectId: project.id, status: 'uploaded' },
    })

    const commentB = await prisma.assetComment.create({
      data: {
        assetId: assetB.id,
        creatorId: user.id,
        message: 'Comment on B',
        annotation: [
          {
            type: 'box',
            color: '#ff0000',
            points: [
              [0, 0],
              [10, 10],
            ],
          },
        ],
      },
    })

    await expect(resolveAnnotationsById(assetA.id, commentB.id)).rejects.toThrow(
      `Annotation "${commentB.id}" belongs to asset "${assetB.id}", not target asset "${assetA.id}".`,
    )
  })

  it('resolves annotations and timestamp from AgentSessionEntry (1-on-1 Chat Mode)', async () => {
    const user = await prisma.user.create({
      data: { name: 'Chat User', email: 'chatuser@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({
      data: { name: 'Chat Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Chat Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'chat-video.mp4',
        type: 'file',
        projectId: project.id,
        status: 'uploaded',
      },
    })
    const agentUser = await prisma.user.create({
      data: { name: 'Chat Bot User', email: 'bot@example.com', type: 'agent' },
    })
    const agent = await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'test-provider', model: 'test-model' },
      },
    })

    // Create session storage
    const storage = await DatabaseSessionStorage.create({
      agentId: agent.id,
      userId: user.id,
      assetId: asset.id,
    })

    // Set active message context with markup annotations and position
    storage.currentMessageContext = {
      currentAsset: {
        id: asset.id,
        name: asset.name,
        type: 'file',
        path: asset.name,
      },
      position: { type: 'time', seconds: 12.34 },
      annotation: true,
      annotations: [
        {
          type: 'rectangle',
          x: 100,
          y: 200,
          width: 50,
          height: 50,
        },
      ],
    }

    // User sends a message -> DatabaseSessionStorage.appendEntry is called
    const userEntry: SessionTreeEntry = {
      type: 'message',
      id: '01JTESTENTRY1234567890',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'user',
        content: 'Check this rectangle markup on video',
        timestamp: Date.now(),
      },
    }

    await storage.appendEntry(userEntry)

    // Verify DatabaseSessionStorage persisted entry with details.id = entry.id
    const dbEntry = await prisma.agentSessionEntry.findUnique({
      where: { id: '01JTESTENTRY1234567890' },
    })
    expect(dbEntry).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details = (dbEntry?.data as any)?.details
    expect(details.id).toBe('01JTESTENTRY1234567890')
    expect(details.position).toEqual({ type: 'time', seconds: 12.34 })
    expect(details.annotations).toHaveLength(1)

    // Now resolveAnnotationsById directly with the entry id and matching asset.id
    const result = await resolveAnnotationsById(asset.id, '01JTESTENTRY1234567890')
    expect(result.timestamp).toBe(12.34)
    expect(result.annotations).toEqual([
      {
        type: 'rectangle',
        x: 100,
        y: 200,
        width: 50,
        height: 50,
      },
    ])
  })

  it('throws an error when AgentSessionEntry belongs to a different asset', async () => {
    const user = await prisma.user.create({
      data: { name: 'User', email: 'user3@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({
      data: { name: 'Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Project', teamId: team.id },
    })
    const assetA = await prisma.asset.create({
      data: { name: 'chatA.mp4', type: 'file', projectId: project.id, status: 'uploaded' },
    })
    const assetB = await prisma.asset.create({
      data: { name: 'chatB.mp4', type: 'file', projectId: project.id, status: 'uploaded' },
    })
    const agentUser = await prisma.user.create({
      data: { name: 'Bot User', email: 'bot2@example.com', type: 'agent' },
    })
    const agent = await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'test-provider', model: 'test-model' },
      },
    })

    const storage = await DatabaseSessionStorage.create({
      agentId: agent.id,
      userId: user.id,
      assetId: assetB.id,
    })
    storage.currentMessageContext = {
      currentAsset: { id: assetB.id, name: assetB.name, type: 'file', path: assetB.name },
      annotation: true,
      annotations: [{ type: 'box' }],
    }
    const userEntry: SessionTreeEntry = {
      type: 'message',
      id: '01JENTRYONASSETB123456',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: 'Markup on B', timestamp: Date.now() },
    }
    await storage.appendEntry(userEntry)

    await expect(resolveAnnotationsById(assetA.id, '01JENTRYONASSETB123456')).rejects.toThrow(
      `Annotation "01JENTRYONASSETB123456" belongs to asset "${assetB.id}", not target asset "${assetA.id}".`,
    )
  })

  it('throws an error if annotationId does not match any record', async () => {
    await expect(resolveAnnotationsById('asset-1', 'non_existent_id')).rejects.toThrow(
      'Annotation with ID "non_existent_id" not found.',
    )
  })
})
