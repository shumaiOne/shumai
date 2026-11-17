import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import {
  runnerEnvironmentSchema,
  type RunnerExecResultMessage,
  type RunnerExecStartMessage,
} from '@shumai/dtos'
import { commandEnv, runnerShell } from './config'
import { RunnerFiles } from './files'
import { loadSandbox } from './srt'

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024
const MAX_TIMEOUT_SEC = 3600

export class RunnerShell {
  readonly environment = runnerEnvironmentSchema.parse({
    platform: process.platform,
    shell: runnerShell(),
  })
  private sandbox?: Awaited<ReturnType<typeof loadSandbox>>
  private initialized = false
  private active = 0

  constructor(
    private readonly files: RunnerFiles,
    private readonly srtPath?: string,
  ) {}

  async initialize() {
    if (!this.srtPath) return
    // Read and validate once; commands cannot weaken the policy by editing the file.
    this.sandbox = await loadSandbox(this.srtPath)
    try {
      await SandboxManager.initialize(this.sandbox.config)
      this.initialized = true
      let diagnostic = ''
      const probe = await this.run(
        { type: 'exec.start', executionId: randomUUID(), command: 'exit 0', timeoutSec: 15 },
        new AbortController().signal,
        (_stream, data) => {
          diagnostic = (diagnostic + data).slice(-4096)
        },
      )
      if (probe.exitCode !== 0 || probe.error || probe.timedOut)
        throw new Error(
          `SRT preflight failed: ${probe.error || diagnostic.trim() || 'Check settings and local SRT prerequisites.'}`,
        )
    } catch (error) {
      await this.close()
      throw error
    }
  }

  async close() {
    if (!this.sandbox) return
    try {
      await SandboxManager.reset()
    } finally {
      await this.sandbox.cleanup()
      this.sandbox = undefined
      this.initialized = false
    }
  }

