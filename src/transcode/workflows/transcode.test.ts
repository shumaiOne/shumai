import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodeMedia } from './transcode'
import {
  WorkflowTask,
  WorkflowTaskStatus,
  WorkflowTaskType,
  AssetStatus,
} from '@/generated/prisma/client'
import * as workflowUtils from '@/workflow/workflow-utils'

vi.mock('@/workflow/workflow-utils', async (importOriginal) => {
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
        videoStrategy: 'single',
        thumbnail: true,
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

    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalled()
    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      status: AssetStatus.processed,
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: WorkflowTaskStatus.completed,
    })
  })

  it('should handle failures and update task status with error', async () => {
    const task: WorkflowTask = {
      id: 'task-fail',
      assetId: 'asset-1',
      type: WorkflowTaskType.transcode,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {},
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
})
