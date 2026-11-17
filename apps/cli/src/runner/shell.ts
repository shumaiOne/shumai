import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { RunnerExecResultMessage, RunnerExecStartMessage } from '@shumai/dtos'
import { commandEnv } from './config'
import { RunnerFiles } from './files'
import { findExecutable } from './executable'

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024
const MAX_TIMEOUT_SEC = 3600

export class RunnerShell {
  private settings?: string
  private srtExecutable?: string

  constructor(
    private readonly files: RunnerFiles,
    private readonly srtPath?: string,
  ) {}

  async initialize() {
    if (!this.srtPath) return
    // Snapshot once: a command editing the source config cannot weaken later commands.
    this.settings = await readFile(this.srtPath, 'utf8')
    const parsed: unknown = JSON.parse(this.settings)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('SRT settings must be a JSON object.')
    this.srtExecutable = await findExecutable('srt')
    let diagnostic = ''
    const probe = await this.run(
      { type: 'exec.start', executionId: randomUUID(), command: 'true', timeoutSec: 15 },
      new AbortController().signal,
      (_stream, data) => {
        diagnostic = (diagnostic + data).slice(-4096)
      },
    )
    if (probe.exitCode !== 0 || probe.error || probe.timedOut)
      throw new Error(
        `SRT preflight failed: ${probe.error || diagnostic.trim() || 'Check settings and local SRT prerequisites.'}`,
      )
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
    let settingsDir: string | undefined
    try {
      if (signal.aborted) return { ...result, aborted: true }
      const timeout = message.timeoutSec ?? 120
      if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_SEC)
        throw new Error(`Command timeout must be between 0 and ${MAX_TIMEOUT_SEC} seconds.`)
      const logPath = `.pi/logs/bash-${message.executionId}.log`
      const log = await this.files.createWriter(logPath)
      try {
        const args = ['--noprofile', '--norc', '-c', message.command]
        let executable = '/bin/bash'
        let env = commandEnv(message.env)
        if (this.srtPath && !this.srtExecutable) throw new Error('SRT has not been initialized.')
        if (this.settings !== undefined) {
          settingsDir = await mkdtemp(path.join(tmpdir(), 'shumai-srt-'))
          const settingsFile = path.join(settingsDir, 'settings.json')
          await writeFile(settingsFile, this.settings, { mode: 0o600 })
          executable = this.srtExecutable!
          const variables = Object.entries(env)
            .filter((entry): entry is [string, string] => entry[1] !== undefined)
            .map(([key, value]) => `${key}=${value}`)
          args.unshift('--settings', settingsFile, '--', '/usr/bin/env', ...variables, '/bin/bash')
          env = commandEnv()
        }
        const child = spawn(executable, args, {
          cwd: this.files.cwd,
          env,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        // Bun can change child.pid after exit; retain the actual process group ID.
        const processGroupId = child.pid
        const kill = () => {
          if (!processGroupId || processGroupId <= 0) return
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
        try {
          await new Promise<void>((resolve, reject) => {
            child.once('error', reject)
            child.once('exit', (code, exitSignal) => {
              result.exitCode = code
              result.signal = exitSignal
              kill()
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
          signal.removeEventListener('abort', onAbort)
          kill()
        }
      } finally {
        await log.close()
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Command execution failed.'
    } finally {
      if (settingsDir) await rm(settingsDir, { recursive: true, force: true })
    }
    return result
  }
}
