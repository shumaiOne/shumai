import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatSkillsForPrompt,
  createAgentSession,
  getModelFromDb,
  buildRestrictedUserInstructions,
  type DbProviderInfo,
} from './index'
import { createSandboxedBashTool } from './tools/sandboxed-bash'
import { SandboxManager, type SandboxAskCallback } from '@anthropic-ai/sandbox-runtime'
import { quotaService } from '@shumai/core/src/quota/quota-service'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { type TSchema } from 'typebox'
import { Value } from 'typebox/value'
import * as path from 'path'
import * as childProcess from 'node:child_process'
import * as fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockSpawn: any = null

vi.mock('node:child_process', async () => {
  const actual = (await vi.importActual('node:child_process')) as typeof childProcess
  return {
    ...actual,
    spawn: (...args: Parameters<typeof childProcess.spawn>) => {
      if (mockSpawn) {
        return mockSpawn(...args)
      }
      return actual.spawn(...args)
    },
  }
})

// Mock fs so tests can stub skill content loading (matching read-skill.test.ts)
vi.mock('fs')

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

describe('formatSkillsForPrompt', () => {
  it('should return empty string if skills array is empty', () => {
    expect(formatSkillsForPrompt([])).toBe('')
  })

  it('should format skills into the XML structure with absolute paths and escaped characters', () => {
    const skills = [
      {
        id: 'skill-1',
        name: 'Deploy & Test',
        description: 'Deploys code <deploy> and "runs" tests.',
      },
    ]

    const expectedLocation = path.join(process.cwd(), '.pi', 'skills', 'skill-1', 'SKILL.md')
    const result = formatSkillsForPrompt(skills)

    // Verify lines and XML elements
    expect(result).toContain('<available_skills>')
    expect(result).toContain('<skill>')
    expect(result).toContain('<id>skill-1</id>')
    expect(result).toContain('<name>Deploy &amp; Test</name>')
    expect(result).toContain(
      '<description>Deploys code &lt;deploy&gt; and &quot;runs&quot; tests.</description>',
    )
    expect(result).toContain(`<location>${expectedLocation}</location>`)
    expect(result).toContain('</skill>')
    expect(result).toContain('</available_skills>')
  })
})

