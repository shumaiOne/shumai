import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { workflowService } from './workflow'
import { TaskQueueAgent, TaskQueueTranscode } from './workflow-utils'

const mockCreate = vi.fn().mockResolvedValue({
  run: vi.fn().mockResolvedValue(undefined),
})

const mockConnect = vi.fn().mockResolvedValue({})

vi.mock('@temporalio/worker', () => ({
  Worker: {
    create: (options: Record<string, unknown>) => mockCreate(options),
  },
  NativeConnection: {
    connect: (options: Record<string, unknown>) => mockConnect(options),
  },
}))

describe('WorkflowService Temporal Workers Concurrency Control', () => {
  let originalExecutor: string | undefined
  let originalTranscode: string | undefined
  let originalAgent: string | undefined

  beforeEach(() => {
    originalExecutor = process.env.WORKFLOW_EXECUTOR
    originalTranscode = process.env.CONCURRENCY_TRANSCODE
    originalAgent = process.env.CONCURRENCY_AGENT
    workflowService.setExecutorType('temporal')
    vi.clearAllMocks()
  })

  afterEach(() => {
    workflowService.setExecutorType(originalExecutor === 'temporal' ? 'temporal' : 'local')

    if (originalTranscode === undefined) {
      delete process.env.CONCURRENCY_TRANSCODE
    } else {
      process.env.CONCURRENCY_TRANSCODE = originalTranscode
    }

    if (originalAgent === undefined) {
      delete process.env.CONCURRENCY_AGENT
    } else {
      process.env.CONCURRENCY_AGENT = originalAgent
    }
  })

  it('should pass default concurrency limits to specific workers', async () => {
    delete process.env.CONCURRENCY_TRANSCODE
    delete process.env.CONCURRENCY_AGENT

    // Test Transcode Worker
    await workflowService.startWorkers(TaskQueueTranscode)
    // Worker.create should be called twice (shared worker + specific worker)
    expect(mockCreate).toHaveBeenCalledTimes(2)

    // The second call is for the specific worker
    const transcodeSpecificWorkerOptions = mockCreate.mock.calls[1][0]
    expect(transcodeSpecificWorkerOptions.maxConcurrentActivityTaskExecutions).toBe(1)

    vi.clearAllMocks()

    // Test Agent Worker
    await workflowService.startWorkers(TaskQueueAgent)
    expect(mockCreate).toHaveBeenCalledTimes(2)

    const agentSpecificWorkerOptions = mockCreate.mock.calls[1][0]
    expect(agentSpecificWorkerOptions.maxConcurrentActivityTaskExecutions).toBe(5)
  })

  it('should pass environment variable overridden concurrency limits to specific workers', async () => {
    process.env.CONCURRENCY_TRANSCODE = '3'
    process.env.CONCURRENCY_AGENT = '12'

    // Test Transcode Worker
    await workflowService.startWorkers(TaskQueueTranscode)
    expect(mockCreate).toHaveBeenCalledTimes(2)

    const transcodeSpecificWorkerOptions = mockCreate.mock.calls[1][0]
    expect(transcodeSpecificWorkerOptions.maxConcurrentActivityTaskExecutions).toBe(3)

    vi.clearAllMocks()

    // Test Agent Worker
    await workflowService.startWorkers(TaskQueueAgent)
    expect(mockCreate).toHaveBeenCalledTimes(2)

    const agentSpecificWorkerOptions = mockCreate.mock.calls[1][0]
    expect(agentSpecificWorkerOptions.maxConcurrentActivityTaskExecutions).toBe(12)
  })

  it('should fallback to defaults when environment variables are invalid or <= 0 for specific workers', async () => {
    process.env.CONCURRENCY_TRANSCODE = 'invalid'
    process.env.CONCURRENCY_AGENT = '-5'

    // Test Transcode Worker
    await workflowService.startWorkers(TaskQueueTranscode)
    expect(mockCreate).toHaveBeenCalledTimes(2)

    const transcodeSpecificWorkerOptions = mockCreate.mock.calls[1][0]
    expect(transcodeSpecificWorkerOptions.maxConcurrentActivityTaskExecutions).toBe(1)

    vi.clearAllMocks()

    // Test Agent Worker
    await workflowService.startWorkers(TaskQueueAgent)
    expect(mockCreate).toHaveBeenCalledTimes(2)

    const agentSpecificWorkerOptions = mockCreate.mock.calls[1][0]
    expect(agentSpecificWorkerOptions.maxConcurrentActivityTaskExecutions).toBe(5)
  })
})
