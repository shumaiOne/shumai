import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RunnerFiles } from './files'
import { RunnerShell } from './shell'

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawn: vi.fn(),
}))

class CommandProcess extends EventEmitter {
  pid = 12345
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  stdout = new PassThrough()
  stderr = new PassThrough()
  kill = vi.fn(() => {
    this.finish(null, 'SIGKILL')
    return true
  })

  constructor() {
    super()
    let closed = 0
    for (const stream of [this.stdout, this.stderr])
      stream.once('close', () => {
        if (++closed === 2) this.emit('close')
      })
  }

  finish(code: number | null, signal: NodeJS.Signals | null = null, keepPipes = false) {
    this.exitCode = code
    this.signalCode = signal
    this.emit('exit', code, signal)
    if (!keepPipes) {
      this.stdout.end()
      this.stderr.end()
    }
  }
}

describe('Windows runner process lifecycle', () => {
  let cwd: string
  let shell: RunnerShell
  let child: CommandProcess
  let killedWhileRunning: boolean
  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'shumai-windows-shell-'))
    vi.stubGlobal('process', { ...process, platform: 'win32' })
    vi.stubEnv('SystemRoot', 'C:\\Windows')
    child = new CommandProcess()
    killedWhileRunning = false
    vi.mocked(spawn).mockImplementation((executable) => {
      if (String(executable).endsWith('taskkill.exe')) {
        killedWhileRunning = child.exitCode === null && child.signalCode === null
        const killer = new EventEmitter()
        setImmediate(() => {
          child.finish(null, 'SIGKILL')
          killer.emit('close', 0)
        })
        return killer as ChildProcess
      }
      return child as unknown as ChildProcess
    })
    shell = new RunnerShell(new RunnerFiles(cwd))
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    await rm(cwd, { recursive: true, force: true })
  })

  const request = { type: 'exec.start' as const, executionId: 'windows', command: 'echo hello' }

  it('uses Node shell launching and drains inherited pipes after the root exits', async () => {
    const running = shell.run(
      { ...request, timeoutSec: 0.2 },
      new AbortController().signal,
      () => {},
    )
    await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
    expect(spawn).toHaveBeenCalledWith(
      'echo hello',
      [],
      expect.objectContaining({
        shell: 'C:\\Windows\\System32\\cmd.exe',
        detached: false,
      }),
    )
    child.stdout.write('before exit')
    child.finish(7, null, true)
    const result = await running
    expect(result).toMatchObject({ exitCode: 7, timedOut: false, aborted: false })
    expect(child.stdout.destroyed && child.stderr.destroyed).toBe(true)
    expect(await readFile(path.join(cwd, result.fullOutputPath!), 'utf8')).toBe('before exit')
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it.each(['timeout', 'cancel'] as const)(
    'terminates a live Windows process tree on %s',
    async (kind) => {
      const controller = new AbortController()
      const running = shell.run({ ...request, timeoutSec: 0.2 }, controller.signal, () => {})
      await vi.waitFor(() => expect(spawn).toHaveBeenCalled())
      if (kind === 'cancel') controller.abort()
      const result = await running
      expect(result).toMatchObject({ timedOut: kind === 'timeout', aborted: kind === 'cancel' })
      expect(killedWhileRunning).toBe(true)
      expect(spawn).toHaveBeenCalledWith(
        'C:\\Windows\\System32\\taskkill.exe',
        ['/pid', '12345', '/t', '/f'],
        expect.objectContaining({ timeout: 5000, windowsHide: true }),
      )
    },
  )
})
