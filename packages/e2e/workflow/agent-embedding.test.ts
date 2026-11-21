import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma, WorkflowTaskStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent, TaskQueueTranscode } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'

const mockEmbedContent = vi.fn().mockResolvedValue({
  embeddings: [
    {
      values: Array(1536).fill(0.2),
    },
  ],
})

vi.mock('@google/genai', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    GoogleGenAI: class {
      models = {
        embedContent: mockEmbedContent,
      }
    },
  }
})

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(currentDir, '../fixtures')

describe('Workflow E2E - agentEmbeddingMedia', () => {
  setupTestDbHooks()

  beforeAll(async () => {
    // Set bucket environment
    process.env.S3_BUCKET = 'shumai-e2e-test-bucket-embedding'
    process.env.GEMINI_API_KEY = 'dummy-key'

    // Initialize registries
    initAgentWorkflows()
    initTranscodeWorkflows()

    await workflowService.startWorkers([TaskQueueAgent, TaskQueueTranscode])
  })

  afterAll(async () => {
    await workflowService.shutdownWorkers()
    workflowService.close()

    // Restore spied methods
    vi.restoreAllMocks()

    // Clean up E2E files in local filesystem storage
    try {
      console.log('Cleaning up local E2E storage files...')
      await s3Service.deletePrefix('shumai-e2e-test-bucket-embedding', '')
    } catch (err) {
      console.error('Failed to clean up E2E storage folder:', err)
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should run agentEmbeddingMedia workflow for an image asset successfully', async () => {
    // 1. Seed Database
    const team = await prisma.team.create({
      data: { name: 'E2E Image Embedding Team' },
    })

    const project = await prisma.project.create({
      data: { name: 'E2E Image Embedding Project', teamId: team.id },
    })

    const agentUser = await prisma.user.create({
      data: {
        name: 'E2E Image Embedding Agent User',
        email: 'e2e-img-emb-agent@shumai.ai',
        type: 'agent',
      },
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: agentUser.id,
        role: 'editor',
      },
    })

    const provider = await prisma.provider.create({
      data: {
        name: 'google',
        teamId: team.id,
        config: { api: 'google-generative-ai', apiKey: 'dummy-google-api-key' },
      },
    })

    const model = await prisma.model.create({
      data: {
        modelId: 'gemini',
        name: 'Gemini',
        providerId: provider.id,
        config: {
          input: ['text', 'image'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 8192,
          maxTokens: 2048,
          reasoning: false,
        },
      },
    })

    await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'embedding',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        config: {
          provider: 'google',
          model: 'gemini',
        },
      },
    })

    const storageKey = await prisma.storageKey.create({
      data: {
        key: 'projects/e2e/test-image.png',
      },
    })

    const asset = await prisma.asset.create({
      data: {
        name: 'test-image.png',
        type: 'file',
        status: 'uploaded',
        mediaType: 'image/png',
        projectId: project.id,
        storageKeyId: storageKey.id,
      },
    })

    // 2. Seed S3 Storage from Fixture
    const pngPath = path.join(fixturesDir, 'small.png')
    const pngBuffer = fs.readFileSync(pngPath)
    await s3Service.putObject(
      'shumai-e2e-test-bucket-embedding',
      'projects/e2e/test-image.png',
      pngBuffer,
      pngBuffer.length,
      'image/png',
    )

    // 3. Create Workflow Task (ai_embedding, pending)
    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: asset.id,
        projectId: project.id,
        teamId: team.id,
        payload: {
          projectId: project.id,
          agent: { agentId: agentUser.id },
        },
      },
    })

    // 4. Wait for workflow to complete
    console.log(
      `Submitted E2E Image Embedding Workflow Task. ID: ${task.id}. Awaiting completion...`,
    )
    const completedTask = await workflowService.executeWait(task, 45000)

    // 5. Verification
    expect(completedTask.status).toBe('completed')

    // Verify no comments created on successful embedding
    const comments = await prisma.assetComment.findMany({
      where: { assetId: asset.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(comments.length).toBe(0)

    // Verify raw embedding is saved in DB
    const dbEmbeddings = (await prisma.$queryRaw`
      SELECT id, asset_id as "assetId", start_time as "startTime", end_time as "endTime"
      FROM asset_embeddings
      WHERE asset_id = ${asset.id}
    `) as { id: string; startTime: number | null; endTime: number | null }[]
    expect(dbEmbeddings.length).toBe(1)
    expect(dbEmbeddings[0].startTime).toBeNull()
    expect(dbEmbeddings[0].endTime).toBeNull()
  }, 50000)

  it.each([
    { mode: 'full video', duration: 1, ranges: [[0, 1]] },
    {
      mode: 'Gemini chunks',
      duration: 12,
      ranges: [
        [0, 6],
        [5, 11],
        [10, 12],
      ],
    },
    {
      mode: 'Gemma chunks',
      duration: 12,
      ranges: [
        [0, 6],
        [5, 11],
        [10, 12],
      ],
    },
  ])(
    'saves video embeddings and partial previews for $mode',
    async ({ mode, duration, ranges }) => {
      const useGemma = mode === 'Gemma chunks'
      vi.stubEnv('EMBEDDING_PROVIDER', useGemma ? 'gemma-embedding-2-openai' : 'gemini-embedding-2')
      vi.stubEnv('EMBEDDING_CHUNK_DURATION', '6')
      vi.stubEnv('EMBEDDING_CHUNK_OVERLAP', '1')
      if (useGemma) {
        const endpoint = 'http://test-gemma.local/v1/embeddings'
        const fetch = globalThis.fetch
        vi.stubEnv('GEMMA_EMBEDDING_OPENAI_BASE_URL', endpoint)
        vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
          if (input === endpoint) {
            return Promise.resolve(Response.json({ data: [{ embedding: Array(768).fill(0.2) }] }))
          }
          return fetch(input, init)
        })
      }
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Video Embedding Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Video Embedding Project', teamId: team.id },
      })

      const agentUser = await prisma.user.create({
        data: {
          name: 'E2E Video Embedding Agent User',
          email: 'e2e-vid-emb-agent@shumai.ai',
          type: 'agent',
        },
      })

      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: agentUser.id,
          role: 'editor',
        },
      })

      const provider = await prisma.provider.create({
        data: {
          name: 'google',
          teamId: team.id,
          config: { api: 'google-generative-ai', apiKey: 'dummy-google-api-key' },
        },
      })

      const model = await prisma.model.create({
        data: {
          modelId: 'gemini',
          name: 'Gemini',
          providerId: provider.id,
          config: {
            input: ['text', 'image'],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 2048,
            reasoning: false,
          },
        },
      })

      await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId: team.id,
          type: 'embedding',
          enabled: true,
          providerId: provider.id,
          modelId: model.id,
          config: {
            provider: 'google',
            model: 'gemini',
          },
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test-video.mp4',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test-video.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          media: { duration } as PrismaJson.MediaInfo,
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage from Fixture
      const mp4Path = path.join(fixturesDir, 'small.mp4')
      const clip = Bun.spawnSync([
        'ffmpeg',
        '-loglevel',
        'error',
        '-stream_loop',
        String(duration - 1),
        '-i',
        mp4Path,
        '-c',
        'copy',
        '-movflags',
        'frag_keyframe+empty_moov',
        '-f',
        'mp4',
        'pipe:1',
      ])
      expect(clip.exitCode, clip.stderr.toString()).toBe(0)
      const mp4Buffer = Buffer.from(clip.stdout)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-embedding',
        'projects/e2e/test-video.mp4',
        mp4Buffer,
        mp4Buffer.length,
        'video/mp4',
      )

      // 3. Create Workflow Task (ai_embedding, pending)
      const task = await prisma.workflowTask.create({
        data: {
          type: 'ai_embedding',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            agent: { agentId: agentUser.id },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E Video Embedding Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      // Verify raw embedding is saved in DB with start and end times
      const dbEmbeddings = (await prisma.$queryRaw`
      SELECT id, asset_id as "assetId", start_time as "startTime", end_time as "endTime"
      FROM asset_embeddings
      WHERE asset_id = ${asset.id}
      ORDER BY start_time ASC
    `) as { id: string; startTime: number | null; endTime: number | null }[]
      expect(dbEmbeddings.map(({ startTime, endTime }) => [startTime, endTime])).toEqual(ranges)
      const updated = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })
      const jobs = await prisma.workflowTask.findMany({
        where: { assetId: asset.id, type: 'transcode_video_chunk_preview' },
      })
      const requested = duration === 1 ? [] : ranges
      const previews = updated.media?.chunkPreviews ?? {}
      expect(Object.keys(previews).sort()).toEqual(
        requested.map((range) => JSON.stringify(range)).sort(),
      )
      expect(jobs).toHaveLength(duration === 1 ? 0 : 1)
      if (jobs.length) {
        expect(jobs[0].status).toBe('completed')
        expect(jobs[0].payload?.videoChunkPreviewRanges).toEqual(
          requested.map(([startTime, endTime]) => ({ startTime, endTime })),
        )
        const client = await workflowService.getExecutor().getClient()
        const status = await client.retrieveWorkflow(jobs[0].id).getStatus()
        expect(status?.queueName).toBe(TaskQueueTranscode)
      }

      for (const [startTime, endTime] of requested) {
        const media = previews[JSON.stringify([startTime, endTime])]
        expect(media.timestamps.length).toBeGreaterThanOrEqual(1)
        expect(media.timestamps.length).toBeLessThanOrEqual(10)
        expect(
          media.timestamps.every((timestamp) => timestamp >= startTime && timestamp < endTime),
        ).toBe(true)
        const { buffer } = await s3Service.getObject(
          'shumai-e2e-test-bucket-embedding',
          media.spriteKey,
        )
        expect(await sharp(buffer).metadata()).toMatchObject({
          format: 'webp',
          width: media.columns * media.frameWidth,
          height: media.rows * media.frameHeight,
        })
        const poster = await s3Service.getObject(
          'shumai-e2e-test-bucket-embedding',
          media.posterKey,
        )
        expect(await sharp(poster.buffer).metadata()).toMatchObject({ format: 'webp' })
      }
    },
    50000,
  )

  it('should fail agentEmbeddingMedia workflow for an unsupported audio asset', async () => {
    // 1. Seed Database
    const team = await prisma.team.create({
      data: { name: 'E2E Audio Embedding Team' },
    })

    const project = await prisma.project.create({
      data: { name: 'E2E Audio Embedding Project', teamId: team.id },
    })

    const agentUser = await prisma.user.create({
      data: {
        name: 'E2E Audio Embedding Agent User',
        email: 'e2e-aud-emb-agent@shumai.ai',
        type: 'agent',
      },
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: agentUser.id,
        role: 'editor',
      },
    })

    const provider = await prisma.provider.create({
      data: {
        name: 'google',
        teamId: team.id,
        config: { api: 'google-generative-ai', apiKey: 'dummy-google-api-key' },
      },
    })

    const model = await prisma.model.create({
      data: {
        modelId: 'gemini',
        name: 'Gemini',
        providerId: provider.id,
        config: {
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 8192,
          maxTokens: 2048,
          reasoning: false,
        },
      },
    })

    await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'embedding',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        config: {
          provider: 'google',
          model: 'gemini',
        },
      },
    })

    const storageKey = await prisma.storageKey.create({
      data: {
        key: 'projects/e2e/test-audio.wav',
      },
    })

    const asset = await prisma.asset.create({
      data: {
        name: 'test-audio.wav',
        type: 'file',
        status: 'uploaded',
        mediaType: 'audio/wav',
        projectId: project.id,
        storageKeyId: storageKey.id,
      },
    })

    // 2. Seed S3 Storage from Fixture
    const wavPath = path.join(fixturesDir, 'small.wav')
    const wavBuffer = fs.readFileSync(wavPath)
    await s3Service.putObject(
      'shumai-e2e-test-bucket-embedding',
      'projects/e2e/test-audio.wav',
      wavBuffer,
      wavBuffer.length,
      'audio/wav',
    )

    // 3. Create Workflow Task (ai_embedding, pending)
    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: asset.id,
        projectId: project.id,
        teamId: team.id,
        payload: {
          projectId: project.id,
          agent: { agentId: agentUser.id },
        },
      },
    })

    // 4. Wait for workflow to fail and verify error message
    console.log(`Submitted E2E Audio Embedding Workflow Task. ID: ${task.id}. Awaiting failure...`)
    await expect(workflowService.executeWait(task, 45000)).rejects.toThrow(
      'unsupported media type for embeddings: audio/wav',
    )

    // Verify task status in DB is failed
    const dbTask = await prisma.workflowTask.findUnique({
      where: { id: task.id },
    })
    expect(dbTask?.status).toBe(WorkflowTaskStatus.failed)

    // Verify failure comment was posted to the asset
    const comments = await prisma.assetComment.findMany({
      where: { assetId: asset.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(comments.length).toBe(1)
    expect(comments[0].message).toContain(
      'Embedding failed: unsupported media type for embeddings: audio/wav',
    )
  }, 50000)
})
