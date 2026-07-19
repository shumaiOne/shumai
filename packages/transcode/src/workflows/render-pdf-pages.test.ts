import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderPdfPagesWorkflow } from './render-pdf-pages'
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

describe('renderPdfPagesWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
    getTranscodeWorkerQueueActivity: Object.assign(vi.fn(), {
      _activityName: 'getTranscodeWorkerQueueActivity',
    }),
    renderPdfPagesActivity: Object.assign(vi.fn(), {
      _activityName: 'renderPdfPagesActivity',
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
    })

    mockActivities.renderPdfPagesActivity.mockResolvedValue([
      { key: 'pdf_pages/doc-page-1.webp', page: 1 },
      { key: 'pdf_pages/doc-page-2.webp', page: 2 },
    ])

    await renderPdfPagesWorkflow(task)

    expect(mockActivities.renderPdfPagesActivity).toHaveBeenCalledWith({
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
