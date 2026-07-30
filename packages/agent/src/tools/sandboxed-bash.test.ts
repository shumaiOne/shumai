import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSandboxedBashTool } from './sandboxed-bash'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'

vi.mock('@anthropic-ai/sandbox-runtime')
vi.mock('node:child_process')

describe('createSandboxedBashTool', () => {
  const mockCwd = '/mock/cwd'
  const mockSessionManager = {
    getSkillEnvs: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionManager.getSkillEnvs.mockReturnValue({ TEST_ENV: 'test-value' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SandboxManager.wrapWithSandbox is a mocked async function from a 3rd party library
    ;(SandboxManager.wrapWithSandbox as any).mockImplementation(
      async (cmd: string) => `sandboxed-${cmd}`,
    )
  })

  const createMockSignal = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- signal needs to be partially compatible with AbortSignal but we need to emit events for testing
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

  it('should execute a command in the sandbox with injected env vars', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager.getSkillEnvs())

    const mockStdout = new EventEmitter()
    const mockStderr = new EventEmitter()
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: mockStdout,
      stderr: mockStderr,
      pid: 123,
      kill: vi.fn(),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spawn is mocked to return a partial ChildProcess
    ;(spawn as any).mockReturnValue(mockChild)

    const onUpdate = createMockOnUpdate()
    const signal = createMockSignal()

    // pi-coding-agent AgentTool.execute signature: (toolCallId, params, signal?, onUpdate?)
    const executePromise = tool.execute('1', { command: 'echo hello' }, signal, onUpdate)

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())

    expect(SandboxManager.wrapWithSandbox).toHaveBeenCalledWith('echo hello')
    expect(spawn).toHaveBeenCalledWith(
      'bash',
      ['-c', 'sandboxed-echo hello'],
      expect.objectContaining({
        env: expect.objectContaining({
          TEST_ENV: 'test-value',
        }),
      }),
    )

    // Simulate stdout data
    mockStdout.emit('data', Buffer.from('hello output'))
    mockChild.emit('close', 0)

    const result = await executePromise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ToolResponse content is an array of content blocks
    expect((result as any).content[0].text).toContain('hello output')
  })

  it('should handle process errors', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager.getSkillEnvs())
    const mockChild = new EventEmitter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spawn returns mocked ChildProcess
    ;(spawn as any).mockReturnValue(mockChild)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'fail' }, signal, createMockOnUpdate())

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    mockChild.emit('error', new Error('spawn failed'))

    await expect(executePromise).rejects.toThrow('spawn failed')
  })

  it('should handle non-zero exit codes', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager.getSkillEnvs())
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 1,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spawn returns mocked ChildProcess
    ;(spawn as any).mockReturnValue(mockChild)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'exit 1' }, signal, createMockOnUpdate())

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    mockChild.emit('close', 1)

    await expect(executePromise).rejects.toThrow(/exited with code 1/)
  })

  it('should handle timeouts', async () => {
    vi.useFakeTimers()

    const tool = createSandboxedBashTool(mockCwd, mockSessionManager.getSkillEnvs())
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 456,
      kill: vi.fn(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spawn returns mocked ChildProcess
    ;(spawn as any).mockReturnValue(mockChild)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- process.kill return type is boolean
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as any)

    const signal = createMockSignal()
    const executePromise = tool.execute(
      '1',
      { command: 'sleep 10', timeout: 2 },
      signal,
      createMockOnUpdate(),
    )

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())

    await vi.advanceTimersByTimeAsync(2100)

    expect(killSpy).toHaveBeenCalledWith(-456, 'SIGKILL')

    mockChild.emit('close', null)

    await expect(executePromise).rejects.toThrow(/timed out/)
    vi.useRealTimers()
    killSpy.mockRestore()
  })

  it('should handle abort signals', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager.getSkillEnvs())
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 789,
      kill: vi.fn(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spawn returns mocked ChildProcess
    ;(spawn as any).mockReturnValue(mockChild)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- process.kill return type is boolean
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as any)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'long-run' }, signal, createMockOnUpdate())

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())

    signal.aborted = true
    signal.emit('abort')

    expect(killSpy).toHaveBeenCalledWith(-789, 'SIGKILL')

    mockChild.emit('close', null)

    await expect(executePromise).rejects.toThrow(/aborted/)
    killSpy.mockRestore()
  })

  it('should truncate output exceeding max lines (2000 lines) and persist full output to temp file', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager.getSkillEnvs())
    const mockStdout = new EventEmitter()
    const mockStderr = new EventEmitter()
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: mockStdout,
      stderr: mockStderr,
      pid: 101,
      kill: vi.fn(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spawn returns mocked ChildProcess
    ;(spawn as any).mockReturnValue(mockChild)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'generate lines' }, signal)

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())

    const lines: string[] = []
    for (let i = 1; i <= 3000; i++) {
      lines.push(`line-${i}`)
    }
    mockStdout.emit('data', Buffer.from(lines.join('\n') + '\n'))
    mockChild.emit('close', 0)

    const result = await executePromise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- content block array
    const text = (result as any).content[0].text
    expect(text).toContain('line-3000')
    expect(text).toContain('[Showing lines 1001-3000 of 3000. Full output:')
    expect(result.details?.truncation).toMatchObject({
      truncated: true,
      truncatedBy: 'lines',
      totalLines: 3000,
      outputLines: 2000,
    })

    expect(result.details?.fullOutputPath).toBeDefined()
    const fileContent = await readFile(result.details!.fullOutputPath!, 'utf-8')
    expect(fileContent).toContain('line-1\nline-2')
    expect(fileContent).toContain('line-2999\nline-3000')
  })

  it('should truncate output exceeding max bytes (50KB) and report partial line size', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager.getSkillEnvs())
    const mockStdout = new EventEmitter()
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: mockStdout,
      stderr: new EventEmitter(),
      pid: 102,
      kill: vi.fn(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spawn returns mocked ChildProcess
    ;(spawn as any).mockReturnValue(mockChild)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'long single line' }, signal)

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())

    const longLine = 'a'.repeat(60000)
    mockStdout.emit('data', Buffer.from(longLine))
    mockChild.emit('close', 0)

    const result = await executePromise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- content block array
    const text = (result as any).content[0].text
    expect(text).toMatch(/Showing last 50\.0KB of line 1 \(line is 58\.6KB\)\. Full output:/)
  })

  it('should preserve truncated output when a command times out', async () => {
    vi.useFakeTimers()
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager.getSkillEnvs())
    const mockStdout = new EventEmitter()
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: mockStdout,
      stderr: new EventEmitter(),
      pid: 103,
      kill: vi.fn(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spawn returns mocked ChildProcess
    ;(spawn as any).mockReturnValue(mockChild)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- process.kill return type boolean
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as any)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'slow', timeout: 1 }, signal)

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())

    mockStdout.emit('data', Buffer.from('output before timeout\n'))
    await vi.advanceTimersByTimeAsync(1100)
    mockChild.emit('close', null)

    await expect(executePromise).rejects.toThrow(/output before timeout/)
    await expect(executePromise).rejects.toThrow(/timed out after 1 seconds/)

    vi.useRealTimers()
    killSpy.mockRestore()
  })
})
