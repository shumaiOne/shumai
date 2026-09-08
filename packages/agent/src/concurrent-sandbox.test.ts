import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sandboxService } from '@shumai/core'
import type { SandboxProvider, SandboxConfig, WrapCommandOptions } from '@shumai/core'
import { createAgentSession, type DbProviderInfo } from './index'
import { createSandboxedBashTool } from './tools/sandboxed-bash'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

vi.mock('node:child_process')

class TestSandboxProvider implements SandboxProvider {
  initialized = false
  config: SandboxConfig | null = null
  initializeCalls = 0
  updateConfigCalls = 0
  resetCalls = 0
  wrapCommandCalls: Array<{ command: string; options?: WrapCommandOptions }> = []
  violationsByCommandId = new Map<string, string>()

  async initialize(config: SandboxConfig): Promise<void> {
    this.initialized = true
    this.config = config
    this.initializeCalls++
  }

  async wrapCommand(command: string, options?: WrapCommandOptions): Promise<string> {
    this.wrapCommandCalls.push({ command, options })
    return `sandboxed-${command}`
  }

  async updateConfig(config: Partial<SandboxConfig>): Promise<void> {
    this.updateConfigCalls++
    if (this.config && config.network) {
      this.config.network = { ...this.config.network, ...config.network }
    }
  }

