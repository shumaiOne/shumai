import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentEmbeddingMedia } from './agent-embedding'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import * as workflowCore from '@shumai/workflow-core'
import { DBOSError } from '@shumai/workflow-core'
import * as agentActivities from '../activities/agent'
import * as aiActivities from '../activities/ai'

vi.mock('@shumai/workflow-core', async () => {
  const actual = await vi.importActual('@shumai/workflow-core')
  return {
    ...actual,
    updateTaskStatusActivity: vi.fn(),
    updateTaskUsageActivity: vi.fn(),
  }
})

vi.mock('../activities/agent', async () => {
  const actual = await vi.importActual('../activities/agent')
  return {
    ...actual,
    createCommentActivity: vi.fn(),
    updateCommentActivity: vi.fn(),
  }
})

vi.mock('../activities/ai', async () => {
  const actual = await vi.importActual('../activities/ai')
  return {
    ...actual,
    getEmbeddingContextActivity: vi.fn(),
    generateImageEmbeddingActivity: vi.fn(),
    generateVideoChunkEmbeddingActivity: vi.fn(),
    saveAssetEmbeddingsActivity: vi.fn(),
    deleteAssetEmbeddingsActivity: vi.fn(),
    transcodeVideoChunksActivity: vi.fn(),
    deleteS3ObjectActivity: vi.fn(),
  }
})

