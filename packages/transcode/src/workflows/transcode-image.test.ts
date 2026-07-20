import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodeImageWorkflow } from './transcode-image'
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

describe('transcodeImageWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    updateAssetStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateAssetStatusActivity',
    }),
    getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
    getMediaInfoActivity: Object.assign(vi.fn(), { _activityName: 'getMediaInfoActivity' }),
    transcodeImageActivity: Object.assign(vi.fn(), { _activityName: 'transcodeImageActivity' }),
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
    createEmbeddingTaskIfEnabledActivity: Object.assign(vi.fn(), {
      _activityName: 'createEmbeddingTaskIfEnabledActivity',
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
      filePath: '/tmp/image.jpg',
      tmpDir: '/tmp',
    })
  })

  it('should process image transcode and thumbnail successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-image',
      assetId: 'asset-image',
      type: WorkflowTaskType.transcode_image,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
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
      proxyType: 'image',
      metadata: {
        originalWidth: 1000,
        originalHeight: 1000,
        duration: 0,
        frameRate: 0,
        totalFrames: 0,
        startTimecode: '00:00:00:00',
        bitRate: 0,
        hasAudio: false,
        format: {},
      },
      videoTranscodes: [],
      imageTranscodes: [],
    })

    mockActivities.transcodeImageActivity.mockResolvedValue({
      key: 't.webp',
      width: 480,
      height: 480,
      format: 'webp',
    })

    await transcodeImageWorkflow(task)

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

    expect(mockActivities.createEmbeddingTaskIfEnabledActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      teamId: 'team-1',
      projectId: 'proj-1',
    })
  })
})