  async run(
    message: RunnerExecStartMessage,
    signal: AbortSignal,
    output: (stream: 'stdout' | 'stderr', data: string) => void,
  ): Promise<RunnerExecResultMessage> {
    const result: RunnerExecResultMessage = {
      type: 'exec.result',
      executionId: message.executionId,
      exitCode: null,
      signal: null,
      timedOut: false,
      aborted: false,
    }
    if (this.srtPath) this.active++
    try {
      if (signal.aborted) return { ...result, aborted: true }
      const timeout = message.timeoutSec ?? 120
      if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_SEC)
        throw new Error(`Command timeout must be between 0 and ${MAX_TIMEOUT_SEC} seconds.`)
      const logPath = `.pi/logs/bash-${message.executionId}.log`
      const log = await this.files.createWriter(logPath)
      try {
        const windows = process.platform === 'win32'
        let args = windows ? ['/d', '/s', '/c', message.command] : ['-c', message.command]
        let executable = this.environment.shell
        let env = commandEnv(message.env)
        if (this.srtPath) {
          if (!this.initialized) throw new Error('SRT has not been initialized.')
          const skillEnv = commandEnv(message.env, false)
          const command = windows
            ? message.command
            : [
                ...Object.entries(skillEnv).map(
                  ([key, value]) => `export ${key}='${value!.replaceAll("'", "'\\''")}'`,
                ),
                message.command,
              ].join('\n')
          const wrapped = await SandboxManager.wrapWithSandboxArgv(
            command,
            executable,
            undefined,
            signal,
            this.files.cwd,
            { commandId: message.executionId, commandText: message.command },
          )
          ;[executable, ...args] = wrapped.argv
          if (windows) {
            // SRT's broker starts a fresh sandbox-user environment. Explicit skill
            // values belong in its child overlay, never in the broker's startup env.
            const separator = args.indexOf('--')
            if (separator < 0) throw new Error('SRT returned an invalid Windows launch command.')
            args.splice(
              separator,
              0,
              ...Object.entries(skillEnv).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
            )
            env = wrapped.env
          } else env = commandEnv()
        }
        if (signal.aborted) return { ...result, aborted: true }
        const nativeWindows = windows && !this.srtPath
        const child = spawn(
          nativeWindows ? message.command : executable,
          nativeWindows ? [] : args,
          {
            cwd: this.files.cwd,
            env,
            detached: !windows,
            windowsHide: true,
            shell: nativeWindows ? executable : false,
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        )
        // Bun can change child.pid after exit; retain the actual process group ID.
        const processGroupId = child.pid
        let termination: Promise<void> | undefined
        const kill = () => {
          if (!processGroupId || processGroupId <= 0) return
          if (windows) {
            if (child.exitCode !== null || child.signalCode !== null) return
            termination ??= new Promise<void>((resolve) => {
              const taskkill = spawn(
                path.win32.join(
                  process.env.SystemRoot ?? 'C:\\Windows',
                  'System32',
                  'taskkill.exe',
                ),
                ['/pid', String(processGroupId), '/t', '/f'],
                { windowsHide: true, stdio: 'ignore', env: commandEnv(), timeout: 5000 },
              )
              taskkill.once('error', () => {
                child.kill('SIGKILL')
                resolve()
              })
              taskkill.once('close', (code) => {
                if (code !== 0) child.kill('SIGKILL')
                resolve()
              })
            })
            return
          }
          try {
            process.kill(-processGroupId, 'SIGKILL')
          } catch (error) {
            if (!(
              error instanceof Error &&
              'code' in error &&
              (error.code === 'ESRCH' ||
                (error.code === 'EPERM' && (child.exitCode !== null || child.signalCode !== null)))
            ))
              throw error
          }
        }
        const onAbort = () => {
          result.aborted = true
          kill()
        }
        signal.addEventListener('abort', onAbort, { once: true })
        const timer = setTimeout(() => {
          result.timedOut = true
          kill()
        }, timeout * 1000)
        let bytes = 0
        let writes = Promise.resolve()
        let drainTimer: ReturnType<typeof setTimeout> | undefined
        try {
          await new Promise<void>((resolve, reject) => {
            child.once('error', reject)
            child.once('exit', (code, exitSignal) => {
              clearTimeout(timer)
              result.exitCode = code
              result.signal = exitSignal
              if (nativeWindows) {
                // A background process can inherit pipes after cmd.exe exits.
                // Plain Windows execution has no job object; bound output draining.
                drainTimer = setTimeout(() => {
                  child.stdout.destroy()
                  child.stderr.destroy()
                }, 1000)
              } else kill()
            })
            child.once('close', () => resolve())
            for (const stream of ['stdout', 'stderr'] as const) {
              child[stream].setEncoding('utf8')
              child[stream].on('error', reject)
              child[stream].on('data', (data: string) => {
                bytes += Buffer.byteLength(data)
                if (bytes > MAX_OUTPUT_BYTES) {
                  if (!result.error) {
                    result.error = 'Command exceeded the 64 MiB output limit.'
                    kill()
                  }
                  return
                }
                child[stream].pause()
                writes = writes
                  .then(async () => {
                    await log.write(data)
                    output(stream, data)
                    child[stream].resume()
                  })
                  .catch(reject)
              })
            }
            if (signal.aborted) onAbort()
          })
          await writes
          result.fullOutputPath = logPath
        } finally {
          clearTimeout(timer)
          clearTimeout(drainTimer)
          signal.removeEventListener('abort', onAbort)
          kill()
          await termination
        }
      } finally {
        await log.close()
      }
    } catch (error) {
      result.aborted = signal.aborted
      result.error = error instanceof Error ? error.message : 'Command execution failed.'
    } finally {
      // SRT's temporary mount resources are shared: clean up only after every
      // concurrent command has finished, and keep the proxies until shutdown.
      if (this.srtPath && --this.active === 0 && this.initialized)
        SandboxManager.cleanupAfterCommand()
    }
    return result
  }
}
