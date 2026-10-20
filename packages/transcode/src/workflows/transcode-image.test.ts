import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcodeImageWorkflow } from './transcode-image'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType, AssetStatus } from '@shumai/db'
import {
  getAssetActivity,
  updateAssetStatusActivity,
  updateTaskStatusActivity,
} from '@shumai/workflow-core'
import {
  downloadMediaToTmpActivity,
  getMediaInfoActivity,
  transcodeImageActivity,
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
  getMediaInfoActivity: vi.fn(),
  transcodeImageActivity: vi.fn(),
  updateAssetMediaActivity: vi.fn(),
  cleanupTmpDirActivity: vi.fn(),
  createEmbeddingTaskIfEnabledActivity: vi.fn(),
  createAutofillTaskIfEnabledActivity: vi.fn(),
}))

describe('transcodeImageWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: vi.mocked(updateTaskStatusActivity),
    updateAssetStatusActivity: vi.mocked(updateAssetStatusActivity),
    getAssetActivity: vi.mocked(getAssetActivity),
    getMediaInfoActivity: vi.mocked(getMediaInfoActivity),
    transcodeImageActivity: vi.mocked(transcodeImageActivity),
    updateAssetMediaActivity: vi.mocked(updateAssetMediaActivity),
    downloadMediaToTmpActivity: vi.mocked(downloadMediaToTmpActivity),
    cleanupTmpDirActivity: vi.mocked(cleanupTmpDirActivity),
    createEmbeddingTaskIfEnabledActivity: vi.mocked(createEmbeddingTaskIfEnabledActivity),
    createAutofillTaskIfEnabledActivity: vi.mocked(createAutofillTaskIfEnabledActivity),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockActivities.downloadMediaToTmpActivity.mockResolvedValue({
      filePath: '/tmp/image.jpg',
      tmpDir: '/tmp',
    })
  })

  it('should process image transcode and thumbnail successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-image',
      assetId: 'asset-image',
      type: WorkflowTaskType.transcode_image,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
      output: null,
      payload: {
        projectId: 'proj-1',
        transcode: {
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
      id: 'asset-image',
      storageKey: { key: 'image.jpg' },
      mediaType: 'image/jpeg',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    mockActivities.getMediaInfoActivity.mockResolvedValue({
      proxyType: 'image',
      metadata: {
        originalWidth: 1000,
        originalHeight: 1000,
        duration: 0,
        frameRate: 0,
        totalFrames: 0,
        startTimecode: '00:00:00:00',
        bitRate: 0,
        hasAudio: false,
        format: {},
      },
      videoTranscodes: [],
      imageTranscodes: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    mockActivities.transcodeImageActivity.mockResolvedValue({
      key: 't.webp',
      width: 300,
      height: 300,
      quality: 80,
      format: 'webp',
    })

    await transcodeImageWorkflow(task)

    expect(mockActivities.getMediaInfoActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        assetKey: 'image.jpg',
        filePath: '/tmp/image.jpg',
      }),
    )

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      status: AssetStatus.processing,
    })

    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      mediaInfo: expect.objectContaining({
        thumbnail: expect.objectContaining({
          key: 't.webp',
          width: 300,
          height: 300,
        }),
      }),
    })

    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      status: AssetStatus.processed,
    })

    expect(mockActivities.createEmbeddingTaskIfEnabledActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      teamId: 'team-1',
      projectId: 'proj-1',
    })

    expect(mockActivities.createAutofillTaskIfEnabledActivity).toHaveBeenCalledWith({
      assetId: 'asset-image',
      teamId: 'team-1',
      projectId: 'proj-1',
    })
  })

  it('should handle RAW image without usable preview by skipping transcodes and marking processed', async () => {
    const task: WorkflowTask = {
      id: 'task-raw-nopreview',
      assetId: 'asset-raw',
      type: WorkflowTaskType.transcode_image,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
      output: null,
      payload: {
        projectId: 'proj-1',
        transcode: {
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
      id: 'asset-raw',
      storageKey: { key: 'photo.cr2' },
      mediaType: 'image/x-canon-cr2',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // RAW file without usable preview returns originalWidth: 0, originalHeight: 0
    mockActivities.getMediaInfoActivity.mockResolvedValue({
      proxyType: 'image',
      metadata: {
        originalWidth: 0,
        originalHeight: 0,
        duration: 0,
        frameRate: 0,
        totalFrames: 0,
        startTimecode: undefined,
        bitRate: 0,
        hasAudio: false,
        format: {},
      },
      videoTranscodes: [],
      imageTranscodes: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    await transcodeImageWorkflow(task)

    // transcodeImageActivity should NOT be called since hasUsablePreview is false
    expect(mockActivities.transcodeImageActivity).not.toHaveBeenCalled()

    // Asset media should still be updated
    expect(mockActivities.updateAssetMediaActivity).toHaveBeenCalledWith({
      assetId: 'asset-raw',
      mediaInfo: expect.objectContaining({
        imageTranscodes: [],
      }),
    })

    // Asset should still be marked as processed
    expect(mockActivities.updateAssetStatusActivity).toHaveBeenCalledWith({
      assetId: 'asset-raw',
      status: AssetStatus.processed,
    })
  })
})