describe('Sandbox Network isolation integration', () => {
  setupTestDbHooks()

  it('should register callback that pushes blocked hosts to database and propagates to bash tool', async () => {
    // 1. Create a team and enabled sandbox
    const team = await prisma.team.create({
      data: { name: 'Test Sandbox Team' },
    })
    await prisma.sandbox.create({
      data: {
        teamId: team.id,
        networkSandboxEnabled: true,
      },
    })

    // Ensure agent user and agent exist in database to avoid foreign key violation
    await prisma.user.create({
      data: {
        id: 'test-agent',
        name: 'Ai Agent',
        email: 'test-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'test-agent',
        teamId: team.id,
        type: 'chat',
        config: {
          provider: 'openai',
          model: 'gpt-4',
        },
      },
    })

    // 2. Mock / spy SandboxManager
    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    const wrapSpy = vi
      .spyOn(SandboxManager, 'wrapWithSandbox')
      .mockImplementation(async (cmd) => cmd)

    // 3. Call createAgentSession
    await createAgentSession({
      teamId: team.id,
      agentId: 'test-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      allowedDomains: [],
      providers: mockProviders,
    })

    // 4. Verify SandboxManager.initialize was called and extract the callback
    expect(initializeSpy).toHaveBeenCalled()
    const callback = initializeSpy.mock.calls[0][1]
    expect(callback).toBeDefined()

    // 5. Trigger the callback with a blocked host
    const result = await callback!({ host: 'blocked-api.com', port: 443 })
    expect(result).toBe(false) // should always return false to block

    // 6. Verify it was pushed to database
    const sandbox = await prisma.sandbox.findUnique({
      where: { teamId: team.id },
    })
    expect(sandbox?.pendingDomains).toContain('blocked-api.com')

    // 7. Verify that if the bash tool is run while a domain is blocked, it rejects with correct error
    const sandboxState = { blockedHost: '' }
    const bashTool = createSandboxedBashTool(
      process.cwd(),
      {},
      {
        getBlockedHost: () => sandboxState.blockedHost,
        clearBlockedHost: () => {
          sandboxState.blockedHost = ''
        },
      },
    )

    // Mock spawn to simulate process exit and trigger network block
    mockSpawn = () => {
      sandboxState.blockedHost = 'blocked-api.com'
      const mockChild = {
        pid: 123,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => cb(1), 10)
          }
        }),
      } as unknown as childProcess.ChildProcess
      return mockChild
    }

    const bashPromise = bashTool.execute('1', { command: 'curl blocked-api.com', source: 'user' })

    try {
      await expect(bashPromise).rejects.toThrow(
        'Network request to blocked-api.com is blocked, please ask admin to allow it in sandbox settings.',
      )
    } finally {
      mockSpawn = null
      initializeSpy.mockRestore()
      wrapSpy.mockRestore()
    }
  })

  it('should correctly route sandbox callback to the active session when multiple sessions are created sequentially', async () => {
    // 1. Create two teams
    const team1 = await prisma.team.create({
      data: { name: 'Team 1' },
    })
    const team2 = await prisma.team.create({
      data: { name: 'Team 2' },
    })
    await prisma.sandbox.create({
      data: { teamId: team1.id, networkSandboxEnabled: true },
    })
    await prisma.sandbox.create({
      data: { teamId: team2.id, networkSandboxEnabled: true },
    })

    // Ensure agent user and agents exist in database
    await prisma.user.create({
      data: {
        id: 'agent-1',
        name: 'Ai Agent 1',
        email: 'agent1@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.user.create({
      data: {
        id: 'agent-2',
        name: 'Ai Agent 2',
        email: 'agent2@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'agent-1',
        teamId: team1.id,
        type: 'chat',
        config: { provider: 'openai', model: 'gpt-4' },
      },
    })
    await prisma.agent.create({
      data: {
        id: 'agent-2',
        teamId: team2.id,
        type: 'chat',
        config: { provider: 'openai', model: 'gpt-4' },
      },
    })

    // Mock SandboxManager.initialize to behave like a process-global singleton
    let registeredCallback: SandboxAskCallback | null = null
    const initializeSpy = vi
      .spyOn(SandboxManager, 'initialize')
      .mockImplementation(async (config, cb) => {
        if (!registeredCallback) {
          registeredCallback = cb || null
        }
      })
    const resetSpy = vi.spyOn(SandboxManager, 'reset').mockImplementation(async () => {
      // In the real SandboxManager, reset clears the global initialization promise and servers,
      // which allows subsequent initialize calls to register a new callback.
      registeredCallback = null
    })

    try {
      // 2. Call createAgentSession for Session 1
      await createAgentSession({
        teamId: team1.id,
        agentId: 'agent-1',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
      })

      // 3. Call createAgentSession for Session 2
      await createAgentSession({
        teamId: team2.id,
        agentId: 'agent-2',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
      })

      expect(registeredCallback).toBeDefined()

      // 4. Trigger the globally registered callback (which is from Session 1)
      const result = await registeredCallback!({ host: 'blocked-for-session-2.com', port: 443 })
      expect(result).toBe(false)

      // 5. Verify that the pending domain was pushed to the DB record of Team 2
      const sandbox2 = await prisma.sandbox.findUnique({
        where: { teamId: team2.id },
      })
      expect(sandbox2?.pendingDomains).toContain('blocked-for-session-2.com')
    } finally {
      initializeSpy.mockRestore()
      resetSpy.mockRestore()
    }
  })

  it('should bypass domain blocking and pending domain recording when networkSandboxEnabled is false', async () => {
    const team = await prisma.team.create({
      data: { name: 'Disabled Sandbox Team' },
    })
    await prisma.sandbox.create({
      data: { teamId: team.id, networkSandboxEnabled: false },
    })

    await prisma.user.create({
      data: {
        id: 'agent-disabled',
        name: 'Ai Agent Disabled',
        email: 'disabled@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'agent-disabled',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'openai', model: 'gpt-4' },
      },
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    vi.spyOn(SandboxManager, 'wrapWithSandbox').mockImplementation(async (cmd) => cmd)

    await createAgentSession({
      teamId: team.id,
      agentId: 'agent-disabled',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      allowedDomains: ['*'],
      providers: mockProviders,
    })

    expect(initializeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        network: expect.objectContaining({
          allowedDomains: ['*'],
        }),
      }),
      expect.any(Function),
    )

    const callback = initializeSpy.mock.calls[0][1]
    const res = await callback!({ host: 'any-external-domain.com', port: 443 })
    expect(res).toBe(true)

    const sandbox = await prisma.sandbox.findUnique({
      where: { teamId: team.id },
    })
    expect(sandbox?.pendingDomains).toEqual([])
  })

  it('should pass thinkingLevel to AgentHarness and default to off', async () => {
    const team = await prisma.team.create({
      data: { name: 'Test Team' },
    })

    await prisma.user.create({
      data: {
        id: 'test-agent-1',
        name: 'Agent 1',
        email: 'agent1@test.com',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'test-agent-1',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    await prisma.user.create({
      data: {
        id: 'test-agent-2',
        name: 'Agent 2',
        email: 'agent2@test.com',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'test-agent-2',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      // Call createAgentSession with thinkingLevel
      const { harness: harnessHigh } = await createAgentSession({
        teamId: team.id,
        agentId: 'test-agent-1',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
        thinkingLevel: 'high',
      })
      expect(harnessHigh.getThinkingLevel()).toBe('high')

      // Call createAgentSession without thinkingLevel
      const { harness: harnessDefault } = await createAgentSession({
        teamId: team.id,
        agentId: 'test-agent-2',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
      })
      expect(harnessDefault.getThinkingLevel()).toBe('off')
    } finally {
      initializeSpy.mockRestore()
    }
  })

  it('should pass retry configuration to AgentHarness', async () => {
    const team = await prisma.team.create({
      data: { name: 'Test Team Retry' },
    })
    await prisma.user.create({
      data: {
        id: 'test-agent-retry',
        name: 'Agent Retry',
        email: 'agent-retry@test.com',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'test-agent-retry',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      const { harness } = await createAgentSession({
        teamId: team.id,
        agentId: 'test-agent-retry',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
        maxRetries: 5,
        baseDelayMs: 1500,
      })

      // @ts-expect-error accessing private property for verification
      expect(harness.streamOptions?.maxRetries).toBe(5)
    } finally {
      initializeSpy.mockRestore()
    }
  })

  it('should filter out denied tools from AgentHarness', async () => {
    const team = await prisma.team.create({
      data: { name: 'Test Team 3' },
    })
    await prisma.user.create({
      data: {
        id: 'test-agent-3',
        name: 'Agent 3',
        email: 'agent3@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'test-agent-3',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini', deniedTools: ['bash'] },
      },
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      const { harness } = await createAgentSession({
        teamId: team.id,
        agentId: 'test-agent-3',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
      })
      const tools = harness.getTools()
      const bashTool = tools.find((t) => t.name === 'bash')
      expect(bashTool).toBeUndefined()
      const readSkillTool = tools.find((t) => t.name === 'read_skill')
      expect(readSkillTool).toBeDefined()
    } finally {
      initializeSpy.mockRestore()
    }
  })
})

describe('getModelFromDb', () => {
  it('should correctly initialize non-built-in model with provider and id', () => {
    const providers: DbProviderInfo[] = [
      {
        name: 'google',
        config: { api: 'google-generative-ai', apiKey: 'GOOGLE_API_KEY' },
        models: [
          {
            modelId: 'non-existent-or-future-model',
            name: 'Future Model',
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

    const model = getModelFromDb(providers, 'google', 'non-existent-or-future-model')

    expect(model).toBeDefined()
    expect(model?.id).toBe('non-existent-or-future-model')
    expect(model?.provider).toBe('google')
    expect(model?.api).toBe('google-generative-ai')
  })

  it('should throw an error when provider or model is not found in database configuration', () => {
    expect(() => getModelFromDb([], 'google', 'non-existent')).toThrow(
      'Provider "google" or model "non-existent" not found in database configuration',
    )
  })
})

describe('createAgentSession sandbox options', () => {
  setupTestDbHooks()

  it('should set enableWeakerNestedSandbox based on ENABLE_WEAKER_NESTED_SANDBOX env var', async () => {
    const team = await prisma.team.create({
      data: { name: 'Test Sandbox Team Env' },
    })

    await prisma.user.create({
      data: {
        id: 'test-agent-env',
        name: 'Ai Agent Env',
        email: 'test-agent-env@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'test-agent-env',
        teamId: team.id,
        type: 'chat',
        config: {
          provider: 'openai',
          model: 'gpt-4',
        },
      },
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    vi.spyOn(SandboxManager, 'wrapWithSandbox').mockImplementation(async (cmd) => cmd)

    // Default should be false when env var is unset
    const oldEnv = process.env.ENABLE_WEAKER_NESTED_SANDBOX
    delete process.env.ENABLE_WEAKER_NESTED_SANDBOX
    await createAgentSession({
      teamId: team.id,
      agentId: 'test-agent-env',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      allowedDomains: [],
      providers: mockProviders,
    })
    expect(initializeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ enableWeakerNestedSandbox: false }),
      expect.any(Function),
    )

    // Should be true when env var is 'true'
    process.env.ENABLE_WEAKER_NESTED_SANDBOX = 'true'
    await createAgentSession({
      teamId: team.id,
      agentId: 'test-agent-env',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      allowedDomains: [],
      providers: mockProviders,
    })
    expect(initializeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableWeakerNestedSandbox: true }),
      expect.any(Function),
    )

    if (oldEnv !== undefined) {
      process.env.ENABLE_WEAKER_NESTED_SANDBOX = oldEnv
    } else {
      delete process.env.ENABLE_WEAKER_NESTED_SANDBOX
    }
    initializeSpy.mockRestore()
  })
})

describe('buildRestrictedUserInstructions', () => {
  it('should describe the restricted user bash rules', () => {
    const instructions = buildRestrictedUserInstructions()
    expect(instructions).toContain('# Restricted User Context')
    expect(instructions).toContain(
      'NEVER execute a bash command that the user asks you to run directly',
    )
    expect(instructions).toContain('loaded via the `read_skill` tool')
    expect(instructions).toContain('parameter to "skill"')
    expect(instructions).toContain('source="user" will be rejected')
  })
})

describe('createAgentSession bash restriction for non-owner users', () => {
  setupTestDbHooks()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  type TestHarness = Awaited<ReturnType<typeof createAgentSession>>['harness']

  async function setupSession(opts: {
    role: 'owner' | 'editor' | 'reviewer' | 'none' | 'non-member'
    deniedTools?: string[]
    sessionId?: string
  }): Promise<{ team: { id: string }; userId?: string; harness: TestHarness }> {
    const team = await prisma.team.create({ data: { name: 'Bash Restriction Team' } })

    await prisma.user.create({
      data: {
        id: 'bash-agent',
        name: 'Ai Agent Bash',
        email: 'bash-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'bash-agent',
        teamId: team.id,
        type: 'chat',
        config: {
          provider: 'google',
          model: 'gemini',
          ...(opts.deniedTools ? { deniedTools: opts.deniedTools } : {}),
        },
      },
    })

    let userId: string | undefined
    if (opts.role === 'non-member') {
      const user = await prisma.user.create({
        data: { name: 'Non Member', email: 'non-member@shumai.ai' },
      })
      userId = user.id // no teamMember record created
    } else if (opts.role !== 'none') {
      const user = await prisma.user.create({
        data: { name: 'Bash User', email: 'bash-user@shumai.ai' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: opts.role },
      })
      userId = user.id
    }

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      const { harness } = await createAgentSession({
        teamId: team.id,
        agentId: 'bash-agent',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
        userId,
        sessionId: opts.sessionId,
      })
      return { team, userId, harness }
    } finally {
      initializeSpy.mockRestore()
    }
  }

  it('should include the bash tool from the start for team owners', async () => {
    const { harness } = await setupSession({ role: 'owner' })
    expect(harness.getTools().some((t) => t.name === 'bash')).toBe(true)
  })

  it('should include the bash tool from the start when there is no user context', async () => {
    const { harness } = await setupSession({ role: 'none' })
    expect(harness.getTools().some((t) => t.name === 'bash')).toBe(true)
  })

  it('should treat a user who is not a team member as restricted (fail-closed)', async () => {
    const { harness } = await setupSession({ role: 'non-member' })
    const tools = harness.getTools()
    expect(tools.some((t) => t.name === 'bash')).toBe(false)
    expect(tools.some((t) => t.name === 'read_skill')).toBe(true)
    // @ts-expect-error accessing private property for verification
    const prompt = await harness.systemPrompt()
    expect(prompt).toContain('# Restricted User Context')
  })

  it.each(['editor', 'reviewer'] as const)(
    'should exclude the bash tool initially for %s users',
    async (role) => {
      const { harness } = await setupSession({ role })
      const tools = harness.getTools()
      expect(tools.some((t) => t.name === 'bash')).toBe(false)
      expect(tools.some((t) => t.name === 'read_skill')).toBe(true)
    },
  )

  it('should include the bash tool from the start when a skill was already loaded earlier in the session', async () => {
    const team = await prisma.team.create({ data: { name: 'Restore Team' } })
    const user = await prisma.user.create({
      data: { name: 'Restore User', email: 'restore@shumai.ai' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'reviewer' },
    })
    await prisma.user.create({
      data: {
        id: 'bash-agent-restore',
        name: 'Ai Agent Restore',
        email: 'bash-agent-restore@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'bash-agent-restore',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const session = await prisma.agentSession.create({
      data: {
        agentId: 'bash-agent-restore',
        userId: user.id,
        cwd: process.cwd(),
        type: 'chat',
      },
    })
    await prisma.agentSessionEntry.create({
      data: {
        id: 'restore-entry-1',
        sessionId: session.id,
        type: 'message',
        data: {
          message: {
            role: 'toolResult',
            content: [{ type: 'text', text: 'skill content restored' }],
            toolName: 'read_skill',
            isError: false,
            details: { skillId: 'previously-loaded-skill' },
            timestamp: Date.now(),
          },
        },
      },
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      const { harness } = await createAgentSession({
        teamId: team.id,
        agentId: 'bash-agent-restore',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
        userId: user.id,
        sessionId: session.id,
      })
      expect(harness.getTools().some((t) => t.name === 'bash')).toBe(true)
    } finally {
      initializeSpy.mockRestore()
    }
  })

  it('should inject the bash tool after a skill is loaded via read_skill for restricted users', async () => {
    const { team, harness } = await setupSession({ role: 'reviewer' })
    const skill = await prisma.skill.create({
      data: { name: 'Inject Skill', assetId: 'asset1', hash: 'inject-hash', teamId: team.id },
    })

    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.toString().endsWith('.hash')) return 'inject-hash'
      if (p.toString().endsWith('SKILL.md')) return '# Inject Skill'
      return ''
    })

    const readSkillTool = harness.getTools().find((t) => t.name === 'read_skill')
    expect(readSkillTool).toBeDefined()
    expect(harness.getTools().some((t) => t.name === 'bash')).toBe(false)
    expect(harness.getActiveTools().some((t) => t.name === 'bash')).toBe(false)

    await readSkillTool!.execute('1', { skillId: skill.id }, undefined, undefined, undefined)

    expect(harness.getTools().some((t) => t.name === 'bash')).toBe(true)
    // bash must be part of the ACTIVE tool set, not just the registry, or the model
    // would never receive it on the next turn
    expect(harness.getActiveTools().some((t) => t.name === 'bash')).toBe(true)
  })

  it('should not inject the bash tool for restricted users when bash is in deniedTools', async () => {
    const { team, harness } = await setupSession({ role: 'editor', deniedTools: ['bash'] })
    const skill = await prisma.skill.create({
      data: { name: 'Denied Skill', assetId: 'asset1', hash: 'denied-hash', teamId: team.id },
    })

    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.toString().endsWith('.hash')) return 'denied-hash'
      if (p.toString().endsWith('SKILL.md')) return '# Denied Skill'
      return ''
    })

    const readSkillTool = harness.getTools().find((t) => t.name === 'read_skill')
    expect(readSkillTool).toBeDefined()

    await readSkillTool!.execute('1', { skillId: skill.id }, undefined, undefined, undefined)

    expect(harness.getTools().some((t) => t.name === 'bash')).toBe(false)
  })

  it('should include restricted user instructions in the system prompt for non-owners', async () => {
    const { harness } = await setupSession({ role: 'editor' })
    // @ts-expect-error accessing private property for verification
    const prompt = await harness.systemPrompt()
    expect(prompt).toContain('# Restricted User Context')
    expect(prompt).toContain('source="user" will be rejected')
  })

  it('should not include restricted user instructions in the system prompt for owners', async () => {
    const { harness } = await setupSession({ role: 'owner' })
    // @ts-expect-error accessing private property for verification
    const prompt = await harness.systemPrompt()
    expect(prompt).not.toContain('# Restricted User Context')
  })
})

describe('createAgentSession typed metadata schema', () => {
  setupTestDbHooks()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function setupSessionWithProject(opts: { withCreationFields: boolean }) {
    const team = await prisma.team.create({ data: { name: 'Typed Metadata Team' } })
    const project = await prisma.project.create({
      data: { name: 'Typed Metadata Project', teamId: team.id },
    })
    const user = await prisma.user.create({
      data: { name: 'Typed Metadata User', email: 'typed-metadata@shumai.ai' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'owner' },
    })
    await prisma.user.create({
      data: {
        id: 'typed-metadata-agent',
        name: 'Ai Agent Typed Metadata',
        email: 'typed-metadata-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'typed-metadata-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    if (opts.withCreationFields) {
      await prisma.metadataField.create({
        data: {
          key: 'prompt',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: { name: 'Prompt', type: 'text', autofillSource: 'CREATION_CONTEXT' },
        },
      })
      await prisma.metadataField.create({
        data: {
          key: 'source',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: {
            name: 'Source',
            type: 'select',
            autofillSource: 'CREATION_CONTEXT',
            select: {
              options: [{ id: 'gemini', displayName: 'Gemini', color: '#ffffff' }],
            },
          },
        },
      })
      await prisma.metadataField.create({
        data: {
          key: 'manualNotes',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: { name: 'Manual Notes', type: 'text', autofillSource: 'NONE' },
        },
      })
    }

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      const { harness } = await createAgentSession({
        teamId: team.id,
        agentId: 'typed-metadata-agent',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        allowedDomains: [],
        providers: mockProviders,
        userId: user.id,
        projectId: project.id,
      })
      return { harness }
    } finally {
      initializeSpy.mockRestore()
    }
  }

  it('should build create_file/create_version with the project CREATION_CONTEXT fields', async () => {
    const { harness } = await setupSessionWithProject({ withCreationFields: true })
    const tools = harness.getTools()

    expect(tools.some((t) => t.name === 'list_autofill_fields')).toBe(false)

    const createFile = tools.find((t) => t.name === 'create_file')
    const createVersion = tools.find((t) => t.name === 'create_version')
    expect(createFile).toBeDefined()
    expect(createVersion).toBeDefined()

    const checkFile = (args: Record<string, unknown>) =>
      Value.Check(createFile!.parameters as unknown as TSchema, {
        parent: 'f1',
        path: '/tmp/x.md',
        data: null,
        ...args,
      })
    const checkVersion = (args: Record<string, unknown>) =>
      Value.Check(createVersion!.parameters as unknown as TSchema, {
        parent: 'f1',
        path: '/tmp/x.md',
        ...args,
      })

    for (const check of [checkFile, checkVersion]) {
      // Declared CREATION_CONTEXT fields (all-required, nullable) validate; other keys do not
      expect(check({ metadata: { prompt: 'hello', source: null } })).toBe(true)
      expect(check({ metadata: { prompt: null, source: 'gemini' } })).toBe(true)
      expect(check({ metadata: null })).toBe(true)
      expect(check({ metadata: { prompt: null, source: null, manualNotes: 'no' } })).toBe(false)
      expect(check({ metadata: { prompt: null, source: null, bogus: 1 } })).toBe(false)
      expect(check({ metadata: { prompt: 'hello' } })).toBe(false)
    }
  })

  it('should omit the metadata parameter when the project has no CREATION_CONTEXT fields', async () => {
    const { harness } = await setupSessionWithProject({ withCreationFields: false })
    const createFile = harness.getTools().find((t) => t.name === 'create_file')
    const createVersion = harness.getTools().find((t) => t.name === 'create_version')
    expect(createFile).toBeDefined()
    expect(createVersion).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting the runtime schema shape of the dynamically-built tool
    const fileProps = (createFile!.parameters as any).properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting the runtime schema shape of the dynamically-built tool
    const versionProps = (createVersion!.parameters as any).properties
    expect('metadata' in fileProps).toBe(false)
    expect('metadata' in versionProps).toBe(false)
  })
})

describe('createAgentSession enabled skill filtering', () => {
  setupTestDbHooks()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should only advertise and allow reading skills enabled for the agent', async () => {
    const team = await prisma.team.create({ data: { name: 'Skill Filter Team' } })

    const enabledSkill = await prisma.skill.create({
      data: {
        name: 'Enabled Skill',
        assetId: 'asset-enabled',
        hash: 'enabled-hash',
        teamId: team.id,
      },
    })
    const disabledSkill = await prisma.skill.create({
      data: {
        name: 'Disabled Skill',
        assetId: 'asset-disabled',
        hash: 'disabled-hash',
        teamId: team.id,
      },
    })

    await prisma.user.create({
      data: {
        id: 'skill-filter-agent',
        name: 'Ai Agent Skill Filter',
        email: 'skill-filter-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'skill-filter-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
        skills: {
          create: [{ skillId: enabledSkill.id }],
        },
      },
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      const { harness } = await createAgentSession({
        teamId: team.id,
        agentId: 'skill-filter-agent',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [{ id: enabledSkill.id, name: enabledSkill.name }],
        enabledSkillIds: [enabledSkill.id],
        allowedDomains: [],
        providers: mockProviders,
      })

      // The disabled skill must not be advertised in the available skills list
      // @ts-expect-error accessing private property for verification
      const prompt = await harness.systemPrompt()
      expect(prompt).toContain(enabledSkill.id)
      expect(prompt).not.toContain(disabledSkill.id)

      // read_skill must reject the disabled skill id
      const readSkillTool = harness.getTools().find((t) => t.name === 'read_skill')
      expect(readSkillTool).toBeDefined()

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        if (p.toString().endsWith('.hash')) return 'enabled-hash'
        if (p.toString().endsWith('SKILL.md')) return '# Enabled Skill'
        return ''
      })

      await expect(
        readSkillTool!.execute('1', { skillId: disabledSkill.id }, undefined, undefined, undefined),
      ).rejects.toThrow('not enabled for this agent')

      const result = await readSkillTool!.execute(
        '1',
        { skillId: enabledSkill.id },
        undefined,
        undefined,
        undefined,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.content[0] as any).text).toBe('# Enabled Skill')
    } finally {
      initializeSpy.mockRestore()
    }
  })

  it('should reject all read_skill calls when no skills are enabled for the agent', async () => {
    const team = await prisma.team.create({ data: { name: 'Skill None Team' } })
    const skill = await prisma.skill.create({
      data: { name: 'Unassigned Skill', assetId: 'asset-none', hash: 'none-hash', teamId: team.id },
    })

    await prisma.user.create({
      data: {
        id: 'skill-none-agent',
        name: 'Ai Agent Skill None',
        email: 'skill-none-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'skill-none-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      const { harness } = await createAgentSession({
        teamId: team.id,
        agentId: 'skill-none-agent',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        enabledSkillIds: [],
        allowedDomains: [],
        providers: mockProviders,
      })

      const readSkillTool = harness.getTools().find((t) => t.name === 'read_skill')
      expect(readSkillTool).toBeDefined()

      await expect(
        readSkillTool!.execute('1', { skillId: skill.id }, undefined, undefined, undefined),
      ).rejects.toThrow('not enabled for this agent')
    } finally {
      initializeSpy.mockRestore()
    }
  })

  it('enforces agent tool call count quota on tool execution', async () => {
    const team = await prisma.team.create({ data: { name: 'Tool Quota Enforcement Team' } })
    const user = await prisma.user.create({
      data: { name: 'Member User', email: 'member-tool-quota@shumai.ai', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'editor' },
    })
    await prisma.user.create({
      data: {
        id: 'tool-quota-agent',
        name: 'Tool Quota Agent',
        email: 'tool-quota-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'tool-quota-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_tool_call_count',
      resourceData: { name: 'read_thread' },
      limit: 1,
      period: '1hour',
      enabled: true,
    })

    const initializeSpy = vi.spyOn(SandboxManager, 'initialize').mockResolvedValue()
    try {
      const { harness } = await createAgentSession({
        teamId: team.id,
        userId: user.id,
        agentId: 'tool-quota-agent',
        providerName: 'google',
        modelId: 'gemini',
        systemPrompt: 'prompt',
        teamSkills: [],
        enabledSkillIds: [],
        allowedDomains: [],
        providers: mockProviders,
      })

      const readThreadTool = harness.getTools().find((t) => t.name === 'read_thread')
      expect(readThreadTool).toBeDefined()

      // First call executes and consumes quota
      const res1 = await readThreadTool!.execute(
        'call-1',
        { threadId: 'non-existent' },
        undefined,
        undefined,
        undefined,
      )
      expect(res1).toBeDefined()

      // Second call exceeds quota and returns error
      const res2 = await readThreadTool!.execute(
        'call-2',
        { threadId: 'non-existent' },
        undefined,
        undefined,
        undefined,
      )
      expect(res2).toBeDefined()
      const textContent = res2.content[0]
      if (textContent && textContent.type === 'text') {
        expect(textContent.text).toContain('Quota exceeded')
      } else {
        expect.unreachable('Expected text content')
      }
    } finally {
      initializeSpy.mockRestore()
    }
  })
})

describe('getModelFromDb', () => {
  it('should prioritize provider active api protocol over model config api', () => {
    const providers: DbProviderInfo[] = [
      {
        name: 'custom-provider',
        config: { api: 'anthropic-messages', apiKey: 'KEY' },
        models: [
          {
            modelId: 'my-model',
            name: 'My Model',
            config: {
              api: 'openai-responses', // stale model config
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 4096,
            },
          },
        ],
      },
    ]

    const model = getModelFromDb(providers, 'custom-provider', 'my-model')
    expect(model.api).toBe('anthropic-messages')
  })
})
