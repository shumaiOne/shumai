import { randomUUID } from 'node:crypto'
import { execa } from 'execa'
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
        let args: string[] = []
        let executable = message.command
        let shell: string | false = this.environment.shell
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
            this.environment.shell,
            undefined,
            signal,
            this.files.cwd,
            { commandId: message.executionId, commandText: message.command },
          )
          ;[executable, ...args] = wrapped.argv
          shell = false
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
        const deadline = Date.now() + Math.ceil(timeout * 1000)
        const child = execa(executable, args, {
          cwd: this.files.cwd,
          env,
          extendEnv: false,
          shell,
          stdin: 'ignore',
          buffer: false,
          reject: false,
          stripFinalNewline: false,
          verbose: 'none',
          windowsHide: true,
          killDescendants: true,
          killSignal: 'SIGKILL',
          cancelSignal: signal,
          timeout: Math.ceil(timeout * 1000),
        })
        let bytes = 0
        let writes = Promise.resolve()
        let drainTimer: ReturnType<typeof setTimeout> | undefined
        let drainExpired = false
        let exitedWithinDeadline = false
        child.nodeChildProcess.once('exit', (exitCode) => {
          exitedWithinDeadline = exitCode !== null && Date.now() < deadline
          // Execa cleans up descendants where the OS still permits it. Bound
          // draining if a background child keeps inherited output pipes open.
          child.kill('SIGKILL')
          drainTimer = setTimeout(() => {
            drainExpired = true
            child.stdout.destroy()
            child.stderr.destroy()
          }, 1000)
        })
        try {
          const readers = (['stdout', 'stderr'] as const).map(async (stream) => {
            child[stream].setEncoding('utf8')
            try {
              for await (const data of child[stream]) {
                bytes += Buffer.byteLength(data)
                if (bytes > MAX_OUTPUT_BYTES)
                  throw new Error('Command exceeded the 64 MiB output limit.')
                await (writes = writes.then(async () => {
                  await log.write(data)
                  output(stream, data)
                }))
              }
            } catch (error) {
              if (
                drainExpired &&
                error instanceof Error &&
                'code' in error &&
                error.code === 'ERR_STREAM_PREMATURE_CLOSE'
              )
                return
              result.error ??= error instanceof Error ? error.message : 'Output streaming failed.'
              child.kill('SIGKILL')
            }
          })
          const [completed] = await Promise.all([child, Promise.all(readers)])
          await writes
          result.exitCode = completed.exitCode ?? null
          result.signal = completed.signal ?? null
          // Execa's timeout includes stream draining. Report the command's
          // runtime, so a timely exit does not become a timeout while draining.
          result.timedOut = completed.timedOut && !exitedWithinDeadline
          result.aborted = completed.isCanceled
          if (
            completed.failed &&
            completed.exitCode === undefined &&
            !result.timedOut &&
            !result.aborted &&
            !completed.signal
          )
            result.error = `Command execution failed (${completed.code ?? 'unknown error'}).`
          result.fullOutputPath = logPath
        } finally {
          clearTimeout(drainTimer)
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
