import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentAutofillMedia } from './agent-autofill'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import * as workflowCore from '@shumai/workflow-core'
import { DBOSError } from '@shumai/workflow-core'
import * as agentActivities from '../activities/agent'

vi.mock('@shumai/workflow-core', async () => {
  const actual = await vi.importActual('@shumai/workflow-core')
  return {
    ...actual,
    updateTaskStatusActivity: vi.fn(),
    updateTaskUsageActivity: vi.fn(),
  }
})

vi.mock('../activities/agent', async () => {
  const actual = await vi.importActual('../activities/agent')
  return {
    ...actual,
    getAssetActivity: vi.fn(),
    getProjectAutofillFieldsActivity: vi.fn(),
    getAgentAutofillContextActivity: vi.fn(),
    autofillAiActivity: vi.fn(),
    updateAssetMetadataActivity: vi.fn(),
    createCommentActivity: vi.fn(),
    updateCommentActivity: vi.fn(),
  }
})

describe('Agent Autofill Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateTaskStatusActivity: vi.mocked(workflowCore.updateTaskStatusActivity),
      getAssetActivity: vi.mocked(agentActivities.getAssetActivity),
      getProjectAutofillFieldsActivity: vi.mocked(agentActivities.getProjectAutofillFieldsActivity),
      getAgentAutofillContextActivity: vi.mocked(agentActivities.getAgentAutofillContextActivity),
      autofillAiActivity: vi.mocked(agentActivities.autofillAiActivity),
      updateTaskUsageActivity: vi.mocked(workflowCore.updateTaskUsageActivity),
      updateAssetMetadataActivity: vi.mocked(agentActivities.updateAssetMetadataActivity),
      createCommentActivity: vi.mocked(agentActivities.createCommentActivity),
      updateCommentActivity: vi.mocked(agentActivities.updateCommentActivity),
    }

    mockActivities.updateTaskStatusActivity.mockResolvedValue({})
    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a1',
      name: 'test.png',
      projectId: 'p1',
      storageKey: { key: 'asset-key' },
      project: { id: 'p1', teamId: 't1' },
      mediaType: 'image/png',
      media: { proxyType: 'image', duration: 10 },
    })
    mockActivities.getProjectAutofillFieldsActivity.mockResolvedValue([
      { key: 'title', config: { name: 'Title', type: 'text' }, description: 'The title' },
    ])
    mockActivities.getAgentAutofillContextActivity.mockResolvedValue({ agent: { id: 'b1' } })
    mockActivities.autofillAiActivity.mockResolvedValue({
      text: '{"title":"Extracted Title"}',
      sessionId: 'session-123',
      usage: { inputTokens: 10, outputTokens: 15, model: 'gemini-model' },
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

    // Verify task processing status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
    })

    // Verify asset fetched
    expect(mockActivities.getAssetActivity).toHaveBeenCalledWith('a1')

    // Verify no success or placeholder comments created
    expect(mockActivities.createCommentActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateCommentActivity).not.toHaveBeenCalled()

    // Verify fields and context fetched
    expect(mockActivities.getProjectAutofillFieldsActivity).toHaveBeenCalledWith('p1')
    expect(mockActivities.getAgentAutofillContextActivity).toHaveBeenCalledWith({
      teamId: 't1',
    })

    // Verify AI autofill called with asset details and mapped fields
    expect(mockActivities.autofillAiActivity).toHaveBeenCalledWith({
      teamId: 't1',
      assetId: 'a1',
      assetName: 'test.png',
      mediaType: 'image/png',
      duration: undefined,
      pageCount: undefined,
      projectId: 'p1',
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

    // Verify completed task status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should pass pageCount for PDF assets to autofillAiActivity', async () => {
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a2',
      name: 'document.pdf',
      projectId: 'p1',
      project: { id: 'p1', teamId: 't1' },
      mediaType: 'application/pdf',
      media: { metadata: { totalFrames: 15 } },
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a2',
      },
    })

    await agentAutofillMedia(task)

    expect(mockActivities.autofillAiActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a2',
        assetName: 'document.pdf',
        mediaType: 'application/pdf',
        pageCount: 15,
        duration: undefined,
      }),
    )
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

    expect(mockActivities.createCommentActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateCommentActivity).not.toHaveBeenCalled()
    expect(mockActivities.autofillAiActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateAssetMetadataActivity).not.toHaveBeenCalled()

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should handle failures, create comment with error, and set status to failed', async () => {
    mockActivities.getProjectAutofillFieldsActivity.mockRejectedValue(new Error('DB failure'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await expect(agentAutofillMedia(task)).rejects.toThrow('DB failure')

    // Verify error comment created
    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: 'Autofill failed: DB failure',
      sessionId: task.id,
      agentId: 'default',
    })

    // Verify task failed status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'DB failure' },
    })
  })

  it('should post an error comment when workflow is cancelled with DBOSWorkflowCancelledError', async () => {
    const cancelErr = new DBOSError.DBOSWorkflowCancelledError('wf-cancel')
    mockActivities.getProjectAutofillFieldsActivity.mockRejectedValue(cancelErr)

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await expect(agentAutofillMedia(task)).rejects.toThrow()

    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: expect.stringContaining('Autofill failed:'),
      sessionId: task.id,
      agentId: 'default',
    })
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: expect.stringContaining('wf-cancel') },
    })
  })

  it('should fail with non-retryable ApplicationFailure when asset or project is not found', async () => {
    mockActivities.getAssetActivity.mockResolvedValue(null)

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a-missing',
      },
    })

    await expect(agentAutofillMedia(task)).rejects.toThrow('Asset or project not found')

    // Verify task failed status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'Asset or project not found' },
    })
  })

  it('should not pass pageCount for video assets when calling autofillAiActivity', async () => {
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'v1',
      name: 'test.mp4',
      projectId: 'p1',
      storageKey: { key: 'asset-video-key' },
      project: { id: 'p1', teamId: 't1' },
      mediaType: 'video/mp4',
      media: {
        proxyType: 'video',
        duration: 10.1,
        frames: 300,
        metadata: { totalFrames: 300 },
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'v1',
        payload: {
          projectId: 'p1',
          agent: { sessionId: 's1', agentId: 'agent-1' },
        },
      },
    })

    await agentAutofillMedia(task)

    expect(mockActivities.autofillAiActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'v1',
        assetName: 'test.mp4',
        mediaType: 'video/mp4',
        duration: 10.1,
        pageCount: undefined,
      }),
    )
  })

  it('should pass pageCount and no duration for pdf assets when calling autofillAiActivity', async () => {
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'doc1',
      name: 'test.pdf',
      projectId: 'p1',
      storageKey: { key: 'asset-doc-key' },
      project: { id: 'p1', teamId: 't1' },
      mediaType: 'application/pdf',
      media: {
        proxyType: 'pdf',
        duration: 0,
        frames: 25,
        metadata: { totalFrames: 25 },
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'doc1',
        payload: {
          projectId: 'p1',
          agent: { sessionId: 's1', agentId: 'agent-1' },
        },
      },
    })

    await agentAutofillMedia(task)

    expect(mockActivities.autofillAiActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'doc1',
        assetName: 'test.pdf',
        mediaType: 'application/pdf',
        duration: undefined,
        pageCount: 25,
      }),
    )
  })
})
