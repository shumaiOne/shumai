import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentAutofillMedia } from './agent-autofill'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import * as workflowUtils from '@shumai/workflow-core'

vi.mock('@shumai/workflow-core', async () => {
  const actual = await vi.importActual('@shumai/workflow-core')
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
  }
})

describe('Agent Autofill Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateTaskStatusActivity: Object.assign(vi.fn(), {
        _activityName: 'updateTaskStatusActivity',
      }),
      getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
      extractAiMetadataActivity: Object.assign(vi.fn(), {
        _activityName: 'extractAiMetadataActivity',
      }),
      getProjectAutofillFieldsActivity: Object.assign(vi.fn(), {
        _activityName: 'getProjectAutofillFieldsActivity',
      }),
      getAgentAutofillContextActivity: Object.assign(vi.fn(), {
        _activityName: 'getAgentAutofillContextActivity',
      }),
      autofillAiActivity: Object.assign(vi.fn(), { _activityName: 'autofillAiActivity' }),
      updateTaskUsageActivity: Object.assign(vi.fn(), { _activityName: 'updateTaskUsageActivity' }),
      updateAssetMetadataActivity: Object.assign(vi.fn(), {
        _activityName: 'updateAssetMetadataActivity',
      }),
      createCommentActivity: Object.assign(vi.fn(), { _activityName: 'createCommentActivity' }),
      updateCommentActivity: Object.assign(vi.fn(), { _activityName: 'updateCommentActivity' }),
      getTranscodeWorkerQueueActivity: Object.assign(vi.fn(), {
        _activityName: 'getTranscodeWorkerQueueActivity',
      }),
      getAgentWorkerQueueActivity: Object.assign(vi.fn(), {
        _activityName: 'getAgentWorkerQueueActivity',
      }),
      downloadMediaToTmpActivity: Object.assign(vi.fn(), {
        _activityName: 'downloadMediaToTmpActivity',
      }),
      cleanupTmpDirActivity: Object.assign(vi.fn(), { _activityName: 'cleanupTmpDirActivity' }),
    }

    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
    mockActivities.getTranscodeWorkerQueueActivity.mockResolvedValue('transcode_queue')
    mockActivities.updateTaskStatusActivity.mockResolvedValue({})
    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a1',
      storageKey: { key: 'asset-key' },
      project: { id: 'p1', teamId: 't1' },
      mediaType: 'image/png',
    })
    mockActivities.downloadMediaToTmpActivity.mockResolvedValue({
      filePath: '/tmp/test.png',
      tmpDir: '/tmp/test-dir',
    })
    mockActivities.extractAiMetadataActivity.mockResolvedValue(['/tmp/test-dir/1.webp'])
    mockActivities.getProjectAutofillFieldsActivity.mockResolvedValue([
      { key: 'title', config: { name: 'Title', type: 'text' }, description: 'The title' },
    ])
    mockActivities.getAgentAutofillContextActivity.mockResolvedValue({ agent: { id: 'b1' } })
    mockActivities.autofillAiActivity.mockResolvedValue({
      text: '{"title":"Extracted Title"}',
      sessionId: 'session-123',
      usage: { inputTokens: 10, outputTokens: 15, model: 'gemini-model' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities contains vi.fn mock functions which are cast to expected activity proxy types
    vi.mocked(workflowUtils.getActivities).mockReturnValue(mockActivities as any)
    vi.mocked(workflowUtils.executeActivity).mockImplementation(async (_queue, act, ...args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- act is one of the mocked activities
      return (act as any)(...args)
    })
  })

  it('should run agent autofill workflow successfully', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { sessionId: 's1', agentId: 'agent-1' },
        },
      },
    })

    await agentAutofillMedia(task)

    // Verify queue discovery
    expect(mockActivities.getAgentWorkerQueueActivity).toHaveBeenCalled()
    expect(mockActivities.getTranscodeWorkerQueueActivity).toHaveBeenCalled()

    // Verify task processing status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
    })

    // Verify placeholder comment created
    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: '__AUTOFILL__',
      sessionId: 's1',
      agentId: 'agent-1',
    })

    // Verify download, extraction and fields fetched
    expect(mockActivities.downloadMediaToTmpActivity).toHaveBeenCalledWith({
      assetKey: 'asset-key',
    })
    expect(mockActivities.extractAiMetadataActivity).toHaveBeenCalledWith({
      assetKey: 'asset-key',
      filePath: '/tmp/test.png',
      type: 'autofill',
      isImage: true,
    })
    expect(mockActivities.getProjectAutofillFieldsActivity).toHaveBeenCalledWith('p1')
    expect(mockActivities.getAgentAutofillContextActivity).toHaveBeenCalledWith({
      teamId: 't1',
    })

    // Verify AI autofill called with mapped fields
    expect(mockActivities.autofillAiActivity).toHaveBeenCalledWith({
      teamId: 't1',
      images: ['/tmp/test-dir/1.webp'],
      fields: [
        {
          id: 'title',
          config: { name: 'Title', type: 'text' },
          description: 'The title',
        },
      ],
      context: { agent: { id: 'b1' } },
    })

    // Verify task usage update
    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: task.id,
      inputTokens: 10,
      outputTokens: 15,
      model: 'gemini-model',
    })

    // Verify metadata updated on asset
    expect(mockActivities.updateAssetMetadataActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      metadata: [
        {
          key: 'title',
          value: 'Extracted Title',
        },
      ],
    })

    // Verify placeholder comment updated
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Autofill completed successfully.',
      sessionId: 'session-123',
    })

    // Verify cleanup was called
    expect(mockActivities.cleanupTmpDirActivity).toHaveBeenCalledWith({
      tmpDir: '/tmp/test-dir',
    })

    // Verify completed task status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should complete early if no image files could be extracted', async () => {
    mockActivities.extractAiMetadataActivity.mockResolvedValue([])

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await agentAutofillMedia(task)

    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Autofill completed: No images could be extracted for analysis.',
    })

    expect(mockActivities.autofillAiActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateAssetMetadataActivity).not.toHaveBeenCalled()

    // Verify cleanup still runs
    expect(mockActivities.cleanupTmpDirActivity).toHaveBeenCalledWith({
      tmpDir: '/tmp/test-dir',
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should complete early if no autofill fields are defined in the project', async () => {
    mockActivities.getProjectAutofillFieldsActivity.mockResolvedValue([])

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await agentAutofillMedia(task)

    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Autofill completed: No autofill fields defined in project.',
    })

    expect(mockActivities.autofillAiActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateAssetMetadataActivity).not.toHaveBeenCalled()

    // Verify cleanup still runs
    expect(mockActivities.cleanupTmpDirActivity).toHaveBeenCalledWith({
      tmpDir: '/tmp/test-dir',
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should handle failures, update placeholder with error, set status to failed, and cleanup tmp directory', async () => {
    mockActivities.getProjectAutofillFieldsActivity.mockRejectedValue(new Error('DB failure'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await expect(agentAutofillMedia(task)).rejects.toThrow('DB failure')

    // Verify placeholder updated with error
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Autofill failed: DB failure',
    })

    // Verify task failed status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'DB failure' },
    })

    // Verify cleanup still runs in finally block
    expect(mockActivities.cleanupTmpDirActivity).toHaveBeenCalledWith({
      tmpDir: '/tmp/test-dir',
    })
  })
})
