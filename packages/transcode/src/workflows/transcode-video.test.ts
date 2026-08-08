import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodeVideoWorkflow } from './transcode-video'
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

describe('transcodeVideoWorkflow', () => {
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
    transcodeAudioActivity: Object.assign(vi.fn(), { _activityName: 'transcodeAudioActivity' }),
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
    createEmbeddingTaskIfEnabledActivity: Object.assign(vi.fn(), {
      _activityName: 'createEmbeddingTaskIfEnabledActivity',
    }),
    createAutofillTaskIfEnabledActivity: Object.assign(vi.fn(), {
      _activityName: 'createAutofillTaskIfEnabledActivity',
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
      type: WorkflowTaskType.transcode_video,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
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
      proxyType: 'video',
      metadata: {
        originalWidth: 1920,
        originalHeight: 1080,
        duration: 10,
        frameRate: 30,
        totalFrames: 300,
        startTimecode: '00:00:00:00',
        bitRate: 1000,
        hasAudio: false,
        format: {},
      },
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
      width: 300,
      height: 169,
    })

    await transcodeVideoWorkflow(task)

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

    expect(mockActivities.createEmbeddingTaskIfEnabledActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      teamId: 'team-1',
      projectId: 'proj-1',
    })

    expect(mockActivities.createAutofillTaskIfEnabledActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      teamId: 'team-1',
      projectId: 'proj-1',
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: WorkflowTaskStatus.completed,
    })
  })

  it('should run audio transcoding workflow successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-audio',
      assetId: 'asset-audio',
      type: WorkflowTaskType.transcode_video,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
      output: null,
      payload: {
        projectId: 'proj-1',
        transcode: {},
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-uid-2',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-audio',
      storageKey: { key: 'audio.wav' },
      mediaType: 'audio/wav',
    })

    mockActivities.getMediaInfoActivity.mockResolvedValue({
      proxyType: 'audio',
      metadata: {
        originalWidth: 0,
        originalHeight: 0,
        duration: 30,
        bitRate: 1411200,
        frameRate: 0,
        totalFrames: 0,
        hasAudio: true,
        audioCodec: 'pcm_s16le',
        audioChannels: 2,
      },
      original: {
        key: 'audio.wav',
        filesizeInBytes: 0,
        codec: '',
      },
      videoTranscodes: [],
    })

    mockActivities.transcodeAudioActivity.mockResolvedValue({
      width: 0,
      height: 0,
      key: 'files/asset-audio/audio-audio-proxy.mp4',
    })

    await transcodeVideoWorkflow(task)

    expect(mockActivities.transcodeAudioActivity).toHaveBeenCalledWith({
      assetKey: 'audio.wav',
      filePath: '/tmp/video.mp4',
    })

    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalledWith({
      assetId: 'asset-audio',
      mediaInfo: expect.objectContaining({
        proxyType: 'audio',
        videoTranscodes: [
          {
            width: 0,
            height: 0,
            key: 'files/asset-audio/audio-audio-proxy.mp4',
          },
        ],
      }),
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-audio',
      status: WorkflowTaskStatus.completed,
    })
  })
})
