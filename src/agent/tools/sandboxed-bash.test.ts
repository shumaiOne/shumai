import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSandboxedBashTool } from './sandboxed-bash'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(SandboxManager.wrapWithSandbox as any).mockImplementation(async (cmd: string) => `sandboxed-${cmd}`)
  })

  const createMockSignal = () => {
    const signal = new EventEmitter() as any
    signal.addEventListener = vi.fn((event: string, cb: any) => {
      signal.on(event, cb)
    })
    signal.removeEventListener = vi.fn((event: string, cb: any) => {
      signal.off(event, cb)
    })
    signal.aborted = false
    return signal
  }

  const createMockOnUpdate = () => vi.fn()

  it('should execute a command in the sandbox with injected env vars', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager as any)
    
    const mockStdout = new EventEmitter()
    const mockStderr = new EventEmitter()
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: mockStdout,
      stderr: mockStderr,
      pid: 123,
      kill: vi.fn(),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(spawn as any).mockReturnValue(mockChild)

    const onUpdate = createMockOnUpdate()
    const signal = createMockSignal()
    
    const executePromise = tool.execute('1', { command: 'echo hello' }, signal, onUpdate, {} as any)

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    
    expect(SandboxManager.wrapWithSandbox).toHaveBeenCalledWith('echo hello')
    expect(spawn).toHaveBeenCalledWith('bash', ['-c', 'sandboxed-echo hello'], expect.objectContaining({
      env: { TEST_ENV: 'test-value' }
    }))

    // Simulate stdout data
    mockStdout.emit('data', Buffer.from('hello output'))
    mockChild.emit('close', 0)

    const result = await executePromise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).content[0].text).toContain('hello output')
  })

  it('should handle process errors', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager as any)
    const mockChild = new EventEmitter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(spawn as any).mockReturnValue(mockChild)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'fail' }, signal, createMockOnUpdate(), {} as any)
    
    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    mockChild.emit('error', new Error('spawn failed'))

    await expect(executePromise).rejects.toThrow('spawn failed')
  })

  it('should handle non-zero exit codes', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager as any)
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 1,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(spawn as any).mockReturnValue(mockChild)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'exit 1' }, signal, createMockOnUpdate(), {} as any)
    
    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    mockChild.emit('close', 1)

    await expect(executePromise).rejects.toThrow(/exited with code 1/)
  })

  it('should handle timeouts', async () => {
    vi.useFakeTimers()
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager as any)
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 456,
      kill: vi.fn(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(spawn as any).mockReturnValue(mockChild)
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as any)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'sleep 10', timeout: 2 }, signal, createMockOnUpdate(), {} as any)

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    
    await vi.advanceTimersByTimeAsync(2100)
    
    expect(killSpy).toHaveBeenCalledWith(-456, 'SIGKILL')
    
    mockChild.emit('close', null)

    await expect(executePromise).rejects.toThrow(/timed out/)
    vi.useRealTimers()
    killSpy.mockRestore()
  })

  it('should handle abort signals', async () => {
    const tool = createSandboxedBashTool(mockCwd, mockSessionManager as any)
    const mockChild = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 789,
      kill: vi.fn(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(spawn as any).mockReturnValue(mockChild)
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as any)

    const signal = createMockSignal()
    const executePromise = tool.execute('1', { command: 'long-run' }, signal, createMockOnUpdate(), {} as any)

    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    
    signal.aborted = true
    signal.emit('abort')
    
    expect(killSpy).toHaveBeenCalledWith(-789, 'SIGKILL')
    
    mockChild.emit('close', null)

    await expect(executePromise).rejects.toThrow(/aborted/)
    killSpy.mockRestore()
  })
})
