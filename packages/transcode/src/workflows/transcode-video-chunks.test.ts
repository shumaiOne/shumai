import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodeVideoChunksWorkflow } from './transcode-video-chunks'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import { getAssetActivity, updateTaskStatusActivity } from '@shumai/workflow-core'
import { deleteS3ObjectActivity, transcodeVideoChunkActivity } from '../activities/transcode'

vi.mock('@shumai/workflow-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/workflow-core')>()
  return {
    ...actual,
    updateTaskStatusActivity: vi.fn(),
    getAssetActivity: vi.fn(),
  }
})

vi.mock('../activities/transcode', () => ({
  transcodeVideoChunkActivity: vi.fn(),
  deleteS3ObjectActivity: vi.fn(),
}))

function createMockTask(overrides?: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: 'task-video-chunks',
    assetId: 'asset-video',
    type: WorkflowTaskType.transcode_video_chunks,
    status: WorkflowTaskStatus.pending,
    sessionId: null,
    output: null,
    payload: {
      projectId: 'proj-1',
      videoChunks: {
        parentTaskId: 'parent-emb-1',
        assetKey: 'files/asset-video/proxy.mp4',
        format: 'video',
        chunks: [
          { startTime: 0, endTime: 60 },
          { startTime: 55, endTime: 110 },
        ],
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    heartbeat: null,
    teamId: 'team-1',
    projectId: 'proj-1',
    uid: 'task-uid',
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    ...overrides,
  }
}

describe('transcodeVideoChunksWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: vi.mocked(updateTaskStatusActivity),
    getAssetActivity: vi.mocked(getAssetActivity),
    transcodeVideoChunkActivity: vi.mocked(transcodeVideoChunkActivity),
    deleteS3ObjectActivity: vi.mocked(deleteS3ObjectActivity),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockActivities.updateTaskStatusActivity.mockResolvedValue({} as never)
    mockActivities.deleteS3ObjectActivity.mockResolvedValue(undefined)
  })

  it('should transcode all requested video chunks and complete with chunk keys', async () => {
    const task = createMockTask()

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-video',
      status: 'processed',
      storageKey: { key: 'files/asset-video/raw.mp4', isArchived: false },
      mediaType: 'video/mp4',
      media: { duration: 110, sprite: { key: 'files/asset-video/sprite.webp' } },
    } as unknown as Awaited<ReturnType<typeof getAssetActivity>>)

    const sprite = {
      key: 'files/asset-video/chunk-sprites/asset-video/video-0-60.webp',
      columns: 5,
      rows: 3,
      frameCount: 15,
    }
    mockActivities.transcodeVideoChunkActivity
      .mockResolvedValueOnce({
        chunkKey: 'files/asset-video/tmp-embedding-chunks/chunk-0-60.mp4',
        sprite,
      })
      .mockResolvedValueOnce({
        chunkKey: 'files/asset-video/tmp-embedding-chunks/chunk-55-110.mp4',
      })

    await transcodeVideoChunksWorkflow(task)

    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenCalledTimes(2)
    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenNthCalledWith(1, {
      taskId: 'task-video-chunks',
      assetId: 'asset-video',
      assetKey: 'files/asset-video/proxy.mp4',
      originalKey: 'files/asset-video/raw.mp4',
      startTime: 0,
      endTime: 60,
      format: 'video',
    })
    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenNthCalledWith(2, {
      taskId: 'task-video-chunks',
      assetId: 'asset-video',
      assetKey: 'files/asset-video/proxy.mp4',
      originalKey: 'files/asset-video/raw.mp4',
      startTime: 55,
      endTime: 110,
      format: 'video',
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-video-chunks',
      status: WorkflowTaskStatus.completed,
      output: {
        chunks: [
          {
            startTime: 0,
            endTime: 60,
            chunkKey: 'files/asset-video/tmp-embedding-chunks/chunk-0-60.mp4',
            sprite,
          },
          {
            startTime: 55,
            endTime: 110,
            chunkKey: 'files/asset-video/tmp-embedding-chunks/chunk-55-110.mp4',
          },
        ],
      },
    })
  })

  it('should fall back to videoTranscodes proxy when assetKey is omitted and support frames format on archived assets', async () => {
    const task = createMockTask({
      payload: {
        projectId: 'proj-1',
        videoChunks: {
          parentTaskId: 'parent-emb-2',
          format: 'frames',
          chunks: [{ startTime: 0, endTime: 30 }],
        },
      },
    })

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-video',
      status: 'archived',
      storageKey: { key: 'files/asset-video/raw.mp4', isArchived: true },
      mediaType: 'video/mp4',
      media: {
        videoTranscodes: [{ key: 'files/asset-video/proxy-720p.mp4' }],
      },
    } as unknown as Awaited<ReturnType<typeof getAssetActivity>>)

    mockActivities.transcodeVideoChunkActivity.mockResolvedValueOnce({
      chunkKey: 'files/asset-video/tmp-embedding-chunks/frames-0-30.tar',
    })

    await transcodeVideoChunksWorkflow(task)

    expect(mockActivities.transcodeVideoChunkActivity).toHaveBeenCalledWith({
      taskId: 'task-video-chunks',
      assetId: 'asset-video',
      assetKey: 'files/asset-video/proxy-720p.mp4',
      originalKey: 'files/asset-video/raw.mp4',
      startTime: 0,
      endTime: 30,
      format: 'frames',
    })
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-video-chunks',
      status: WorkflowTaskStatus.completed,
      output: {
        chunks: [
          {
            startTime: 0,
            endTime: 30,
            chunkKey: 'files/asset-video/tmp-embedding-chunks/frames-0-30.tar',
          },
        ],
      },
    })
  })

  it('should fail with non-retryable ApplicationFailure when payload is invalid', async () => {
    const task = createMockTask({
      payload: {
        projectId: 'proj-1',
      },
    })

    await expect(transcodeVideoChunksWorkflow(task)).rejects.toThrow(
      'Invalid payload for videoChunks task',
    )

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-video-chunks',
      status: WorkflowTaskStatus.failed,
      output: { error: 'Invalid payload for videoChunks task' },
    })
  })

  it('should fail fast when asset is archived and no videoTranscodes proxy is available', async () => {
    const task = createMockTask({
      payload: {
        projectId: 'proj-1',
        videoChunks: {
          assetKey: 'files/asset-video/raw.mp4',
          format: 'video',
          chunks: [{ startTime: 0, endTime: 60 }],
        },
      },
    })

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-video',
      status: 'archived',
      storageKey: { key: 'files/asset-video/raw.mp4', isArchived: true },
      mediaType: 'video/mp4',
      media: {
        videoTranscodes: [],
      },
    } as unknown as Awaited<ReturnType<typeof getAssetActivity>>)

    await expect(transcodeVideoChunksWorkflow(task)).rejects.toThrow(
      'Original video file is archived and no proxy is available. Restore the asset to generate embeddings.',
    )

    expect(mockActivities.transcodeVideoChunkActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-video-chunks',
      status: WorkflowTaskStatus.failed,
      output: {
        error:
          'Original video file is archived and no proxy is available. Restore the asset to generate embeddings.',
      },
    })
  })

  it('should clean up already-uploaded chunk files in S3 if a subsequent chunk fails', async () => {
    const task = createMockTask()

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-video',
      status: 'processed',
      storageKey: { key: 'files/asset-video/raw.mp4', isArchived: false },
      mediaType: 'video/mp4',
    } as unknown as Awaited<ReturnType<typeof getAssetActivity>>)

    mockActivities.transcodeVideoChunkActivity
      .mockResolvedValueOnce({
        chunkKey: 'files/asset-video/tmp-embedding-chunks/chunk-0-60.mp4',
      })
      .mockRejectedValueOnce(new Error('ffmpeg slice failed on chunk 2'))

    await expect(transcodeVideoChunksWorkflow(task)).rejects.toThrow(
      'ffmpeg slice failed on chunk 2',
    )

    expect(mockActivities.deleteS3ObjectActivity).toHaveBeenCalledTimes(1)
    expect(mockActivities.deleteS3ObjectActivity).toHaveBeenCalledWith({
      key: 'files/asset-video/tmp-embedding-chunks/chunk-0-60.mp4',
    })
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-video-chunks',
      status: WorkflowTaskStatus.failed,
      output: { error: 'ffmpeg slice failed on chunk 2' },
    })
  })
})
