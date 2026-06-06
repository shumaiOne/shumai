import { describe, it, expect, vi, beforeEach } from 'vitest'
import { temporalWorkflow } from './bun-temporal-plugin'
import * as worker from '@temporalio/worker'

vi.mock('@temporalio/worker', () => ({
  bundleWorkflowCode: vi.fn().mockResolvedValue({ code: 'mock-code', sourceMap: '' })
}))

describe('temporalWorkflow plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register onLoad and configure webpackConfigHook with @temporalio/workflow alias', async () => {
    const plugin = temporalWorkflow()
    
    let onLoadCallback: ((...args: unknown[]) => unknown) | null = null

    const mockBuild = {
      onResolve: vi.fn(),
      onLoad: vi.fn((opts, callback) => {
        onLoadCallback = callback
      })
    }

    // Run setup
    // @ts-ignore
    plugin.setup(mockBuild)

    expect(onLoadCallback).toBeDefined()

    // Trigger onLoad callback
    await onLoadCallback!({ path: 'dummy-path' })

    // Verify bundleWorkflowCode was called
    expect(worker.bundleWorkflowCode).toHaveBeenCalled()

    // Webpack's configuration type is complex and varies across versions.
    // We cast it to any here to allow indexing the config aliases dynamically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = vi.mocked(worker.bundleWorkflowCode).mock.calls[0][0] as any
    expect(callArgs.webpackConfigHook).toBeDefined()

    // Invoke the hook with a dummy config
    const config = { resolve: { alias: {} } }
    const updatedConfig = callArgs.webpackConfigHook(config)

    // Check that aliases are set
    expect(updatedConfig.resolve.alias['@shumai/workflow-core']).toBeDefined()
    expect(updatedConfig.resolve.alias['@temporalio/workflow']).toBeDefined()
  })
})
