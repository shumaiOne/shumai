import { invokeTool } from '@shumai/core/src/agent/tool-test-utils'
import { hashRunnerKey, runnerService, type RunnerSocket } from '@shumai/core/src/runner'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAgentSession, type DbProviderInfo } from './index'
import { closeAgentSessions } from './runtime'
import { createSandboxedBashTool } from './tools/sandboxed-bash'

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

function createMockWs() {
  const sent: string[] = []
  const ws: RunnerSocket = {
    send: vi.fn((data: string) => {
      sent.push(data)
    }),
    close: vi.fn(),
  }
  return {
    ws,
    sent,
    lastSentJson: () => (sent.length > 0 ? JSON.parse(sent[sent.length - 1]) : null),
  }
}

describe('Concurrent Runner Sessions', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await closeAgentSessions()
  })

  it('executes concurrent bash commands on the same runner with isolated executionIds', async () => {
    const team = await prisma.team.create({
      data: { name: 'Concurrent Runner Team' },
    })
    const { runner, key } = await runnerService.createRunner(team.id, { name: 'Shared Runner' })
    const conn = createMockWs()
    await runnerService.registerConnection(
      { id: runner.id, teamId: team.id, name: runner.name, keyHash: hashRunnerKey(key) },
      conn.ws,
    )

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

    await createAgentSession({
      teamId: team.id,
      agentId: 'agent-1',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'Session A prompt',
      teamSkills: [],
      providers: mockProviders,
    })

    const tool = createSandboxedBashTool('/mock/cwd', {}, { teamId: team.id })

    // Note: registerConnection sends a 'welcome' message first (conn.sent[0])
    const execA = invokeTool(tool, 'call-a', {
      command: 'echo session-a',
      source: 'skill',
    })
    await vi.waitFor(() => expect(conn.sent.length).toBe(2))
    const msgA = JSON.parse(conn.sent[1])

    const execB = invokeTool(tool, 'call-b', {
      command: 'echo session-b',
      source: 'skill',
    })
    await vi.waitFor(() => expect(conn.sent.length).toBe(3))
    const msgB = JSON.parse(conn.sent[2])

    expect(msgA.executionId).not.toBe(msgB.executionId)

    // Interleave output and completion for A and B
    runnerService.handleMessage(
      runner.id,
      conn.ws,
      JSON.stringify({
        type: 'exec.output',
        executionId: msgB.executionId,
        stream: 'stdout',
        offset: 0,
        data: 'out-b',
      }),
    )
    runnerService.handleMessage(
      runner.id,
      conn.ws,
      JSON.stringify({
        type: 'exec.output',
        executionId: msgA.executionId,
        stream: 'stdout',
        offset: 0,
        data: 'out-a',
      }),
    )
    runnerService.handleMessage(
      runner.id,
      conn.ws,
      JSON.stringify({
        type: 'exec.result',
        executionId: msgA.executionId,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
      }),
    )
    runnerService.handleMessage(
      runner.id,
      conn.ws,
      JSON.stringify({
        type: 'exec.result',
        executionId: msgB.executionId,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
      }),
    )

    const [resA, resB] = await Promise.all([execA, execB])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ToolResponse content blocks
    expect((resA as any).content[0].text).toContain('out-a')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ToolResponse content blocks
    expect((resB as any).content[0].text).toContain('out-b')

    runnerService.handleDisconnect(runner.id, conn.ws)
  })

  it('routes agent commands to their bound runner or team default runner independently', async () => {
    const team = await prisma.team.create({
      data: { name: 'Multi Runner Team' },
    })
    const { runner: defaultRunner, key: defaultKey } = await runnerService.createRunner(team.id, {
      name: 'Default Runner',
      isDefault: true,
    })
    const { runner: gpuRunner, key: gpuKey } = await runnerService.createRunner(team.id, {
      name: 'GPU Runner',
      isDefault: false,
    })

    const defaultConn = createMockWs()
    const gpuConn = createMockWs()
    await runnerService.registerConnection(
      {
        id: defaultRunner.id,
        teamId: team.id,
        name: defaultRunner.name,
        keyHash: hashRunnerKey(defaultKey),
      },
      defaultConn.ws,
    )
    await runnerService.registerConnection(
      {
        id: gpuRunner.id,
        teamId: team.id,
        name: gpuRunner.name,
        keyHash: hashRunnerKey(gpuKey),
      },
      gpuConn.ws,
    )

    const defaultTool = createSandboxedBashTool(
      '/mock/cwd',
      {},
      {
        teamId: team.id,
        agentRunnerId: null,
      },
    )
    const gpuTool = createSandboxedBashTool(
      '/mock/cwd',
      {},
      {
        teamId: team.id,
        agentRunnerId: gpuRunner.id,
      },
    )

    const pDefault = invokeTool(defaultTool, '1', { command: 'uname -a', source: 'user' })
    const pGpu = invokeTool(gpuTool, '2', { command: 'nvidia-smi', source: 'user' })

    await vi.waitFor(() => {
      expect(defaultConn.lastSentJson()?.type).toBe('exec.start')
      expect(gpuConn.lastSentJson()?.type).toBe('exec.start')
    })

    const defaultMsg = defaultConn.lastSentJson()
    const gpuMsg = gpuConn.lastSentJson()
    expect(defaultMsg.command).toBe('uname -a')
    expect(gpuMsg.command).toBe('nvidia-smi')

    runnerService.handleMessage(
      defaultRunner.id,
      defaultConn.ws,
      JSON.stringify({
        type: 'exec.result',
        executionId: defaultMsg.executionId,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
      }),
    )
    runnerService.handleMessage(
      gpuRunner.id,
      gpuConn.ws,
      JSON.stringify({
        type: 'exec.result',
        executionId: gpuMsg.executionId,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
      }),
    )

    await Promise.all([pDefault, pGpu])
    runnerService.handleDisconnect(defaultRunner.id, defaultConn.ws)
    runnerService.handleDisconnect(gpuRunner.id, gpuConn.ws)
  })
})
