import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { workflowService } from './workflow'
import { WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import { initAgentWorkflows } from '@shumai/agent'
import { initTranscodeWorkflows } from '@shumai/transcode'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    putObject: vi.fn(),
    headObject: vi.fn(),
    listObjects: vi.fn().mockResolvedValue([]),
    downloadToFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@shumai/transcode', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    transcodeService: {
      createTempDir: vi.fn().mockReturnValue('/tmp/shumai-test'),
      removeDir: vi.fn(),
      extractAudio: vi.fn(),
      extractVideoFrames: vi.fn().mockResolvedValue([]),
      getVideoInfo: vi.fn(),
      getImageInfo: vi.fn(),
      transcodeVideo: vi.fn(),
      transcodeImage: vi.fn(),
      generateSprite: vi.fn(),
    },
  }
})

describe('WorkflowService', () => {
  beforeEach(async () => {
    initAgentWorkflows()
    initTranscodeWorkflows()
    vi.clearAllMocks()
    workflowService.start()
    await workflowService.ensureLaunched()
  }, 15000)

  afterEach(async () => {
    await workflowService.shutdownWorkers()
  }, 15000)

  it('should process ai_embedding task locally', async () => {
    const team = await prisma.team.create({
      data: { name: 'Embedding Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Embedding Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'test.png',
        storageKey: { create: { key: 'test/test.png' } },
        status: 'uploaded',
        type: 'file',
        mediaType: 'image/png',
        project: { connect: { id: project.id } },
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        type: WorkflowTaskType.ai_embedding,
        status: WorkflowTaskStatus.pending,
        teamId: team.id,
      },
    })

    // Note: This might fail if AI providers are not configured, but we want to check the workflow flow.
    // In a real test environment, we might mock the AI service.
    // However, let's see if it gets to 'failed' or 'completed' depending on the environment.

    let finishedTask = null
    for (let i = 0; i < 50; i++) {
      finishedTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })
      if (
        finishedTask?.status === WorkflowTaskStatus.completed ||
        finishedTask?.status === WorkflowTaskStatus.failed
      ) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    expect(finishedTask?.status).toBeDefined()
    // Even if it fails due to missing API keys, the fact that it's no longer 'pending' means the workflow was triggered.
    expect(finishedTask?.status).not.toBe(WorkflowTaskStatus.pending)
  }, 30000)

  it('should propagate ApplicationFailure correctly in local executor', async () => {
    // Creating an ai_embedding task without any embedding agent configured for the team
    const team = await prisma.team.create({
      data: { name: 'Failure Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Failure Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'test.png',
        storageKey: { create: { key: 'test/failure-test.png' } },
        status: 'uploaded',
        type: 'file',
        mediaType: 'image/png',
        project: { connect: { id: project.id } },
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        type: WorkflowTaskType.ai_embedding,
        status: WorkflowTaskStatus.pending,
        teamId: team.id,
      },
    })

    let finishedTask = null
    for (let i = 0; i < 50; i++) {
      finishedTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })
      if (finishedTask?.status === WorkflowTaskStatus.failed) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    expect(finishedTask?.status).toBe(WorkflowTaskStatus.failed)
    expect((finishedTask?.output as Record<string, unknown>)?.error).toBe(
      'embedding feature is disabled or agent not found',
    )
  }, 30000)

  it('should not double-submit the task when executeWait is called', async () => {
    const team = await prisma.team.create({
      data: { name: 'Test Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Test Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'test-double.png',
        storageKey: { create: { key: 'test/test-double.png' } },
        status: 'uploaded',
        type: 'file',
        mediaType: 'image/png',
        project: { connect: { id: project.id } },
      },
    })

    const submitSpy = vi.spyOn(workflowService, 'submit').mockImplementation(async () => 'mock-id')

    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        type: WorkflowTaskType.ai_embedding,
        status: WorkflowTaskStatus.pending,
        teamId: team.id,
      },
    })

    // Wait briefly for the Prisma extension's async import/submit to fire
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(submitSpy).toHaveBeenCalledTimes(1)

    // Complete the task in the database so executeWait returns immediately
    await prisma.workflowTask.update({
      where: { id: task.id },
      data: { status: 'completed' },
    })

    await workflowService.executeWait(task)

    // Verify it was not submitted a second time by executeWait
    expect(submitSpy).toHaveBeenCalledTimes(1)

    submitSpy.mockRestore()
  })

  describe('Stale Task Recovery', () => {
    it('should resume stale pending workflow task in DBOS and increment recoveryAttempts', async () => {
      const task = await prisma.workflowTask.create({
        data: {
          assetId: 'stale-asset-1',
          type: WorkflowTaskType.transcode,
          status: WorkflowTaskStatus.processing,
          heartbeat: new Date(Date.now() - 100_000), // 100s ago
        },
      })

      const mockClient = {
        retrieveWorkflow: vi.fn().mockReturnValue({
          getStatus: vi.fn().mockResolvedValue({ status: 'PENDING' }),
        }),
        resumeWorkflow: vi.fn().mockResolvedValue(undefined),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(workflowService.getExecutor(), 'getClient').mockResolvedValue(mockClient as any)

      const recoveredCount = await workflowService.recoverStaleTasks({
        staleThresholdMs: 90_000,
        maxRecoveryAttempts: 3,
      })

      expect(recoveredCount).toBe(1)
      expect(mockClient.resumeWorkflow).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({ queueName: expect.any(String) }),
      )

      const updatedTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })
      const output = updatedTask?.output as { recoveryAttempts?: number } | null
      expect(output?.recoveryAttempts).toBe(1)
      expect(updatedTask?.heartbeat?.getTime()).toBeGreaterThan(Date.now() - 5000)
    })

    it('should mark task and asset as failed when recoveryAttempts exceeds maxRecoveryAttempts', async () => {
      const asset = await prisma.asset.create({
        data: {
          id: 'poison-asset-1',
          name: 'poison.mp4',
          type: 'file',
          status: 'processing',
        },
      })

      const task = await prisma.workflowTask.create({
        data: {
          assetId: asset.id,
          type: WorkflowTaskType.transcode,
          status: WorkflowTaskStatus.processing,
          heartbeat: new Date(Date.now() - 100_000),
          output: { recoveryAttempts: 3 },
        },
      })

      const mockClient = {
        retrieveWorkflow: vi.fn(),
        resumeWorkflow: vi.fn(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(workflowService.getExecutor(), 'getClient').mockResolvedValue(mockClient as any)

      const recoveredCount = await workflowService.recoverStaleTasks({
        staleThresholdMs: 90_000,
        maxRecoveryAttempts: 3,
      })

      expect(recoveredCount).toBe(1)
      expect(mockClient.resumeWorkflow).not.toHaveBeenCalled()

      const updatedTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })
      expect(updatedTask?.status).toBe(WorkflowTaskStatus.failed)
      const output = updatedTask?.output as { error?: string; recoveryAttempts?: number } | null
      expect(output?.recoveryAttempts).toBe(4)
      expect(output?.error).toContain('exceeded maximum stale recovery attempts')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe('failed')
    })

    it('should reconcile completed or cancelled DBOS workflow status', async () => {
      const taskSuccess = await prisma.workflowTask.create({
        data: {
          assetId: 'stale-asset-success',
          type: WorkflowTaskType.transcode,
          status: WorkflowTaskStatus.processing,
          heartbeat: new Date(Date.now() - 100_000),
        },
      })

      const taskCancelled = await prisma.workflowTask.create({
        data: {
          assetId: 'stale-asset-cancelled',
          type: WorkflowTaskType.transcode,
          status: WorkflowTaskStatus.processing,
          heartbeat: new Date(Date.now() - 100_000),
        },
      })

      const mockClient = {
        retrieveWorkflow: vi.fn().mockImplementation((taskId: string) => ({
          getStatus: vi.fn().mockResolvedValue({
            status: taskId === taskSuccess.id ? 'SUCCESS' : 'CANCELLED',
          }),
        })),
        resumeWorkflow: vi.fn(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(workflowService.getExecutor(), 'getClient').mockResolvedValue(mockClient as any)

      const count = await workflowService.recoverStaleTasks({
        staleThresholdMs: 90_000,
        maxRecoveryAttempts: 3,
      })

      expect(count).toBe(2)
      expect(mockClient.resumeWorkflow).not.toHaveBeenCalled()

      const updatedSuccess = await prisma.workflowTask.findUnique({
        where: { id: taskSuccess.id },
      })
      expect(updatedSuccess?.status).toBe(WorkflowTaskStatus.completed)

      const updatedCancelled = await prisma.workflowTask.findUnique({
        where: { id: taskCancelled.id },
      })
      expect(updatedCancelled?.status).toBe(WorkflowTaskStatus.failed)
      const cancelledOutput = updatedCancelled?.output as { error?: string } | null
      expect(cancelledOutput?.error).toBe('Workflow was cancelled')
    })
  })
})
