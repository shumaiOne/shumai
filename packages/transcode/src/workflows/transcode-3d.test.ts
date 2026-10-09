import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcode3dWorkflow } from './transcode-3d'
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

describe('transcode3dWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    updateAssetStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateAssetStatusActivity',
    }),
    getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
    render3dModelActivity: Object.assign(vi.fn(), { _activityName: 'render3dModelActivity' }),
    start3dRenderActivity: Object.assign(vi.fn(), { _activityName: 'start3dRenderActivity' }),
    waitFor3dVideoRenderActivity: Object.assign(vi.fn(), {
      _activityName: 'waitFor3dVideoRenderActivity',
    }),
    generate3dSpriteActivity: Object.assign(vi.fn(), { _activityName: 'generate3dSpriteActivity' }),
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
      filePath: '/tmp/model.glb',
      tmpDir: '/tmp',
    })
  })

  it('should process 3D model transcode successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-3d',
      assetId: 'asset-3d',
      type: WorkflowTaskType.transcode_3d,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
      output: null,
      payload: {
        projectId: 'proj-1',
        transcode: {
          sprite: true,
          poster: true,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-uid-3d',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-3d',
      name: 'robot.glb',
      storageKey: { key: 'files/asset-3d/robot.glb' },
      mediaType: 'model/gltf-binary',
      sizeByte: BigInt(1024),
    })

    mockActivities.start3dRenderActivity.mockResolvedValue({
      renderTaskId: 'task_render_1',
      posterFilePath: '/tmp/poster.webp',
      posterWidth: 1080,
      posterHeight: 1080,
      modelMetadata: { format: 'glb' },
    })

    mockActivities.waitFor3dVideoRenderActivity.mockResolvedValue({
      videoFilePath: '/tmp/turntable.mp4',
    })

    mockActivities.generate3dSpriteActivity.mockResolvedValue({
      spriteKey: 'files/asset-3d/sprite.webp',
    })

    await transcode3dWorkflow(task)

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-3d',
      status: AssetStatus.processing,
    })

    expect(mockActivities.start3dRenderActivity).toHaveBeenCalledWith({
      taskId: 'task-3d',
      teamId: 'team-1',
      assetId: 'asset-3d',
      assetKey: 'files/asset-3d/robot.glb',
      filePath: '/tmp/model.glb',
      filename: 'robot.glb',
      targetPosterKey: 'files/asset-3d/poster.webp',
    })

    // Verify initial updateAssetMediaActivity with poster was called before waitFor3dVideoRenderActivity
    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'asset-3d',
        mediaInfo: expect.objectContaining({
          proxyType: '3d',
          poster: { key: 'files/asset-3d/poster.webp' },
          metadata: expect.objectContaining({
            format: { format: 'glb' },
            originalHeight: 1080,
            originalWidth: 1080,
          }),
        }),
      }),
    )

    const firstMediaUpdateOrder =
      mockActivities.updateAssetMediaActivity.mock.invocationCallOrder[0]
    const waitVideoOrder = mockActivities.waitFor3dVideoRenderActivity.mock.invocationCallOrder[0]
    expect(firstMediaUpdateOrder).toBeLessThan(waitVideoOrder)

    expect(mockActivities.waitFor3dVideoRenderActivity).toHaveBeenCalledWith({
      taskId: 'task-3d',
      teamId: 'team-1',
      assetKey: 'files/asset-3d/robot.glb',
      renderTaskId: 'task_render_1',
      targetVideoKey: 'files/asset-3d/turntable.mp4',
      tmpDir: '/tmp',
    })

    expect(mockActivities.generate3dSpriteActivity).toHaveBeenCalledWith({
      taskId: 'task-3d',
      assetKey: 'files/asset-3d/robot.glb',
      videoFilePath: '/tmp/turntable.mp4',
      spriteKey: 'files/asset-3d/sprite.webp',
    })

    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'asset-3d',
        mediaInfo: expect.objectContaining({
          proxyType: '3d',
          duration: 4,
          frames: 24,
          poster: { key: 'files/asset-3d/poster.webp' },
          sprite: expect.objectContaining({ key: 'files/asset-3d/sprite.webp' }),
        }),
      }),
    )

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-3d',
      status: AssetStatus.processed,
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-3d',
        status: WorkflowTaskStatus.completed,
      }),
    )

    expect(mockActivities.cleanupTmpDirActivity).toHaveBeenCalledWith({
      tmpDir: '/tmp',
    })
  })

  it('should fail task when render activity fails', async () => {
    const task: WorkflowTask = {
      id: 'task-3d-fail',
      assetId: 'asset-3d-fail',
      type: WorkflowTaskType.transcode_3d,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
      output: null,
      payload: {
        projectId: 'proj-1',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-uid-3d-fail',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-3d-fail',
      name: 'corrupt.glb',
      storageKey: { key: 'files/corrupt.glb' },
      mediaType: 'model/gltf-binary',
      sizeByte: BigInt(512),
    })

    mockActivities.start3dRenderActivity.mockRejectedValue(new Error('Renderer crashed'))

    await expect(transcode3dWorkflow(task)).rejects.toThrow('Renderer crashed')

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-3d-fail',
        status: WorkflowTaskStatus.failed,
      }),
    )
    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'asset-3d-fail',
        status: AssetStatus.failed,
      }),
    )
  })
})
