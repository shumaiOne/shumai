import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { workflowService } from './workflow'
import { DbosExecutor } from './dbos-executor'

describe('WorkflowService DBOS Workers Concurrency Control', () => {
  let originalTranscode: string | undefined
  let originalAgent: string | undefined

  beforeEach(() => {
    originalTranscode = process.env.CONCURRENCY_TRANSCODE
    originalAgent = process.env.CONCURRENCY_AGENT
  })

  afterEach(() => {
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

  it('should return default concurrency limits', () => {
    delete process.env.CONCURRENCY_TRANSCODE
    delete process.env.CONCURRENCY_AGENT

    const executor = workflowService.getExecutor()
    expect(executor).toBeInstanceOf(DbosExecutor)
    expect(executor.getTranscodeConcurrencyLimit()).toBe(1)
    expect(executor.getAgentConcurrencyLimit()).toBe(5)
  })

  it('should return environment variable overridden concurrency limits', () => {
    process.env.CONCURRENCY_TRANSCODE = '3'
    process.env.CONCURRENCY_AGENT = '12'

    const executor = workflowService.getExecutor()
    expect(executor.getTranscodeConcurrencyLimit()).toBe(3)
    expect(executor.getAgentConcurrencyLimit()).toBe(12)
  })

  it('should fallback to defaults when environment variables are invalid or <= 0', () => {
    process.env.CONCURRENCY_TRANSCODE = 'invalid'
    process.env.CONCURRENCY_AGENT = '-5'

    const executor = workflowService.getExecutor()
    expect(executor.getTranscodeConcurrencyLimit()).toBe(1)
    expect(executor.getAgentConcurrencyLimit()).toBe(5)
  })
})
