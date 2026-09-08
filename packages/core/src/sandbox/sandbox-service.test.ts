import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { sandboxService } from './sandbox-service'
import type {
  SandboxProvider,
  SandboxConfig,
  SandboxAskCallback,
  WrapCommandOptions,
} from './types'
import { teamService } from '../team/team'

class MockProvider implements SandboxProvider {
  initialized = false
  config: SandboxConfig | null = null
  initializeCallCount = 0
  updateConfigCallCount = 0
  resetCallCount = 0
  wrapCommandCalls: Array<{ command: string; options?: WrapCommandOptions }> = []
  violationsByCommandId = new Map<string, string>()
  initDelayPromise: Promise<void> | null = null
  callback: SandboxAskCallback | undefined

  async initialize(config: SandboxConfig, callback?: SandboxAskCallback): Promise<void> {
    if (this.initDelayPromise) {
      await this.initDelayPromise
    }
    this.initialized = true
    this.config = config
    this.callback = callback
    this.initializeCallCount++
  }

  async wrapCommand(command: string, options?: WrapCommandOptions): Promise<string> {
    this.wrapCommandCalls.push({ command, options })
    return `wrapped-${command}`
  }

  async updateConfig(config: Partial<SandboxConfig>): Promise<void> {
    this.updateConfigCallCount++
    if (this.config) {
      if (config.network) {
        this.config.network = { ...this.config.network, ...config.network }
      }
    }
  }

  async reset(): Promise<void> {
    this.resetCallCount++
    this.initialized = false
    this.config = null
  }

  isInitialized(): boolean {
    return this.initialized
  }

  getBlockedHostForCommand(commandId: string): string | null {
    return this.violationsByCommandId.get(commandId) ?? null
  }
}

