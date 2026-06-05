import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodeMedia } from './transcode'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType, AssetStatus } from '@shumai/db'
import * as workflowUtils from '@shumai/workflow-core'

vi.mock('@shumai/workflow-core', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
    sleep: vi.fn(),
  }
})

describe('Transcode Workflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    updateAssetStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateAssetStatusActivity',
    }),
    getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
    getMediaInfoActivity: Object.assign(vi.fn(), { _activityName: 'getMediaInfoActivity' }),
    transcodeVideoActivity: Object.assign(vi.fn(), { _activityName: 'transcodeVideoActivity' }),
    transcodeImageActivity: Object.assign(vi.fn(), { _activityName: 'transcodeImageActivity' }),
    generateSpriteActivity: Object.assign(vi.fn(), { _activityName: 'generateSpriteActivity' }),
    updateAssetMediaActivity: Object.assign(vi.fn(), {
      _activityName: 'updateAssetMediaActivity',
    }),
    getTranscodeWorkerQueueActivity: Object.assign(vi.fn(), {
      _activityName: 'getTranscodeWorkerQueueActivity',
    }),
    downloadMediaToTmpActivity: Object.assign(vi.fn(), {
      _activityName: 'downloadMediaToTmpActivity',
    }),
    cleanupTmpDirActivity: Object.assign(vi.fn(), { _activityName: 'cleanupTmpDirActivity' }),
    takeScreenshotsActivity: Object.assign(vi.fn(), { _activityName: 'takeScreenshotsActivity' }),
    overlayAnnotationsActivity: Object.assign(vi.fn(), {
      _activityName: 'overlayAnnotationsActivity',
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(workflowUtils.getActivities as any).mockReturnValue(mockActivities)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(workflowUtils.executeActivity as any).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_queue: string, fn: any, ...args: any[]) => {
        if (typeof fn !== 'function') {
          throw new Error(`fn is not a function in executeActivity. Queue: ${_queue}`)
        }
        return fn(...args)
      },
    )

    mockActivities.getTranscodeWorkerQueueActivity.mockResolvedValue('transcode_worker_queue')
    mockActivities.downloadMediaToTmpActivity.mockResolvedValue({
      filePath: '/tmp/video.mp4',
      tmpDir: '/tmp',
    })
  })

  it('should process video transcode successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-1',
      assetId: 'asset-1',
      type: WorkflowTaskType.transcode,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {
        projectId: 'proj-1',
        transcode: {
          videoStrategy: 'best_match',
          thumbnail: true,
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
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-1',
      storageKey: { key: 'video.mp4' },
      mediaType: 'video/mp4',
    })

    mockActivities.getMediaInfoActivity.mockResolvedValue({
      mimeType: 'video/mp4',
      metadata: { originalWidth: 1920, originalHeight: 1080, duration: 10, frameRate: 30 },
      videoTranscodes: [],
      imageTranscodes: [],
    })

    mockActivities.transcodeVideoActivity.mockResolvedValue({
      key: 'v.mp4',
      width: 1920,
      height: 1080,
    })
    mockActivities.transcodeImageActivity.mockResolvedValue({
      key: 't.webp',
      width: 480,
      height: 270,
    })

    await transcodeMedia(task)

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      status: AssetStatus.processing,
    })

    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      mediaInfo: expect.objectContaining({
        thumbnail: expect.objectContaining({
          key: 't.webp',
        }),
      }),
    })
    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      status: AssetStatus.processed,
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: WorkflowTaskStatus.completed,
    })
  })

  it('should process image transcode and thumbnail successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-image',
      assetId: 'asset-image',
      type: WorkflowTaskType.transcode,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {
        projectId: 'proj-1',
        transcode: {
          thumbnail: true,
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
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-image',
      storageKey: { key: 'image.jpg' },
      mediaType: 'image/jpeg',
    })

    mockActivities.getMediaInfoActivity.mockResolvedValue({
      mimeType: 'image/jpeg',
      metadata: { originalWidth: 1000, originalHeight: 1000 },
      videoTranscodes: [],
      imageTranscodes: [],
    })

    mockActivities.transcodeImageActivity.mockResolvedValue({
      key: 't.webp',
      width: 480,
      height: 480,
      format: 'webp',
    })

    await transcodeMedia(task)

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      status: AssetStatus.processing,
    })

    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      mediaInfo: expect.objectContaining({
        thumbnail: expect.objectContaining({
          key: 't.webp',
          width: 480,
          height: 480,
        }),
      }),
    })
    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      status: AssetStatus.processed,
    })
  })

  it('should handle failures and update task status with error', async () => {
    const task: WorkflowTask = {
      id: 'task-fail',
      assetId: 'asset-1',
      type: WorkflowTaskType.transcode,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {
        projectId: 'proj-1',
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
    }

    mockActivities.getAssetActivity.mockRejectedValue(new Error('FFmpeg failed'))

    await expect(transcodeMedia(task)).rejects.toThrow('FFmpeg failed')

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-fail',
      status: WorkflowTaskStatus.failed,
      output: { error: 'FFmpeg failed' },
    })
  })

  it('should run screenshot workflow successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-screenshot',
      assetId: 'asset-video',
      type: WorkflowTaskType.transcode,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {
        projectId: 'proj-1',
        screenshot: {
          start: 0,
          end: 10,
          count: 2,
          commentTimestamp: 5.0,
          annotations: [],
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
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-video',
      storageKey: { key: 'video.mp4' },
      mediaType: 'video/mp4',
    })

    mockActivities.takeScreenshotsActivity.mockResolvedValue([
      { key: 'file/asset-video/screenshots/shot1.webp', timestamp: 0.0 },
      { key: 'file/asset-video/screenshots/shot2.webp', timestamp: 5.0 },
    ])

    await transcodeMedia(task)

    expect(mockActivities.takeScreenshotsActivity).toHaveBeenCalledWith({
      assetKey: 'video.mp4',
      assetId: 'asset-video',
      start: 0,
      end: 10,
      count: 2,
      commentTimestamp: 5.0,
      annotations: [],
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-screenshot',
      status: WorkflowTaskStatus.completed,
      output: {
        screenshots: [
          { key: 'file/asset-video/screenshots/shot1.webp', timestamp: 0.0 },
          { key: 'file/asset-video/screenshots/shot2.webp', timestamp: 5.0 },
        ],
      },
    })
  })

  it('should run image annotation overlay workflow successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-image-ann',
      assetId: 'asset-image',
      type: WorkflowTaskType.transcode,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {
        projectId: 'proj-1',
        imageAnnotation: {
          annotations: [{ type: 'box', color: '#ff0000', points: [] }],
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
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-image',
      storageKey: { key: 'image.png' },
      mediaType: 'image/png',
      media: {
        imageTranscodes: [{ key: 'image-transcoded.webp' }],
      },
    })

    mockActivities.overlayAnnotationsActivity.mockResolvedValue(
      'file/asset-image/annotations/ann1.webp',
    )

    await transcodeMedia(task)

    expect(mockActivities.overlayAnnotationsActivity).toHaveBeenCalledWith({
      assetKey: 'image-transcoded.webp',
      assetId: 'asset-image',
      annotations: [{ type: 'box', color: '#ff0000', points: [] }],
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-image-ann',
      status: WorkflowTaskStatus.completed,
      output: { key: 'file/asset-image/annotations/ann1.webp' },
    })
  })
})
