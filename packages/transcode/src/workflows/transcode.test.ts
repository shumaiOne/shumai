import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodeMedia } from './transcode'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import {
  getAssetActivity,
  updateAssetStatusActivity,
  updateTaskStatusActivity,
} from '@shumai/workflow-core'
import {
  downloadMediaToTmpActivity,
  getMediaInfoActivity,
  renderPdfPagesActivity,
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
  getMediaInfoActivity: vi.fn(),
  renderPdfPagesActivity: vi.fn(),
}))

describe('transcodeMedia Fallback Dispatcher', () => {
  const mockActivities = {
    updateTaskStatusActivity: vi.mocked(updateTaskStatusActivity),
    updateAssetStatusActivity: vi.mocked(updateAssetStatusActivity),
    getAssetActivity: vi.mocked(getAssetActivity),
    renderPdfPagesActivity: vi.mocked(renderPdfPagesActivity),
    downloadMediaToTmpActivity: vi.mocked(downloadMediaToTmpActivity),
    getMediaInfoActivity: vi.mocked(getMediaInfoActivity),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should dispatch to pdfPages workflow when payload.pdfPages is present', async () => {
    const task: WorkflowTask = {
      id: 'task-pdf-pages',
      assetId: 'asset-pdf',
      type: WorkflowTaskType.transcode,
      status: WorkflowTaskStatus.pending,
      payload: {
        projectId: 'proj-1',
        pdfPages: {
          start: 1,
          end: 2,
        },
      },
      output: null,
      sessionId: null,
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
      id: 'asset-pdf',
      storageKey: { key: 'doc.pdf' },
      mediaType: 'application/pdf',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    mockActivities.renderPdfPagesActivity.mockResolvedValue([])

    await transcodeMedia(task)

    expect(mockActivities.renderPdfPagesActivity).toHaveBeenCalled()
  })

  it('should handle failures and update task status with error', async () => {
    const task: WorkflowTask = {
      id: 'task-fail',
      assetId: 'asset-1',
      type: WorkflowTaskType.transcode,
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
