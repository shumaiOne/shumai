import { describe, it, expect, vi, beforeEach } from 'vitest'
import { takeVideoScreenshotsWorkflow } from './take-video-screenshots'
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

describe('takeVideoScreenshotsWorkflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
    getTranscodeWorkerQueueActivity: Object.assign(vi.fn(), {
      _activityName: 'getTranscodeWorkerQueueActivity',
    }),
    takeScreenshotsActivity: Object.assign(vi.fn(), { _activityName: 'takeScreenshotsActivity' }),
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

  it('should run screenshot workflow successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-screenshot',
      assetId: 'asset-video',
      type: WorkflowTaskType.transcode_screenshot,
      status: WorkflowTaskStatus.pending,
      sessionId: null,
      output: null,
      payload: {
        projectId: 'proj-1',
        screenshot: {
          start: 0,
          end: 10,
          count: 2,
          commentTimestamp: 5.0,
          annotations: [],
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
      id: 'asset-video',
      storageKey: { key: 'video.mp4' },
      mediaType: 'video/mp4',
    })

    mockActivities.takeScreenshotsActivity.mockResolvedValue([
      { key: 'files/asset-video/screenshots/shot1.webp', timestamp: 0.0 },
      { key: 'files/asset-video/screenshots/shot2.webp', timestamp: 5.0 },
    ])

    await takeVideoScreenshotsWorkflow(task)

    expect(mockActivities.takeScreenshotsActivity).toHaveBeenCalledWith({
      assetKey: 'video.mp4',
      assetId: 'asset-video',
      start: 0,
      end: 10,
      count: 2,
      commentTimestamp: 5.0,
      annotations: [],
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-screenshot',
      status: WorkflowTaskStatus.completed,
      output: {
        screenshots: [
          { key: 'files/asset-video/screenshots/shot1.webp', timestamp: 0.0 },
          { key: 'files/asset-video/screenshots/shot2.webp', timestamp: 5.0 },
        ],
      },
    })
  })
})
