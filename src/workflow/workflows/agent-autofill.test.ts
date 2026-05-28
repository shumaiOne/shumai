import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentAutofillMedia } from './agent-autofill'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import * as workflowUtils from '@/workflow/workflow-utils'

vi.mock('@/workflow/workflow-utils', async () => {
  const actual = await vi.importActual('@/workflow/workflow-utils')
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
  }
})

describe('Agent Autofill Workflow', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should run agent autofill workflow successfully', async () => {
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

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a1',
      storageKey: { key: 'asset-key' },
      project: { id: 'p1', teamId: 't1' },
      mediaType: 'image/png',
    })
    mockActivities.getTranscodeWorkerQueueActivity.mockResolvedValue('transcode_queue')
    mockActivities.downloadMediaToTmpActivity.mockResolvedValue({
      filePath: '/tmp/test.png',
      tmpDir: '/tmp',
    })
    mockActivities.extractAiMetadataActivity.mockResolvedValue(['/tmp/1.webp'])
    mockActivities.getProjectAutofillFieldsActivity.mockResolvedValue([
      { id: 'f1', key: 'f1', config: { name: 'F1', type: 'text' } },
    ])
    mockActivities.getAgentAutofillContextActivity.mockResolvedValue({ agent: { id: 'b1' } })
    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
    mockActivities.autofillAiActivity.mockResolvedValue({
      text: '{"f1":"val"}',
      sessionId: 'session-123',
      usage: { inputTokens: 5, outputTokens: 5, model: 'gpt' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities contains vi.fn mock functions which are cast to expected activity proxy types
    vi.mocked(workflowUtils.getActivities).mockReturnValue(mockActivities as any)
    vi.mocked(workflowUtils.executeActivity).mockImplementation(async (_queue, act, ...args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- act is one of the mocked activities
      return (act as any)(...args)
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await agentAutofillMedia(task)

    expect(mockActivities.getAgentAutofillContextActivity).toHaveBeenCalled()
    expect(mockActivities.autofillAiActivity).toHaveBeenCalled()
  })
})