describe('Agent Embedding Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateTaskStatusActivity: vi.mocked(workflowCore.updateTaskStatusActivity),
      getEmbeddingContextActivity: vi.mocked(aiActivities.getEmbeddingContextActivity),
      generateImageEmbeddingActivity: vi.mocked(aiActivities.generateImageEmbeddingActivity),
      generateVideoChunkEmbeddingActivity: vi.mocked(
        aiActivities.generateVideoChunkEmbeddingActivity,
      ),
      saveAssetEmbeddingsActivity: vi.mocked(aiActivities.saveAssetEmbeddingsActivity),
      deleteAssetEmbeddingsActivity: vi.mocked(aiActivities.deleteAssetEmbeddingsActivity),
      updateTaskUsageActivity: vi.mocked(workflowCore.updateTaskUsageActivity),
      createCommentActivity: vi.mocked(agentActivities.createCommentActivity),
      updateCommentActivity: vi.mocked(agentActivities.updateCommentActivity),
      transcodeVideoChunksActivity: vi.mocked(aiActivities.transcodeVideoChunksActivity),
      deleteS3ObjectActivity: vi.mocked(aiActivities.deleteS3ObjectActivity),
    }

    mockActivities.updateTaskStatusActivity.mockResolvedValue({})
    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'image/png',
        storageKey: { key: 'test.png' },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
    })
    mockActivities.generateImageEmbeddingActivity.mockResolvedValue({
      embedding: [0.1, 0.2],
      usage: { inputTokens: 5, outputTokens: 5, model: 'gpt' },
    })
    mockActivities.generateVideoChunkEmbeddingActivity.mockResolvedValue({
      embedding: [0.3, 0.4],
      usage: { inputTokens: 3, outputTokens: 3, model: 'gpt' },
    })
    mockActivities.transcodeVideoChunksActivity.mockImplementation(
      async (params: {
        assetId: string
        chunks: Array<{ startTime: number; endTime: number }>
      }) => {
        return {
          chunks: params.chunks.map((c) => ({
            startTime: c.startTime,
            endTime: c.endTime,
            chunkKey: `files/${params.assetId}/tmp-embedding-chunks/chunk-${c.startTime}-${c.endTime}.mp4`,
          })),
        }
      },
    )
    mockActivities.deleteS3ObjectActivity.mockResolvedValue(undefined)
  })

  it('should run agent embedding workflow successfully for image', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
        payload: {
          projectId: 'p1',
          agent: { sessionId: 's1', agentId: 'agent-1' },
        },
      },
    })

    await agentEmbeddingMedia(task)

    // Verify task processing status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
    })

    // Verify no comments created on success
    expect(mockActivities.createCommentActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateCommentActivity).not.toHaveBeenCalled()

    // Verify context fetching
    expect(mockActivities.getEmbeddingContextActivity).toHaveBeenCalledWith({
      teamId: 't1',
      assetId: 'a1',
    })

    // Verify image embedding generation
    expect(mockActivities.generateImageEmbeddingActivity).toHaveBeenCalledWith({
      teamId: 't1',
      assetKey: 'test.png',
      mediaType: 'image/png',
    })

    // Verify embeddings saved
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      embeddings: [{ embedding: [0.1, 0.2] }],
    })

    // Verify usage update
    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: task.id,
      inputTokens: 5,
      outputTokens: 5,
      model: 'gemini-embedding-2',
    })

    // Verify completed task status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should run agent embedding workflow successfully for image with transcoded format', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'image/png',
        storageKey: { key: 'test.png' },
        media: {
          imageTranscodes: [{ key: 'test-transcoded.webp', format: 'webp' }],
        },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    expect(mockActivities.generateImageEmbeddingActivity).toHaveBeenCalledWith({
      teamId: 't1',
      assetKey: 'test-transcoded.webp',
      mediaType: 'image/webp',
    })
  })

  it('should run agent embedding workflow successfully for 3D asset using 4-views image', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'model-1',
        mediaType: 'model/gltf-binary',
        storageKey: { key: 'raw/model.glb' },
        media: {
          proxyType: '3d',
          imageTranscodes: [{ key: 'files/views.webp', format: 'webp' }],
        },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'model-1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    expect(mockActivities.generateImageEmbeddingActivity).toHaveBeenCalledWith({
      teamId: 't1',
      assetKey: 'files/views.webp',
      mediaType: 'image/webp',
    })
  })

  it('should reject 3D asset for embeddings if imageTranscodes is missing', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'model-1',
        mediaType: 'model/gltf-binary',
        storageKey: { key: 'raw/model.glb' },
        media: {
          proxyType: '3d',
          imageTranscodes: [],
        },
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'model-1',
        teamId: 't1',
      },
    })

    await expect(agentEmbeddingMedia(task)).rejects.toThrow(
      'unsupported media type for embeddings: model/gltf-binary',
    )
  })

  it('should run agent embedding workflow successfully for video in chunks via single batch transcode task', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'video/mp4',
        storageKey: { key: 'test.mp4' },
        media: {
          duration: 150.0,
          videoTranscodes: [{ key: 'test-transcoded.mp4' }],
        },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
        projectId: 'p1',
        payload: {
          projectId: 'p1',
          agent: { sessionId: 's1', agentId: 'agent-1' },
        },
      },
    })

    await agentEmbeddingMedia(task)

    // Verify batch video chunk slicing activity called once on transcode queue with all 3 chunks
    expect(mockActivities.transcodeVideoChunksActivity).toHaveBeenCalledTimes(1)
    expect(mockActivities.transcodeVideoChunksActivity).toHaveBeenCalledWith({
      parentTaskId: task.id,
      teamId: 't1',
      projectId: 'p1',
      assetId: 'a1',
      assetKey: 'test-transcoded.mp4',
      format: 'video',
      chunks: [
        { startTime: 0, endTime: 60 },
        { startTime: 55, endTime: 115 },
        { startTime: 110, endTime: 150 },
      ],
    })

    // Verify video chunk embedding generation (3 chunks) on agent queue
    expect(mockActivities.generateVideoChunkEmbeddingActivity).toHaveBeenCalledTimes(3)
    expect(mockActivities.generateVideoChunkEmbeddingActivity).toHaveBeenNthCalledWith(1, {
      teamId: 't1',
      chunkKey: 'files/a1/tmp-embedding-chunks/chunk-0-60.mp4',
    })
    expect(mockActivities.generateVideoChunkEmbeddingActivity).toHaveBeenNthCalledWith(2, {
      teamId: 't1',
      chunkKey: 'files/a1/tmp-embedding-chunks/chunk-55-115.mp4',
    })
    expect(mockActivities.generateVideoChunkEmbeddingActivity).toHaveBeenNthCalledWith(3, {
      teamId: 't1',
      chunkKey: 'files/a1/tmp-embedding-chunks/chunk-110-150.mp4',
    })

    // Verify deletion of temporary chunks from S3
    expect(mockActivities.deleteS3ObjectActivity).toHaveBeenCalledTimes(3)
    expect(mockActivities.deleteS3ObjectActivity).toHaveBeenNthCalledWith(1, {
      key: 'files/a1/tmp-embedding-chunks/chunk-0-60.mp4',
    })

    // Verify usage update (3 chunks * 3 tokens = 9)
    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: task.id,
      inputTokens: 9,
      outputTokens: 9,
      model: 'gemini-embedding-2',
    })

    // Verify embeddings saved per chunk immediately
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalledTimes(3)
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenNthCalledWith(1, {
      assetId: 'a1',
      embeddings: [{ embedding: [0.3, 0.4], startTime: 0, endTime: 60 }],
    })
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenNthCalledWith(2, {
      assetId: 'a1',
      embeddings: [{ embedding: [0.3, 0.4], startTime: 55, endTime: 115 }],
    })
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenNthCalledWith(3, {
      assetId: 'a1',
      embeddings: [{ embedding: [0.3, 0.4], startTime: 110, endTime: 150 }],
    })
  })

  it('should throw if task has no teamId', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await expect(agentEmbeddingMedia(task)).rejects.toThrow('Task has no teamId')

    // Verify status updated to failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'Task has no teamId' },
    })
  })

  it('should skip saving embeddings if none are returned (video duration 0)', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'video/mp4',
        storageKey: { key: 'test.mp4' },
        media: {
          duration: 0.0,
        },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    expect(mockActivities.transcodeVideoChunksActivity).not.toHaveBeenCalled()
    expect(mockActivities.saveAssetEmbeddingsActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should handle failures, create comment with error, and set status to failed', async () => {
    mockActivities.generateImageEmbeddingActivity.mockRejectedValue(
      new Error('AI Service Unavailable'),
    )

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await expect(agentEmbeddingMedia(task)).rejects.toThrow('AI Service Unavailable')

    // Verify error comment created
    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: 'Embedding failed: AI Service Unavailable',
      sessionId: task.id,
      agentId: 'default',
    })
    expect(mockActivities.updateCommentActivity).not.toHaveBeenCalled()

    // Verify status updated to failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'AI Service Unavailable' },
    })
  })

  it('should post an error comment when workflow is cancelled with DBOSWorkflowCancelledError', async () => {
    const cancelErr = new DBOSError.DBOSWorkflowCancelledError('wf-cancel')
    mockActivities.generateImageEmbeddingActivity.mockRejectedValue(cancelErr)

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await expect(agentEmbeddingMedia(task)).rejects.toThrow()

    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: expect.stringContaining('Embedding failed:'),
      sessionId: task.id,
      agentId: 'default',
    })
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: expect.stringContaining('wf-cancel') },
    })
  })

  it('should save completed chunks to DB immediately and clean up all remaining temporary S3 chunks on failure', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'video/mp4',
        storageKey: { key: 'test.mp4' },
        media: {
          duration: 150.0,
          videoTranscodes: [{ key: 'test-transcoded.mp4' }],
        },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
    })

    // Chunk 1 succeeds, Chunk 2 fails
    mockActivities.generateVideoChunkEmbeddingActivity
      .mockResolvedValueOnce({
        embedding: [0.1, 0.2],
        usage: { inputTokens: 3, outputTokens: 3, model: 'gemini-embedding-2' },
      })
      .mockRejectedValueOnce(new Error('Rate limit exceeded at chunk 2'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await expect(agentEmbeddingMedia(task)).rejects.toThrow('Rate limit exceeded at chunk 2')

    // Chunk 1 MUST have been saved to the database before chunk 2 failed
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalledTimes(1)
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      embeddings: [{ embedding: [0.1, 0.2], startTime: 0, endTime: 60 }],
    })

    // All 3 temporary chunks (chunk 1 after success, chunk 2 and chunk 3 in finally) MUST be deleted from S3
    expect(mockActivities.deleteS3ObjectActivity).toHaveBeenCalledTimes(3)
    expect(mockActivities.deleteS3ObjectActivity).toHaveBeenNthCalledWith(1, {
      key: 'files/a1/tmp-embedding-chunks/chunk-0-60.mp4',
    })
    expect(mockActivities.deleteS3ObjectActivity).toHaveBeenNthCalledWith(2, {
      key: 'files/a1/tmp-embedding-chunks/chunk-55-115.mp4',
    })
    expect(mockActivities.deleteS3ObjectActivity).toHaveBeenNthCalledWith(3, {
      key: 'files/a1/tmp-embedding-chunks/chunk-110-150.mp4',
    })
  })

  it('should not create redundant chunks when video exactly matches chunk duration', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'video/mp4',
        storageKey: { key: 'test.mp4' },
        media: {
          duration: 60.0,
        },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    // Verify only 1 chunk was requested instead of 2 (0-60 and 55-60)
    expect(mockActivities.transcodeVideoChunksActivity).toHaveBeenCalledTimes(1)
    expect(mockActivities.transcodeVideoChunksActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: [{ startTime: 0, endTime: 60 }],
      }),
    )
  })

  it('should run agent embedding workflow for video with gemma-embedding-2-openai requesting frames format', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'video/mp4',
        storageKey: { key: 'test.mp4' },
        media: {
          duration: 30.0,
        },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
      embeddingProvider: 'gemma-embedding-2-openai',
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    expect(mockActivities.transcodeVideoChunksActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'frames',
        chunks: [{ startTime: 0, endTime: 30 }],
      }),
    )
    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemma-embedding-2-openai',
      }),
    )
  })

  it('should skip already completed chunks when resuming a video embedding task', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'video/mp4',
        storageKey: { key: 'test.mp4' },
        media: {
          duration: 150.0,
          videoTranscodes: [{ key: 'test-transcoded.mp4' }],
        },
      },
      chunkDuration: 60.0,
      chunkOverlap: 5.0,
      existingEmbeddings: [
        {
          id: 'emb-1',
          startTime: 0,
          endTime: 60,
          has1536: true,
          has768: false,
        },
      ],
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    // Chunk 1 (0-60) should be skipped; only chunk 2 (55-115) and chunk 3 (110-150) should be transcoded and embedded
    expect(mockActivities.transcodeVideoChunksActivity).toHaveBeenCalledTimes(1)
    expect(mockActivities.transcodeVideoChunksActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: [
          { startTime: 55, endTime: 115 },
          { startTime: 110, endTime: 150 },
        ],
      }),
    )

    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalledTimes(2)
  })

  it('should purge incompatible embeddings before processing', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'image/png',
        storageKey: { key: 'test.png' },
      },
      embeddingProvider: 'gemma-embedding-2-openai',
      existingEmbeddings: [
        {
          id: 'old-gemini-emb',
          startTime: null,
          endTime: null,
          has1536: true,
          has768: false,
        },
      ],
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    // Should purge incompatible old-gemini-emb
    expect(mockActivities.deleteAssetEmbeddingsActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      ids: ['old-gemini-emb'],
    })

    // Should generate and save new embedding
    expect(mockActivities.generateImageEmbeddingActivity).toHaveBeenCalled()
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalled()
  })
})
