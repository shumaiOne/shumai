import { describe, it, expect, vi } from 'vitest'
import { formatSkillsForPrompt, createAgentSession } from './index'
import { createSandboxedBashTool } from './tools/sandboxed-bash'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import * as path from 'path'
import * as childProcess from 'node:child_process'

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
    // 1. Create a team
    const team = await prisma.team.create({
      data: { name: 'Test Sandbox Team' },
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
      providers: [],
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
    expect(sandbox?.pendingDomains).toContain('blocked-api.com:443')

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
      sandboxState.blockedHost = 'blocked-api.com:443'
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

    const bashPromise = bashTool.execute('1', { command: 'curl blocked-api.com' })

    try {
      await expect(bashPromise).rejects.toThrow(
        'Network request to blocked-api.com:443 is blocked, please ask admin to allow it in sandbox settings.',
      )
    } finally {
      mockSpawn = null
      initializeSpy.mockRestore()
      wrapSpy.mockRestore()
    }
  })
})
