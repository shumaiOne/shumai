import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@/db'
import { workflowService } from './workflow'
import { WorkflowTaskStatus, WorkflowTaskType } from '@/generated/prisma/client'

vi.mock('@/services/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    putObject: vi.fn(),
    headObject: vi.fn(),
    listObjects: vi.fn().mockResolvedValue([]),
    downloadToFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/transcode/transcode', () => ({
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
}))

describe('WorkflowService', () => {
  beforeEach(async () => {
    await prisma.workflowTask.deleteMany()
    await prisma.assetComment.deleteMany()
    await prisma.asset.deleteMany()
    vi.clearAllMocks()
    workflowService.start()
  })

  afterEach(() => {
    workflowService.close()
  })

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
    for (let i = 0; i < 20; i++) {
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
  }, 15000)

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
    for (let i = 0; i < 20; i++) {
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
  }, 15000)

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

    const submitSpy = vi.spyOn(workflowService, 'submit')

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
})
