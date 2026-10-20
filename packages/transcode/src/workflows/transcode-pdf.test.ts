import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodePdfWorkflow } from './transcode-pdf'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType, AssetStatus } from '@shumai/db'
import {
  getAssetActivity,
  updateAssetStatusActivity,
  updateTaskStatusActivity,
} from '@shumai/workflow-core'
import {
  downloadMediaToTmpActivity,
  generatePdfProxyActivity,
  getMediaInfoActivity,
  generateSpriteActivity,
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
  generatePdfProxyActivity: vi.fn(),
  getMediaInfoActivity: vi.fn(),
  generateSpriteActivity: vi.fn(),
  updateAssetMediaActivity: vi.fn(),
  cleanupTmpDirActivity: vi.fn(),
  createEmbeddingTaskIfEnabledActivity: vi.fn(),
  createAutofillTaskIfEnabledActivity: vi.fn(),
}))

describe('transcodePdfWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: vi.mocked(updateTaskStatusActivity),
    updateAssetStatusActivity: vi.mocked(updateAssetStatusActivity),
    getAssetActivity: vi.mocked(getAssetActivity),
    getMediaInfoActivity: vi.mocked(getMediaInfoActivity),
    generateSpriteActivity: vi.mocked(generateSpriteActivity),
    updateAssetMediaActivity: vi.mocked(updateAssetMediaActivity),
    downloadMediaToTmpActivity: vi.mocked(downloadMediaToTmpActivity),
    generatePdfProxyActivity: vi.mocked(generatePdfProxyActivity),
    cleanupTmpDirActivity: vi.mocked(cleanupTmpDirActivity),
    createEmbeddingTaskIfEnabledActivity: vi.mocked(createEmbeddingTaskIfEnabledActivity),
    createAutofillTaskIfEnabledActivity: vi.mocked(createAutofillTaskIfEnabledActivity),
  }

  beforeEach(() => {
    vi.clearAllMocks()
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    mockActivities.generateSpriteActivity.mockResolvedValue({
      sprite: { key: 'sprite.webp', frames: 100, tileX: 10, tileY: 10 },
      poster: { key: 'poster.webp' },
    })

    await transcodePdfWorkflow(task)

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-pdf',
      status: AssetStatus.processing,
    })

    expect(mockActivities.getMediaInfoActivity).toHaveBeenCalledWith({
      assetKey: 'document.pdf',
      filePath: '/tmp/doc.pdf',
      assetId: 'asset-pdf',
      proxyType: 'pdf',
      mediaType: 'application/pdf',
    })

    expect(mockActivities.generateSpriteActivity).toHaveBeenCalledWith({
      assetKey: 'document.pdf',
      inputKey: 'document.pdf',
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
})
