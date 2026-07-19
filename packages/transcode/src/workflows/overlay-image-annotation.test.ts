import { describe, it, expect, vi, beforeEach } from 'vitest'
import { overlayImageAnnotationWorkflow } from './overlay-image-annotation'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
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

describe('overlayImageAnnotationWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
    getTranscodeWorkerQueueActivity: Object.assign(vi.fn(), {
      _activityName: 'getTranscodeWorkerQueueActivity',
    }),
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
  })

  it('should run image annotation overlay workflow successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-image-ann',
      assetId: 'asset-image',
      type: WorkflowTaskType.transcode_image_annotation,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
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
      'files/asset-image/annotations/ann1.webp',
    )

    await overlayImageAnnotationWorkflow(task)

    expect(mockActivities.overlayAnnotationsActivity).toHaveBeenCalledWith({
      assetKey: 'image-transcoded.webp',
      assetId: 'asset-image',
      annotations: [{ type: 'box', color: '#ff0000', points: [] }],
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-image-ann',
      status: WorkflowTaskStatus.completed,
      output: { key: 'files/asset-image/annotations/ann1.webp' },
    })
  })
})
