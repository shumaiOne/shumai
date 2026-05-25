import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aiAutofillMedia } from './ai-autofill'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@/generated/prisma/client'
import * as workflowUtils from '@/workflow/workflow-utils'

vi.mock('@/workflow/workflow-utils', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
    sleep: vi.fn(),
  }
})

describe('AIAutofill Workflow', () => {
  const mockActivities = {
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
    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_worker_queue')
    mockActivities.downloadMediaToTmpActivity.mockResolvedValue({
      filePath: '/tmp/test.mp4',
      tmpDir: '/tmp',
    })
  })

  it('should process AI autofill successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-1',
      assetId: 'asset-1',
      type: WorkflowTaskType.ai_metadata_autofill,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-1-uid',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-1',
      storageKey: { key: 'test.mp4' },
      mediaType: 'video/mp4',
      project: { id: 'proj-1', teamId: 'team-1' },
    })

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'placeholder-1' })
    mockActivities.extractAiMetadataActivity.mockResolvedValue(['frame1.webp'])
    mockActivities.getProjectAutofillFieldsActivity.mockResolvedValue([
      { id: 'field-1', config: { type: 'text', name: 'Field 1' } },
    ])
    mockActivities.autofillAiActivity.mockResolvedValue({
      text: JSON.stringify({ 'field-1': 'Extracted Value' }),
      usage: { inputTokens: 10, outputTokens: 5, model: 'gpt-4v' },
    })

    await aiAutofillMedia(task)

    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      message: '__AUTOFILL__',
      sessionId: 'task-1',
      agentId: 'default',
    })

    expect(mockActivities.updateAssetMetadataActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      metadata: [{ key: 'field-1', value: 'Extracted Value' }],
    })
  })

  it('should use agentId from payload if provided', async () => {
    const task: WorkflowTask = {
      id: 'task-1',
      assetId: 'asset-1',
      type: WorkflowTaskType.ai_metadata_autofill,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: { agentId: 'real-agent-id' },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-1-uid',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-1',
      storageKey: { key: 'test.mp4' },
      mediaType: 'video/mp4',
      project: { id: 'proj-1', teamId: 'team-1' },
    })

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'placeholder-1' })
    mockActivities.extractAiMetadataActivity.mockResolvedValue(['frame1.webp'])
    mockActivities.getProjectAutofillFieldsActivity.mockResolvedValue([
      { id: 'field-1', config: { type: 'text', name: 'Field 1' } },
    ])
    mockActivities.autofillAiActivity.mockResolvedValue({
      text: JSON.stringify({ 'field-1': 'Extracted Value' }),
      usage: { inputTokens: 10, outputTokens: 5, model: 'gpt-4v' },
    })

    await aiAutofillMedia(task)

    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      message: '__AUTOFILL__',
      sessionId: 'task-1',
      agentId: 'real-agent-id',
    })
  })

  it('should handle failures and update task status with error', async () => {
    const task: WorkflowTask = {
      id: 'task-fail',
      assetId: 'asset-1',
      type: WorkflowTaskType.ai_metadata_autofill,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-fail-uid',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'placeholder-err' })
    mockActivities.getAssetActivity.mockRejectedValue(new Error('Asset missing'))

    await expect(aiAutofillMedia(task)).rejects.toThrow('Asset missing')

    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'placeholder-err',
      message: expect.stringContaining('failed'),
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-fail',
      status: WorkflowTaskStatus.failed,
      output: { error: 'Asset missing' },
    })
  })
})