describe('SandboxService', () => {
  setupTestDbHooks()

  let mockProvider: MockProvider

  beforeEach(async () => {
    mockProvider = new MockProvider()
    sandboxService.setProvider(mockProvider)
  })

  it('initializes provider once on ensureInitialized', async () => {
    const team = await teamService.ensureDefaultTeam()

    await sandboxService.ensureInitialized({ teamId: team.id })
    expect(mockProvider.initializeCallCount).toBe(1)
    expect(mockProvider.isInitialized()).toBe(true)

    // Second call should be a no-op
    await sandboxService.ensureInitialized({ teamId: team.id })
    expect(mockProvider.initializeCallCount).toBe(1)
  })

  it('handles concurrent ensureInitialized calls without duplicate initializations', async () => {
    const team = await teamService.ensureDefaultTeam()

    // Simulate 5 concurrent calls
    await Promise.all([
      sandboxService.ensureInitialized({ teamId: team.id }),
      sandboxService.ensureInitialized({ teamId: team.id }),
      sandboxService.ensureInitialized({ teamId: team.id }),
      sandboxService.ensureInitialized({ teamId: team.id }),
      sandboxService.ensureInitialized({ teamId: team.id }),
    ])

    expect(mockProvider.initializeCallCount).toBe(1)
  })

  it('hot-reloads configuration only when domains change', async () => {
    const team = await teamService.ensureDefaultTeam()

    // 1. Initial sync initializes provider
    await sandboxService.syncAllowedDomains(['github.com', 'pypi.org'], team.id)
    expect(mockProvider.initializeCallCount).toBe(1)
    expect(mockProvider.updateConfigCallCount).toBe(0)
    expect(sandboxService.getCurrentAllowedDomains()).toEqual(['github.com', 'pypi.org'])

    // 2. Same domains (even in different order) should be a no-op
    await sandboxService.syncAllowedDomains(['pypi.org', 'github.com'], team.id)
    expect(mockProvider.updateConfigCallCount).toBe(0)

    // 3. Different domains should trigger updateConfig without reset
    await sandboxService.syncAllowedDomains(['github.com', 'pypi.org', 'npm.org'], team.id)
    expect(mockProvider.updateConfigCallCount).toBe(1)
    expect(mockProvider.resetCallCount).toBe(0)
    expect(sandboxService.getCurrentAllowedDomains()).toEqual(['github.com', 'pypi.org', 'npm.org'])
  })

  it('integrates with teamService.updateSandboxSettings for live hot-reloading', async () => {
    const team = await teamService.ensureDefaultTeam()

    // Initialize sandbox first
    await sandboxService.ensureInitialized({ teamId: team.id })
    expect(mockProvider.initializeCallCount).toBe(1)
    expect(mockProvider.updateConfigCallCount).toBe(0)

    // Update sandbox settings via teamService
    await teamService.updateSandboxSettings(team.id, {
      networkSandboxEnabled: true,
      allowedDomains: ['custom-api.example.com'],
    })

    // Verify DB updated
    const updated = await prisma.sandbox.findUnique({ where: { teamId: team.id } })
    expect(updated?.allowedDomains).toEqual(['custom-api.example.com'])
    expect(updated?.networkSandboxEnabled).toBe(true)

    // Verify sandboxService hot-reloaded the provider live
    expect(mockProvider.updateConfigCallCount).toBe(1)
    expect(mockProvider.resetCallCount).toBe(0)
    expect(sandboxService.getCurrentAllowedDomains()).toEqual(['custom-api.example.com'])
  })

  it('delegates wrapCommand and extracts blocked host for commandId', async () => {
    const team = await teamService.ensureDefaultTeam()
    await sandboxService.ensureInitialized({ teamId: team.id })

    const result = await sandboxService.wrapCommand('echo hello', { commandId: 'tool-call-1' })
    expect(result).toBe('wrapped-echo hello')
    expect(mockProvider.wrapCommandCalls).toEqual([
      { command: 'echo hello', options: { commandId: 'tool-call-1' } },
    ])

    // Set mock violation for command
    mockProvider.violationsByCommandId.set('tool-call-1', 'blocked.malicious.com')

    expect(sandboxService.getBlockedHost('tool-call-1')).toBe('blocked.malicious.com')
    expect(sandboxService.getBlockedHost('tool-call-2')).toBe('')
  })

  it('does not leak lastBlockedHost to command with no violations', async () => {
    const team = await teamService.ensureDefaultTeam()
    await prisma.sandbox.upsert({
      where: { teamId: team.id },
      create: { teamId: team.id, networkSandboxEnabled: true },
      update: { networkSandboxEnabled: true },
    })
    await sandboxService.ensureInitialized({ teamId: team.id })

    // Simulate global ask callback recording a blocked host
    if (mockProvider.callback) {
      await mockProvider.callback({ host: 'blocked.global.com', port: 443 })
    }

    // Legacy un-scoped call returns lastBlockedHost
    expect(sandboxService.getBlockedHost()).toBe('blocked.global.com')

    // Command-scoped call for clean command MUST return ''
    expect(sandboxService.getBlockedHost('clean-cmd')).toBe('')

    // Command-scoped call with recorded violation returns that violation
    mockProvider.violationsByCommandId.set('violating-cmd', 'violating.host.com')
    expect(sandboxService.getBlockedHost('violating-cmd')).toBe('violating.host.com')
  })

  it('serializes concurrent syncAllowedDomains during delayed initialization and applies latest configuration', async () => {
    const team = await teamService.ensureDefaultTeam()

    let resolveInit: () => void = () => {}
    mockProvider.initDelayPromise = new Promise<void>((resolve) => {
      resolveInit = resolve
    })

    // Start two concurrent sync requests before initialization completes
    const sync1 = sandboxService.syncAllowedDomains(['first.com'], team.id)
    const sync2 = sandboxService.syncAllowedDomains(['second.com'], team.id)

    // Complete the provider initialization
    resolveInit()
    await Promise.all([sync1, sync2])

    // Provider was initialized once, and then updated to the second request
    expect(mockProvider.initializeCallCount).toBe(1)
    expect(mockProvider.updateConfigCallCount).toBe(1)
    expect(sandboxService.getCurrentAllowedDomains()).toEqual(['second.com'])
  })

  it('resets cleanly when reset is invoked', async () => {
    const team = await teamService.ensureDefaultTeam()
    await sandboxService.ensureInitialized({ teamId: team.id })
    expect(sandboxService.isInitialized()).toBe(true)

    await sandboxService.reset()
    expect(sandboxService.isInitialized()).toBe(false)
    expect(mockProvider.resetCallCount).toBe(1)
    expect(sandboxService.getCurrentAllowedDomains()).toEqual([])
  })
})
