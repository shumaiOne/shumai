import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcode3dWorkflow } from './transcode-3d'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType, AssetStatus } from '@shumai/db'
import {
  getAssetActivity,
  updateAssetStatusActivity,
  updateTaskStatusActivity,
} from '@shumai/workflow-core'
import {
  downloadMediaToTmpActivity,
  start3dRenderActivity,
  waitFor3dVideoRenderActivity,
  generate3dSpriteActivity,
  generate3dViewsActivity,
  updateAssetMediaActivity,
  cleanupTmpDirActivity,
  createEmbeddingTaskIfEnabledActivity,
  createAutofillTaskIfEnabledActivity,
} from '../activities/transcode'

vi.mock('@shumai/workflow-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/workflow-core')>()
  return {
    ...actual,
    updateTaskStatusActivity: vi.fn(),
    updateAssetStatusActivity: vi.fn(),
    getAssetActivity: vi.fn(),
  }
})

vi.mock('../activities/transcode', () => ({
  downloadMediaToTmpActivity: vi.fn(),
  start3dRenderActivity: vi.fn(),
  waitFor3dVideoRenderActivity: vi.fn(),
  generate3dSpriteActivity: vi.fn(),
  generate3dViewsActivity: vi.fn(),
  updateAssetMediaActivity: vi.fn(),
  cleanupTmpDirActivity: vi.fn(),
  createEmbeddingTaskIfEnabledActivity: vi.fn(),
  createAutofillTaskIfEnabledActivity: vi.fn(),
}))

describe('transcode3dWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: vi.mocked(updateTaskStatusActivity),
    updateAssetStatusActivity: vi.mocked(updateAssetStatusActivity),
    getAssetActivity: vi.mocked(getAssetActivity),
    start3dRenderActivity: vi.mocked(start3dRenderActivity),
    waitFor3dVideoRenderActivity: vi.mocked(waitFor3dVideoRenderActivity),
    generate3dSpriteActivity: vi.mocked(generate3dSpriteActivity),
    generate3dViewsActivity: vi.mocked(generate3dViewsActivity),
    updateAssetMediaActivity: vi.mocked(updateAssetMediaActivity),
    downloadMediaToTmpActivity: vi.mocked(downloadMediaToTmpActivity),
    cleanupTmpDirActivity: vi.mocked(cleanupTmpDirActivity),
    createEmbeddingTaskIfEnabledActivity: vi.mocked(createEmbeddingTaskIfEnabledActivity),
    createAutofillTaskIfEnabledActivity: vi.mocked(createAutofillTaskIfEnabledActivity),
  }

  beforeEach(() => {
    vi.clearAllMocks()
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

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
      videoKey: 'files/asset-3d/turntable.mp4',
      videoFilePath: '/tmp/turntable.mp4',
      spriteKey: 'files/asset-3d/sprite.webp',
    })

    expect(mockActivities.generate3dViewsActivity).toHaveBeenCalledWith({
      taskId: 'task-3d',
      assetKey: 'files/asset-3d/robot.glb',
      videoKey: 'files/asset-3d/turntable.mp4',
      videoFilePath: '/tmp/turntable.mp4',
      viewsKey: 'files/asset-3d/views.webp',
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
          imageTranscodes: [
            {
              key: 'files/asset-3d/views.webp',
              width: 2880,
              height: 2880,
              quality: 85,
              format: 'webp',
            },
          ],
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

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
