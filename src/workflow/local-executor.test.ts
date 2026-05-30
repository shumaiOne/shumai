import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { workflowService } from './workflow'
import { LocalExecutor } from './local-executor'
import { WorkflowTaskStatus, WorkflowTaskType } from '@/generated/prisma/client'

// Mock the individual workflows
const mocks = {
  agentEmbeddingMedia: vi.fn(),
  queryEmbeddingForSearch: vi.fn(),
  agentAutofillMedia: vi.fn(),
  agentChat: vi.fn(),
  transcodeMedia: vi.fn(),
}

vi.mock('./workflows/agent-embedding', () => ({
  agentEmbeddingMedia: (task: unknown) => mocks.agentEmbeddingMedia(task),
}))
vi.mock('./workflows/query-embedding-for-search', () => ({
  queryEmbeddingForSearch: (task: unknown) => mocks.queryEmbeddingForSearch(task),
}))
vi.mock('./workflows/agent-autofill', () => ({
  agentAutofillMedia: (task: unknown) => mocks.agentAutofillMedia(task),
}))
vi.mock('./workflows/agent-chat', () => ({
  agentChat: (task: unknown) => mocks.agentChat(task),
}))
vi.mock('@/transcode/workflows/transcode', () => ({
  transcodeMedia: (task: unknown) => mocks.transcodeMedia(task),
}))

describe('LocalExecutor Integration Tests', () => {
  setupTestDbHooks()

  let executor: LocalExecutor

  beforeEach(() => {
    // Get the global executor instance which processes tasks submitted via the Prisma Client Extension
    executor = (workflowService as unknown as { executor: LocalExecutor }).executor
    vi.clearAllMocks()
  })

  describe('Heartbeat & Task Status transition', () => {
    it('should immediately transition task to processing and set initial heartbeat', async () => {
      let resolveChat: (value: unknown) => void = () => {}
      const chatPromise = new Promise((resolve) => {
        resolveChat = resolve
      })
      mocks.agentChat.mockImplementationOnce(() => chatPromise)

      const task = await prisma.workflowTask.create({
        data: {
          assetId: 'test-asset',
          type: WorkflowTaskType.chat,
          status: WorkflowTaskStatus.pending,
        },
      })

      // Wait briefly for the Prisma Client Extension's async submit (setTimeout 0) to execute and transition task
      await new Promise((resolve) => setTimeout(resolve, 50))

      const intermediateTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })

      expect(intermediateTask?.status).toBe(WorkflowTaskStatus.processing)
      expect(intermediateTask?.heartbeat).toBeInstanceOf(Date)

      // Clean up
      resolveChat(undefined)
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should query and retry stale tasks in tick() but ignore non-stale processing tasks', async () => {
      mocks.agentChat.mockResolvedValue(undefined)

      // 1. Create a stale task (processing, heartbeat 40 seconds ago)
      const staleTask = await prisma.workflowTask.create({
        data: {
          assetId: 'asset-stale',
          type: WorkflowTaskType.chat,
          status: WorkflowTaskStatus.processing,
          heartbeat: new Date(Date.now() - 40 * 1000),
        },
      })

      // 2. Create a non-stale task (processing, heartbeat 5 seconds ago)
      const activeTask = await prisma.workflowTask.create({
        data: {
          assetId: 'asset-active',
          type: WorkflowTaskType.chat,
          status: WorkflowTaskStatus.processing,
          heartbeat: new Date(Date.now() - 5 * 1000),
        },
      })

      // Trigger tick manually on the executor and await the returned task promises
      const promises = await executor.tick()
      await Promise.all(promises)

      // The stale task should be picked up and processed (mocks.agentChat called for staleTask)
      expect(mocks.agentChat).toHaveBeenCalledWith(expect.objectContaining({ id: staleTask.id }))

      // The active task should NOT be called
      expect(mocks.agentChat).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: activeTask.id }),
      )
    })
  })

  describe('Concurrency Control', () => {
    it('should limit transcode tasks to a concurrency of 1', async () => {
      let resolveFirstTranscode: (value: unknown) => void = () => {}
      const firstTranscodePromise = new Promise((resolve) => {
        resolveFirstTranscode = resolve
      })
      mocks.transcodeMedia.mockImplementationOnce(() => firstTranscodePromise)
      mocks.transcodeMedia.mockImplementationOnce(() => Promise.resolve())

      const task1 = await prisma.workflowTask.create({
        data: {
          assetId: 'asset-1',
          type: WorkflowTaskType.transcode,
          status: WorkflowTaskStatus.pending,
        },
      })

      const task2 = await prisma.workflowTask.create({
        data: {
          assetId: 'asset-2',
          type: WorkflowTaskType.transcode,
          status: WorkflowTaskStatus.pending,
        },
      })

      // Wait briefly for Prisma Client Extension's async submits to trigger
      await new Promise((resolve) => setTimeout(resolve, 50))

      // The first task should be actively running
      expect(mocks.transcodeMedia).toHaveBeenCalledWith(expect.objectContaining({ id: task1.id }))
      // The second task should NOT have started yet because transcode pool limit is 1
      expect(mocks.transcodeMedia).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: task2.id }),
      )

      // Resolve the first task to let the second task execute
      resolveFirstTranscode(undefined)

      // Wait briefly for the pool queue to process next item
      await new Promise((resolve) => setTimeout(resolve, 50))

      // The second task should now be running
      expect(mocks.transcodeMedia).toHaveBeenCalledWith(expect.objectContaining({ id: task2.id }))
    })

    it('should limit general tasks to a concurrency of 5 and run them concurrently', async () => {
      const activeResolvers: ((value: unknown) => void)[] = []
      mocks.agentChat.mockImplementation(() => {
        return new Promise((resolve) => {
          activeResolvers.push(resolve)
        })
      })

      // Create 7 general workflow tasks (limit is 5)
      await Promise.all(
        Array.from({ length: 7 }).map((_, i) =>
          prisma.workflowTask.create({
            data: {
              assetId: `asset-chat-${i}`,
              type: WorkflowTaskType.chat,
              status: WorkflowTaskStatus.pending,
            },
          }),
        ),
      )

      // Wait briefly for Prisma Client Extension's async submits to trigger
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Exactly 5 tasks should be running concurrently
      expect(mocks.agentChat).toHaveBeenCalledTimes(5)

      // Resolve 2 tasks to let the remaining 2 start
      activeResolvers[0](undefined)
      activeResolvers[1](undefined)

      // Wait briefly for the pool to dequeue
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Now all 7 tasks should have started
      expect(mocks.agentChat).toHaveBeenCalledTimes(7)

      // Clean up remaining tasks
      activeResolvers.slice(2).forEach((resolve) => resolve(undefined))
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  })
})
