import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentEmbeddingMedia } from './agent-embedding'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import * as workflowUtils from '@shumai/workflow-core'

vi.mock('@shumai/workflow-core', async () => {
  const actual = await vi.importActual('@shumai/workflow-core')
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
  }
})

describe('Agent Embedding Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateTaskStatusActivity: Object.assign(vi.fn(), {
        _activityName: 'updateTaskStatusActivity',
      }),
      getEmbeddingContextActivity: Object.assign(vi.fn(), {
        _activityName: 'getEmbeddingContextActivity',
      }),
      generateImageEmbeddingActivity: Object.assign(vi.fn(), {
        _activityName: 'generateImageEmbeddingActivity',
      }),
      generateVideoChunkEmbeddingActivity: Object.assign(vi.fn(), {
        _activityName: 'generateVideoChunkEmbeddingActivity',
      }),
      saveAssetEmbeddingsActivity: Object.assign(vi.fn(), {
        _activityName: 'saveAssetEmbeddingsActivity',
      }),
      updateTaskUsageActivity: Object.assign(vi.fn(), { _activityName: 'updateTaskUsageActivity' }),
      createCommentActivity: Object.assign(vi.fn(), { _activityName: 'createCommentActivity' }),
      updateCommentActivity: Object.assign(vi.fn(), { _activityName: 'updateCommentActivity' }),
      getAgentWorkerQueueActivity: Object.assign(vi.fn(), {
        _activityName: 'getAgentWorkerQueueActivity',
      }),
      getTranscodeWorkerQueueActivity: Object.assign(vi.fn(), {
        _activityName: 'getTranscodeWorkerQueueActivity',
      }),
      downloadMediaToTmpActivity: Object.assign(vi.fn(), {
        _activityName: 'downloadMediaToTmpActivity',
      }),
      cleanupTmpDirActivity: Object.assign(vi.fn(), {
        _activityName: 'cleanupTmpDirActivity',
      }),
      transcodeVideoChunkActivity: Object.assign(vi.fn(), {
        _activityName: 'transcodeVideoChunkActivity',
      }),
      deleteS3ObjectActivity: Object.assign(vi.fn(), {
        _activityName: 'deleteS3ObjectActivity',
      }),
    }

    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
    mockActivities.getTranscodeWorkerQueueActivity.mockResolvedValue('transcode_queue')
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
    mockActivities.downloadMediaToTmpActivity.mockResolvedValue({
      filePath: '/tmp/test.mp4',
      tmpDir: '/tmp/test-dir',
    })
    mockActivities.transcodeVideoChunkActivity.mockImplementation(
      async (params: { assetId: string; startTime: number; endTime: number }) => {
        return {
          chunkKey: `files/${params.assetId}/tmp-embedding-chunks/chunk-${params.startTime}-${params.endTime}.mp4`,
        }
      },
    )
    mockActivities.deleteS3ObjectActivity.mockResolvedValue(undefined)
    mockActivities.cleanupTmpDirActivity.mockResolvedValue(undefined)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities contains vi.fn mock functions which are cast to expected activity proxy types
    vi.mocked(workflowUtils.getActivities).mockReturnValue(mockActivities as any)
    vi.mocked(workflowUtils.executeActivity).mockImplementation(async (_queue, act, ...args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- act is one of the mocked activities
      return (act as any)(...args)
    })
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

    // Verify queue discovery
    expect(mockActivities.getAgentWorkerQueueActivity).toHaveBeenCalled()

    // Verify task processing status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
    })

    // Verify placeholder comment created
    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: '__EMBEDDING__',
      sessionId: 's1',
      agentId: 'agent-1',
    })

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

    // Verify placeholder comment updated
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Embedding completed successfully.',
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
          imageTranscodes: [{ key: 'test-transcoded.webp', isRaw: false, format: 'webp' }],
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

  it('should run agent embedding workflow successfully for video in chunks', async () => {
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: {
        id: 'a1',
        mediaType: 'video/mp4',
        storageKey: { key: 'test.mp4' },
        media: {
          duration: 150.0,
          videoTranscodes: [{ key: 'test-transcoded.mp4', isRaw: false }],
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
        payload: {
          projectId: 'p1',
          agent: { sessionId: 's1', agentId: 'agent-1' },
        },
      },
    })

    await agentEmbeddingMedia(task)

    // Verify video transcode queue discovery & download
    expect(mockActivities.getTranscodeWorkerQueueActivity).toHaveBeenCalled()
    expect(mockActivities.downloadMediaToTmpActivity).toHaveBeenCalledWith({
      assetKey: 'test-transcoded.mp4',
    })

    // Verify video chunk slicing activity called 3 times on transcode queue
    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenCalledTimes(3)
    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenNthCalledWith(1, {
      assetId: 'a1',
      filePath: '/tmp/test.mp4',
      startTime: 0,
      endTime: 60,
    })
    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenNthCalledWith(2, {
      assetId: 'a1',
      filePath: '/tmp/test.mp4',
      startTime: 55,
      endTime: 115,
    })
    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenNthCalledWith(3, {
      assetId: 'a1',
      filePath: '/tmp/test.mp4',
      startTime: 110,
      endTime: 150,
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

    // Verify temp directory cleanup on transcode queue
    expect(mockActivities.cleanupTmpDirActivity).toHaveBeenCalledWith({
      tmpDir: '/tmp/test-dir',
    })

    // Verify usage update (3 chunks * 3 tokens = 9)
    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: task.id,
      inputTokens: 9,
      outputTokens: 9,
      model: 'gemini-embedding-2',
    })

    // Verify embeddings saved
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      embeddings: [
        { embedding: [0.3, 0.4], startTime: 0, endTime: 60 },
        { embedding: [0.3, 0.4], startTime: 55, endTime: 115 },
        { embedding: [0.3, 0.4], startTime: 110, endTime: 150 },
      ],
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

    expect(mockActivities.saveAssetEmbeddingsActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should handle failures, update placeholder with error, and set status to failed', async () => {
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

    // Verify placeholder updated with error
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Embedding failed: AI Service Unavailable',
    })

    // Verify status updated to failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'AI Service Unavailable' },
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

    // Verify only 1 chunk was created instead of 2 (0-60 and 55-60)
    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenCalledTimes(1)
    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: 0,
        endTime: 60,
      }),
    )
  })
})
