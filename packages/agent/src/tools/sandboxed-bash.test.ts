import { invokeTool } from '@shumai/core/src/agent/tool-test-utils'
import { runnerService } from '@shumai/core/src/runner'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSandboxedBashTool } from './sandboxed-bash'

vi.mock('@shumai/core/src/runner', () => ({
  runnerService: {
    requireOnlineRunner: vi.fn(),
    isRunnerConnected: vi.fn(),
    ensureSkillOnRunner: vi.fn(),
    ensureGeneratedFileOnRunner: vi.fn(),
    exec: vi.fn(),
  },
}))

describe('createSandboxedBashTool', () => {
  const mockCwd = '/mock/cwd'
  const mockTeamId = 'team-1'
  const mockRunner = {
    id: 'runner-1',
    teamId: mockTeamId,
    name: 'Local Mac Mini',
    keyPrefix: 'shm_rn_12345678',
    isDefault: true,
    status: 'connected' as const,
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runnerService.requireOnlineRunner).mockResolvedValue(mockRunner)
    vi.mocked(runnerService.isRunnerConnected).mockReturnValue(true)
    vi.mocked(runnerService.ensureSkillOnRunner).mockResolvedValue('.pi/skills/skill-1')
    vi.mocked(runnerService.ensureGeneratedFileOnRunner).mockResolvedValue(
      '.pi/generated/gen1/input.png',
    )
  })

  const createMockSignal = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- signal needs to be partially compatible with AbortSignal
    const signal = new EventEmitter() as any
    signal.addEventListener = vi.fn((event: string, cb: (ev: Event) => unknown) => {
      signal.on(event, cb)
    })
    signal.removeEventListener = vi.fn((event: string, cb: (ev: Event) => unknown) => {
      signal.off(event, cb)
    })
    signal.aborted = false
    return signal
  }

  const createMockOnUpdate = () => vi.fn()

  it('should execute a command on the runner with injected env vars', async () => {
    const tool = createSandboxedBashTool(
      mockCwd,
      { TEST_ENV: 'test-value' },
      {
        teamId: mockTeamId,
        agentRunnerId: null,
      },
    )

    vi.mocked(runnerService.exec).mockImplementation(async (_runnerId, opts) => {
      opts.onOutput?.('hello output', 'stdout')
      return {
        executionId: 'exec-1',
        output: 'hello output',
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
      }
    })

    const onUpdate = createMockOnUpdate()
    const signal = createMockSignal()

    const result = await invokeTool(
      tool,
      '1',
      { command: 'echo hello', source: 'user' },
      signal,
      onUpdate,
    )

    expect(runnerService.requireOnlineRunner).toHaveBeenCalledWith(mockTeamId, null)
    expect(runnerService.exec).toHaveBeenCalledWith(
      'runner-1',
      expect.objectContaining({
        command: 'echo hello',
        env: { TEST_ENV: 'test-value' },
        collectOutput: false,
      }),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ToolResponse content is an array of content blocks
    expect((result as any).content[0].text).toContain('hello output')
    expect(onUpdate).toHaveBeenCalled()
  })

  it('should stage loaded skills and inputFiles before executing', async () => {
    const loadedSkills = [{ id: 'skill-1', assetId: 'asset-1', hash: 'hash-1' }]
    const tool = createSandboxedBashTool(
      mockCwd,
      {},
      {
        teamId: mockTeamId,
        agentRunnerId: 'runner-pinned',
        getLoadedSkills: () => loadedSkills,
      },
    )

    vi.mocked(runnerService.exec).mockResolvedValue({
      executionId: 'exec-1',
      output: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
      aborted: false,
    })

    await invokeTool(
      tool,
      '1',
      {
        command: 'ffmpeg -i .pi/generated/gen1/input.png out.mp4',
        source: 'user',
        inputFiles: ['.pi/generated/gen1/input.png'],
      },
      createMockSignal(),
    )

    expect(runnerService.requireOnlineRunner).toHaveBeenCalledWith(mockTeamId, 'runner-pinned')
    expect(runnerService.ensureSkillOnRunner).toHaveBeenCalledWith('runner-1', loadedSkills[0])
    expect(runnerService.ensureGeneratedFileOnRunner).toHaveBeenCalledWith(
      'runner-1',
      '.pi/generated/gen1/input.png',
    )
  })

  it('should block user-requested commands when restrictedUser is enabled', async () => {
    const tool = createSandboxedBashTool(
      mockCwd,
      {},
      {
        teamId: mockTeamId,
        restrictedUser: true,
      },
    )

    const signal = createMockSignal()
    await expect(
      invokeTool(tool, '1', { command: 'echo hack', source: 'user' }, signal, createMockOnUpdate()),
    ).rejects.toThrow(/not permitted for your role/)

    expect(runnerService.exec).not.toHaveBeenCalled()
  })

  it('should allow skill-requested commands when restrictedUser is enabled', async () => {
    const tool = createSandboxedBashTool(
      mockCwd,
      {},
      {
        teamId: mockTeamId,
        restrictedUser: true,
      },
    )

    vi.mocked(runnerService.exec).mockImplementation(async (_runnerId, opts) => {
      opts.onOutput?.('skill output', 'stdout')
      return {
        executionId: 'exec-1',
        output: 'skill output',
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
      }
    })

    const signal = createMockSignal()
    const result = await invokeTool(tool, '1', { command: 'echo skill', source: 'skill' }, signal)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ToolResponse content is an array of content blocks
    expect((result as any).content[0].text).toContain('skill output')
  })

  it('should handle runner execution errors', async () => {
    const tool = createSandboxedBashTool(mockCwd, {}, { teamId: mockTeamId })

    vi.mocked(runnerService.exec).mockRejectedValue(new Error('Runner disconnected'))

    const signal = createMockSignal()
    await expect(
      invokeTool(tool, '1', { command: 'fail', source: 'user' }, signal, createMockOnUpdate()),
    ).rejects.toThrow('Runner disconnected')
  })

  it('should handle non-zero exit codes', async () => {
    const tool = createSandboxedBashTool(mockCwd, {}, { teamId: mockTeamId })

    vi.mocked(runnerService.exec).mockResolvedValue({
      executionId: 'exec-1',
      output: '',
      exitCode: 1,
      signal: null,
      timedOut: false,
      aborted: false,
    })

    const signal = createMockSignal()
    await expect(
      invokeTool(tool, '1', { command: 'exit 1', source: 'user' }, signal, createMockOnUpdate()),
    ).rejects.toThrow(/exited with code 1/)
  })

  it('should handle timeouts', async () => {
    const tool = createSandboxedBashTool(mockCwd, {}, { teamId: mockTeamId })

    vi.mocked(runnerService.exec).mockImplementation(async (_runnerId, opts) => {
      opts.onOutput?.('output before timeout\n', 'stdout')
      return {
        executionId: 'exec-1',
        output: 'output before timeout\n',
        exitCode: null,
        signal: 'SIGKILL',
        timedOut: true,
        aborted: false,
      }
    })

    const signal = createMockSignal()
    const executePromise = invokeTool(
      tool,
      '1',
      { command: 'sleep 10', timeout: 2, source: 'user' },
      signal,
      createMockOnUpdate(),
    )

    await expect(executePromise).rejects.toThrow(/output before timeout/)
    await expect(executePromise).rejects.toThrow(/timed out after 2 seconds/)
  })

  it('should handle abort signals', async () => {
    const tool = createSandboxedBashTool(mockCwd, {}, { teamId: mockTeamId })

    vi.mocked(runnerService.exec).mockResolvedValue({
      executionId: 'exec-1',
      output: '',
      exitCode: null,
      signal: 'SIGKILL',
      timedOut: false,
      aborted: true,
    })

    const signal = createMockSignal()
    await expect(
      invokeTool(tool, '1', { command: 'long-run', source: 'user' }, signal, createMockOnUpdate()),
    ).rejects.toThrow(/aborted/)
  })

  it('should truncate output exceeding max lines (2000 lines) and report runner log file path', async () => {
    const tool = createSandboxedBashTool(mockCwd, {}, { teamId: mockTeamId })

    vi.mocked(runnerService.exec).mockImplementation(async (_runnerId, opts) => {
      const lines: string[] = []
      for (let i = 1; i <= 3000; i++) {
        lines.push(`line-${i}`)
      }
      const chunk = lines.join('\n') + '\n'
      opts.onOutput?.(chunk, 'stdout')
      return {
        executionId: 'exec1',
        output: chunk,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        fullOutputPath: '.pi/logs/bash-exec1.log',
      }
    })

    const signal = createMockSignal()
    const result = await invokeTool(
      tool,
      '1',
      { command: 'generate lines', source: 'user' },
      signal,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- content block array
    const text = (result as any).content[0].text
    expect(text).toContain('line-3000')
    expect(text).toContain(
      '[Showing lines 1001-3000 of 3000. Full output: .pi/logs/bash-exec1.log]',
    )
    expect(result.details?.truncation).toMatchObject({
      truncated: true,
      truncatedBy: 'lines',
      totalLines: 3000,
      outputLines: 2000,
    })
    expect(result.details?.fullOutputPath).toBe('.pi/logs/bash-exec1.log')
  })

  it('should truncate output exceeding max bytes (50KB) and report partial line size', async () => {
    const tool = createSandboxedBashTool(mockCwd, {}, { teamId: mockTeamId })

    vi.mocked(runnerService.exec).mockImplementation(async (_runnerId, opts) => {
      const longLine = 'a'.repeat(60000)
      opts.onOutput?.(longLine, 'stdout')
      return {
        executionId: 'exec2',
        output: longLine,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        fullOutputPath: '.pi/logs/bash-exec2.log',
      }
    })

    const signal = createMockSignal()
    const result = await invokeTool(
      tool,
      '1',
      { command: 'long single line', source: 'user' },
      signal,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- content block array
    const text = (result as any).content[0].text
    expect(text).toMatch(
      /Showing last 50\.0KB of line 1 \(line is 58\.6KB\)\. Full output: \.pi\/logs\/bash-exec2\.log/,
    )
  })
})
