import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import { createModels } from '@earendil-works/pi-ai'
import { Harness, createRegistry } from '@earendil-works/pi-durable'
import { agentSessionService } from '@shumai/core/src/agent/session-service'
import { resolveAnnotationsById } from '@shumai/core/src/asset-read/annotations'
import { degreeToSecond } from '@shumai/core/src/utils/model3d'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import type { ShumaiMessageContext } from '@shumai/dtos'
import { beforeEach, describe, expect, it } from 'vitest'

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
      data: { name: 'videoA.mp4', type: 'file', status: 'uploaded', projectId: project.id },
    })
    const assetB = await prisma.asset.create({
      data: { name: 'videoB.mp4', type: 'file', status: 'uploaded', projectId: project.id },
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

  async function fixture() {
    const team = await prisma.team.create({ data: { name: 'Native annotation team' } })
    const project = await prisma.project.create({ data: { name: 'Project', teamId: team.id } })
    const asset = await prisma.asset.create({
      data: { name: 'video.mp4', type: 'file', status: 'uploaded', projectId: project.id },
    })
    const other = await prisma.asset.create({
      data: { name: 'other.mp4', type: 'file', status: 'uploaded', projectId: project.id },
    })
    const user = await prisma.user.create({
      data: { name: 'Agent', email: 'native@test.com', type: 'agent' },
    })
    const agent = await prisma.agent.create({
      data: {
        id: user.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'faux', model: 'faux-1' },
      },
    })
    const session = await prisma.agentSession.create({ data: { agentId: agent.id, cwd: '/test' } })
    return { session, asset, other }
  }

  async function annotate(sessionId: string, requestId: string, context: ShumaiMessageContext) {
    await agentSessionService.withWriter(sessionId, async (storage) => {
      const harness = await Harness.open(
        storage,
        { models: createModels(), registry: createRegistry() },
        BACKGROUND_CONTEXT,
      )
      try {
        const root = await harness.root(BACKGROUND_CONTEXT)
        await root.submit(
          {
            type: 'write',
            requestId,
            entry: {
              kind: 'shumai.message',
              data: JSON.parse(
                JSON.stringify({ displayText: 'Check markup', timestamp: 1, context }),
              ),
            },
          },
          BACKGROUND_CONTEXT,
        )
      } finally {
        await harness.close(BACKGROUND_CONTEXT)
      }
    })
    return `chat:${sessionId}:${requestId}`
  }

  it('resolves annotations after a SQLite cache rebuild using the durable submission reference', async () => {
    const { session, asset } = await fixture()
    const id = await annotate(session.id, 'request', {
      currentAsset: { id: asset.id, name: asset.name, type: 'file' },
      position: { type: 'time', seconds: 12.34 },
      annotation: true,
      annotations: [{ type: 'box' }],
    })
    await agentSessionService.closeAll()
    expect(await resolveAnnotationsById(asset.id, id)).toEqual({
      timestamp: 12.34,
      annotations: [{ type: 'box' }],
    })
  })

  it('resolves degree positions as timestamps for 3D assets', async () => {
    const { session, asset } = await fixture()
    const id = await annotate(session.id, 'degree', {
      currentAsset: { id: asset.id, name: asset.name, type: 'file' },
      position: { type: 'degree', degree: 45 },
      annotation: true,
      annotations: [{ type: 'box' }],
    })
    expect((await resolveAnnotationsById(asset.id, id)).timestamp).toBeCloseTo(degreeToSecond(45))
  })

  it('rejects references to another asset', async () => {
    const { session, asset, other } = await fixture()
    const id = await annotate(session.id, 'request', {
      currentAsset: { id: asset.id, name: asset.name, type: 'file' },
      annotation: true,
      annotations: [{ type: 'box' }],
    })
    await expect(resolveAnnotationsById(other.id, id)).rejects.toThrow(
      `belongs to asset "${asset.id}"`,
    )
  })

  it('throws an error if annotationId does not match any record', async () => {
    await expect(resolveAnnotationsById('asset-1', 'non_existent_id')).rejects.toThrow(
      'Annotation with ID "non_existent_id" not found.',
    )
  })
})
