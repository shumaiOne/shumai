import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalSandboxProvider } from './local-provider'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import type { SandboxConfig, SandboxAskCallback } from '../types'

vi.mock('@anthropic-ai/sandbox-runtime', () => ({
  SandboxManager: {
    initialize: vi.fn(),
    wrapWithSandbox: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    reset: vi.fn(),
    isSandboxingEnabled: vi.fn(),
    getSandboxViolationStore: vi.fn(),
  },
}))

describe('LocalSandboxProvider', () => {
  let provider: LocalSandboxProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new LocalSandboxProvider()
  })

  it('delegates initialize to SandboxManager', async () => {
    const config: SandboxConfig = {
      network: { allowedDomains: ['example.com'], deniedDomains: [] },
      filesystem: {
        denyRead: ['.env'],
        allowWrite: ['/tmp'],
        denyWrite: ['.env'],
      },
      enableWeakerNestedSandbox: true,
    }
    const callback: SandboxAskCallback = async () => true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock resolves void
    vi.mocked(SandboxManager.initialize as any).mockResolvedValue(undefined)
    vi.mocked(SandboxManager.isSandboxingEnabled).mockReturnValue(true)

    await provider.initialize(config, callback)

    expect(SandboxManager.initialize).toHaveBeenCalledWith(
      {
        network: config.network,
        filesystem: config.filesystem,
        enableWeakerNestedSandbox: true,
      },
      callback,
    )
    expect(provider.isInitialized()).toBe(true)
  })

  it('delegates wrapCommand with and without commandId', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock wrapWithSandbox
    vi.mocked(SandboxManager.wrapWithSandbox as any).mockResolvedValue('wrapped-command')

    const res1 = await provider.wrapCommand('echo hello')
    expect(res1).toBe('wrapped-command')
    expect(SandboxManager.wrapWithSandbox).toHaveBeenCalledWith(
      'echo hello',
      undefined,
      undefined,
      undefined,
      undefined,
    )

    const res2 = await provider.wrapCommand('curl example.com', { commandId: 'cmd-123' })
    expect(res2).toBe('wrapped-command')
    expect(SandboxManager.wrapWithSandbox).toHaveBeenCalledWith(
      'curl example.com',
      undefined,
      undefined,
      undefined,
      { commandId: 'cmd-123' },
    )
  })

  describe('updateConfig', () => {
    it('throws when called before initialization (no config in manager)', async () => {
      vi.mocked(SandboxManager.getConfig).mockReturnValue(undefined)

      await expect(
        provider.updateConfig({ network: { allowedDomains: ['new.com'], deniedDomains: [] } }),
      ).rejects.toThrow('Cannot update sandbox config before initialization')
    })

    it('merges partial network and filesystem configuration', async () => {
      const currentConfig = {
        network: { allowedDomains: ['old.com'], deniedDomains: [] },
        filesystem: { denyRead: ['.env'], allowWrite: ['/tmp'], denyWrite: [] },
        enableWeakerNestedSandbox: false,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock getConfig return
      vi.mocked(SandboxManager.getConfig).mockReturnValue(currentConfig as any)

      await provider.updateConfig({
        network: { allowedDomains: ['new.com', 'old.com'], deniedDomains: [] },
      })

      expect(SandboxManager.updateConfig).toHaveBeenCalledWith({
        network: { allowedDomains: ['new.com', 'old.com'], deniedDomains: [] },
        filesystem: { denyRead: ['.env'], allowWrite: ['/tmp'], denyWrite: [] },
        enableWeakerNestedSandbox: false,
      })
    })
  })

  it('resets SandboxManager and clears initialized state', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock resolves
    vi.mocked(SandboxManager.initialize as any).mockResolvedValue(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock resolves
    vi.mocked(SandboxManager.reset as any).mockResolvedValue(undefined)
    vi.mocked(SandboxManager.isSandboxingEnabled).mockReturnValue(true)

    await provider.initialize({
      network: { allowedDomains: [], deniedDomains: [] },
      filesystem: { denyRead: [], allowWrite: [], denyWrite: [] },
    })
    expect(provider.isInitialized()).toBe(true)

    await provider.reset()
    expect(SandboxManager.reset).toHaveBeenCalled()
    expect(provider.isInitialized()).toBe(false)
  })

  describe('getBlockedHostForCommand', () => {
    it('extracts blocked host from deny network-outbound lines', () => {
      const mockStore = {
        getViolationsForCommand: vi
          .fn()
          .mockReturnValue([
            { line: 'something else' },
            { line: 'deny network-outbound evil.com:443' },
          ]),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock store
      vi.mocked(SandboxManager.getSandboxViolationStore).mockReturnValue(mockStore as any)

      const blocked = provider.getBlockedHostForCommand('cmd-1')
      expect(blocked).toBe('evil.com')
      expect(mockStore.getViolationsForCommand).toHaveBeenCalledWith('cmd-1')
    })

    it('extracts blocked host from url matches', () => {
      const mockStore = {
        getViolationsForCommand: vi
          .fn()
          .mockReturnValue([{ line: 'violation: https://blocked-url.com/some/path' }]),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock store
      vi.mocked(SandboxManager.getSandboxViolationStore).mockReturnValue(mockStore as any)

      const blocked = provider.getBlockedHostForCommand('cmd-2')
      expect(blocked).toBe('blocked-url.com')
    })

    it('returns null if no violations or no matching regex', () => {
      const mockStore = {
        getViolationsForCommand: vi.fn().mockReturnValue([]),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock store
      vi.mocked(SandboxManager.getSandboxViolationStore).mockReturnValue(mockStore as any)

      expect(provider.getBlockedHostForCommand('cmd-3')).toBeNull()
    })

    it('handles violation store errors gracefully', () => {
      vi.mocked(SandboxManager.getSandboxViolationStore).mockImplementation(() => {
        throw new Error('store failure')
      })

      expect(provider.getBlockedHostForCommand('cmd-err')).toBeNull()
    })
  })
})
