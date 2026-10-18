import { describe, it, expect, vi, beforeEach } from 'vitest'
import { overlayImageAnnotationWorkflow } from './overlay-image-annotation'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import { getAssetActivity, updateTaskStatusActivity } from '@shumai/workflow-core'
import { overlayAnnotationsActivity } from '../activities/transcode'

vi.mock('@shumai/workflow-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/workflow-core')>()
  return {
    ...actual,
    updateTaskStatusActivity: vi.fn(),
    getAssetActivity: vi.fn(),
  }
})

vi.mock('../activities/transcode', () => ({
  overlayAnnotationsActivity: vi.fn(),
}))

describe('overlayImageAnnotationWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: vi.mocked(updateTaskStatusActivity),
    getAssetActivity: vi.mocked(getAssetActivity),
    overlayAnnotationsActivity: vi.mocked(overlayAnnotationsActivity),
  }

  beforeEach(() => {
    vi.clearAllMocks()
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

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