  async reset(): Promise<void> {
    this.resetCalls++
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

const mockProviders: DbProviderInfo[] = [
  {
    name: 'google',
    config: { api: 'google-generative-ai', apiKey: 'GOOGLE_API_KEY' },
    models: [
      {
        modelId: 'gemini',
        name: 'Gemini',
        config: {
          api: 'google-generative-ai',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 8192,
          maxTokens: 4096,
        },
      },
    ],
  },
]

describe('Concurrent Sandbox Sessions', () => {
  setupTestDbHooks()

  let testProvider: TestSandboxProvider

  beforeEach(async () => {
    vi.clearAllMocks()
    testProvider = new TestSandboxProvider()
    sandboxService.setProvider(testProvider)
  })

  it('does not reset sandbox when new sessions start while a command is running', async () => {
    const team = await prisma.team.create({
      data: { name: 'Concurrent Test Team' },
    })
    await prisma.sandbox.create({
      data: {
        teamId: team.id,
        networkSandboxEnabled: true,
        allowedDomains: ['api.github.com'],
      },
    })
    await prisma.user.create({
      data: {
        id: 'agent-1',
        name: 'Agent User',
        email: 'agent-user@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'agent-1',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    // 1. Session A starts and syncs domains
    await createAgentSession({
      teamId: team.id,
      agentId: 'agent-1',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'Session A prompt',
      teamSkills: [],
      allowedDomains: ['api.github.com'],
      providers: mockProviders,
    })

    expect(testProvider.initializeCalls).toBe(1)
    expect(testProvider.resetCalls).toBe(0)

    // 2. Session A runs a bash command that takes time
    const tool = createSandboxedBashTool('/mock/cwd')

    const mockStdout = new EventEmitter()
    const mockStderr = new EventEmitter()
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: mockStdout,
      stderr: mockStderr,
      pid: 999,
      kill: vi.fn(),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock spawn return value
    ;(spawn as any).mockReturnValue(mockChild)

    const sessionExecutionA = tool.execute('call-session-a-1', {
      command: 'curl https://api.github.com/repos',
      source: 'skill',
    })

    // 3. Concurrently, Session B starts with additional allowed domains
    await createAgentSession({
      teamId: team.id,
      agentId: 'agent-1',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'Session B prompt',
      teamSkills: [],
      allowedDomains: ['api.github.com', 'pypi.org'],
      providers: mockProviders,
    })

    // Assert sandbox was hot-reloaded without any reset!
    expect(testProvider.resetCalls).toBe(0)
    expect(testProvider.updateConfigCalls).toBe(1)
    expect(sandboxService.getCurrentAllowedDomains()).toEqual(['api.github.com', 'pypi.org'])

    // 4. Concurrently, Session C starts with the same domains (should be no-op, no reset, no updateConfig)
    await createAgentSession({
      teamId: team.id,
      agentId: 'agent-1',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'Session C prompt',
      teamSkills: [],
      allowedDomains: ['pypi.org', 'api.github.com'],
      providers: mockProviders,
    })

    expect(testProvider.resetCalls).toBe(0)
    expect(testProvider.updateConfigCalls).toBe(1) // Still 1, no duplicate update

    // 5. Session A's command completes successfully
    mockStdout.emit('data', Buffer.from('{"status":"ok"}'))
    mockChild.emit('close', 0)

    const result = await sessionExecutionA
    expect(result.details).toEqual(
      expect.objectContaining({
        exitCode: 0,
      }),
    )

    // Verify command was wrapped with options containing commandId: 'call-session-a-1'
    expect(testProvider.wrapCommandCalls).toContainEqual({
      command: 'curl https://api.github.com/repos',
      options: { commandId: 'call-session-a-1' },
    })
  })

  it('isolates blocked host violations per commandId during concurrent execution', async () => {
    await sandboxService.ensureInitialized({ allowedDomains: ['api.github.com'] })

    // Command 1 and Command 2 run concurrently
    await sandboxService.wrapCommand('curl http://blocked1.com', { commandId: 'cmd-1' })
    await sandboxService.wrapCommand('curl http://blocked2.com', { commandId: 'cmd-2' })

    testProvider.violationsByCommandId.set('cmd-1', 'blocked1.com')
    testProvider.violationsByCommandId.set('cmd-2', 'blocked2.com')

    // Blocked hosts should be accurately isolated
    expect(sandboxService.getBlockedHost('cmd-1')).toBe('blocked1.com')
    expect(sandboxService.getBlockedHost('cmd-2')).toBe('blocked2.com')
    expect(sandboxService.getBlockedHost('cmd-unknown')).toBe('')
  })

  it('does not reject concurrent allowed command when another command is blocked', async () => {
    await sandboxService.ensureInitialized({ allowedDomains: ['api.github.com'] })

    const tool = createSandboxedBashTool('/mock/cwd', undefined, {
      getBlockedHost: (commandId?: string) => sandboxService.getBlockedHost(commandId),
      clearBlockedHost: () => sandboxService.clearBlockedHost(),
    })

    const childBlocked = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 101,
      kill: vi.fn(),
    })
    const childAllowed = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 102,
      kill: vi.fn(),
    })

    let spawnIndex = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock spawn implementation
    ;(spawn as any).mockImplementation(() => {
      spawnIndex++
      return spawnIndex === 1 ? childBlocked : childAllowed
    })

    // Record violation for the blocked command only
    testProvider.violationsByCommandId.set('call-blocked', 'blocked-target.com')

    const blockedExecution = tool.execute('call-blocked', {
      command: 'curl http://blocked-target.com',
      source: 'skill',
    })
    const allowedExecution = tool.execute('call-allowed', {
      command: 'curl https://api.github.com/data',
      source: 'skill',
    })

    await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(2))

    childBlocked.stdout.emit('data', Buffer.from('blocked output'))
    childBlocked.emit('close', 0)

    childAllowed.stdout.emit('data', Buffer.from('allowed output'))
    childAllowed.emit('close', 0)

    await expect(blockedExecution).rejects.toThrow(
      'Network request to blocked-target.com is blocked',
    )
    const allowedResult = await allowedExecution
    expect(allowedResult.details).toEqual(expect.objectContaining({ exitCode: 0 }))
  })

  it('does not synchronize or overwrite sandbox allowlist when allowedDomains is omitted (e.g. naming sessions)', async () => {
    const team = await prisma.team.create({
      data: { name: 'Omitted Domains Team' },
    })
    await prisma.user.create({
      data: {
        id: 'agent-omitted',
        name: 'Agent User',
        email: 'agent-omitted@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'agent-omitted',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    // 1. First session sets allowedDomains to ['*.github.com']
    await createAgentSession({
      teamId: team.id,
      agentId: 'agent-omitted',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'Main prompt',
      teamSkills: [],
      allowedDomains: ['*.github.com'],
      providers: mockProviders,
    })

    expect(sandboxService.getCurrentAllowedDomains()).toEqual(['*.github.com'])
    const updateCallsBefore = testProvider.updateConfigCalls

    // 2. Utility / naming session runs WITHOUT allowedDomains
    await createAgentSession({
      teamId: team.id,
      agentId: 'agent-omitted',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'Title generator',
      teamSkills: [],
      // allowedDomains omitted
      disableTools: true,
      providers: mockProviders,
    })

    // Assert sandbox was NOT touched or overwritten
    expect(testProvider.updateConfigCalls).toBe(updateCallsBefore)
    expect(sandboxService.getCurrentAllowedDomains()).toEqual(['*.github.com'])
  })
})
