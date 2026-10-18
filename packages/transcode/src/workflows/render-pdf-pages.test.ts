import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderPdfPagesWorkflow } from './render-pdf-pages'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import { getAssetActivity, updateTaskStatusActivity } from '@shumai/workflow-core'
import { renderPdfPagesActivity } from '../activities/transcode'

vi.mock('@shumai/workflow-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/workflow-core')>()
  return {
    ...actual,
    updateTaskStatusActivity: vi.fn(),
    getAssetActivity: vi.fn(),
  }
})

vi.mock('../activities/transcode', () => ({
  renderPdfPagesActivity: vi.fn(),
}))

describe('renderPdfPagesWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: vi.mocked(updateTaskStatusActivity),
    getAssetActivity: vi.mocked(getAssetActivity),
    renderPdfPagesActivity: vi.mocked(renderPdfPagesActivity),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should run renderPdfPagesWorkflow successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-pdf-pages',
      assetId: 'asset-pdf',
      type: WorkflowTaskType.transcode_pdf_pages,
      status: WorkflowTaskStatus.pending,
      payload: {
        projectId: 'proj-1',
        pdfPages: {
          start: 1,
          end: 2,
          commentTimestamp: 2,
          annotations: [],
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

    mockActivities.renderPdfPagesActivity.mockResolvedValue([
      { key: 'pdf_pages/doc-page-1.webp', page: 1 },
      { key: 'pdf_pages/doc-page-2.webp', page: 2 },
    ])

    await renderPdfPagesWorkflow(task)

    expect(mockActivities.renderPdfPagesActivity).toHaveBeenCalledWith({
      taskId: 'task-pdf-pages',
      assetKey: 'doc.pdf',
      assetId: 'asset-pdf',
      start: 1,
      end: 2,
      commentTimestamp: 2,
      annotations: [],
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-pdf-pages',
      status: WorkflowTaskStatus.completed,
      output: {
        pages: [
          { key: 'pdf_pages/doc-page-1.webp', page: 1 },
          { key: 'pdf_pages/doc-page-2.webp', page: 2 },
        ],
      },
    })
  })
})
