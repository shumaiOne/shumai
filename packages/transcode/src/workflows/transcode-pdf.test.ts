import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodePdfWorkflow } from './transcode-pdf'
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

describe('transcodePdfWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    updateAssetStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateAssetStatusActivity',
    }),
    getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
    getMediaInfoActivity: Object.assign(vi.fn(), { _activityName: 'getMediaInfoActivity' }),
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
    generatePdfProxyActivity: Object.assign(vi.fn(), {
      _activityName: 'generatePdfProxyActivity',
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
      filePath: '/tmp/doc.pdf',
      tmpDir: '/tmp',
    })
    mockActivities.generatePdfProxyActivity.mockResolvedValue({
      pdfProxyKey: 'document.pdf',
      pdfFilePath: '/tmp/doc.pdf',
    })
  })

  it('should process pdf transcode and sprite generation successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-pdf',
      assetId: 'asset-pdf',
      type: WorkflowTaskType.transcode_pdf,
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
      uid: 'task-uid-pdf',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-pdf',
      storageKey: { key: 'document.pdf' },
      mediaType: 'application/pdf',
    })

    mockActivities.getMediaInfoActivity.mockResolvedValue({
      proxyType: 'pdf',
      metadata: {
        originalWidth: 800,
        originalHeight: 1000,
        duration: 0,
        frameRate: 0,
        totalFrames: 12,
        startTimecode: '00:00:00:00',
        bitRate: 0,
        hasAudio: false,
        format: {},
      },
      videoTranscodes: [],
      imageTranscodes: [],
    })

    mockActivities.generateSpriteActivity.mockResolvedValue({
      sprite: { key: 'sprite.webp', frames: 100, tileX: 10, tileY: 10 },
      poster: { key: 'poster.webp' },
    })

    await transcodePdfWorkflow(task)

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-pdf',
      status: AssetStatus.processing,
    })

    expect(mockActivities.generateSpriteActivity).toHaveBeenCalledWith({
      assetKey: 'document.pdf',
      filePath: '/tmp/doc.pdf',
      spriteSpec: expect.objectContaining({ key: 'sprite.webp' }),
      posterSpec: expect.objectContaining({ key: 'poster.webp' }),
      mediaInfo: expect.objectContaining({ proxyType: 'pdf' }),
    })

    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalledWith({
      assetId: 'asset-pdf',
      mediaInfo: expect.objectContaining({
        sprite: { key: 'sprite.webp', frames: 100, tileX: 10, tileY: 10 },
        poster: { key: 'poster.webp' },
      }),
    })

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-pdf',
      status: AssetStatus.processed,
    })

    expect(mockActivities.createAutofillTaskIfEnabledActivity).toHaveBeenCalledWith({
      assetId: 'asset-pdf',
      teamId: 'team-1',
      projectId: 'proj-1',
    })
  })

  it('records the content hash from the downloaded original, not the generated PDF proxy', async () => {
    const task = {
      id: 'task-docx',
      assetId: 'asset-docx',
      type: WorkflowTaskType.transcode_pdf,
      status: WorkflowTaskStatus.pending,
      payload: { projectId: 'proj-1', transcode: {} },
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-uid-docx',
    } as unknown as WorkflowTask

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-docx',
      name: 'report.docx',
      storageKey: { key: 'files/report.docx' },
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    // The original and the PDF generated from it live at different paths.
    mockActivities.downloadMediaToTmpActivity.mockResolvedValue({
      filePath: '/tmp/original/report.docx',
      tmpDir: '/tmp/original',
    })
    mockActivities.generatePdfProxyActivity.mockResolvedValue({
      pdfProxyKey: 'files/report.pdf',
      pdfFilePath: '/tmp/original/report.pdf',
    })
    mockActivities.getMediaInfoActivity.mockResolvedValue({
      proxyType: 'pdf',
      metadata: { originalWidth: 800, originalHeight: 1000 },
      videoTranscodes: [],
      imageTranscodes: [],
    })

    await transcodePdfWorkflow(task)

    // The hash is recorded where the original is downloaded, so the asset id travels with the download.
    expect(mockActivities.downloadMediaToTmpActivity).toHaveBeenCalledWith({
      assetKey: 'files/report.docx',
      assetId: 'asset-docx',
    })
    // Media info reads the generated PDF and must not be what the hash is taken from.
    expect(mockActivities.getMediaInfoActivity).toHaveBeenCalledWith({
      filePath: '/tmp/original/report.pdf',
      assetId: 'asset-docx',
      proxyType: 'pdf',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
  })
})
