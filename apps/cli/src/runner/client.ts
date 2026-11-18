import WebSocket from 'ws'
import { setTimeout as delay } from 'node:timers/promises'
import {
  RUNNER_REPLACED_CLOSE_CODE,
  serverToRunnerMessageSchema,
  type RunnerExecOutputMessage,
  type RunnerExecResultMessage,
  type RunnerToServerMessage,
  type ServerToRunnerMessage,
} from '@shumai/dtos'
import { CliError } from '../operations/errors'
import { resolveRunnerConfig, type RunnerOptions } from './config'
import { RunnerFiles, type FileMessage } from './files'
import { RunnerShell } from './shell'

const MAX_REPLAY_BYTES = 1024 * 1024
const MAX_COMPLETED = 16
const MAX_ACTIVE = 8

interface Execution {
  controller: AbortController
  chunks: RunnerExecOutputMessage[]
  bytes: number
  offset: number
  result?: RunnerExecResultMessage
}

export class RunnerClient {
  private socket?: WebSocket
  private ready = false
  private stopped = new AbortController()
  private executions = new Map<string, Execution>()
  private transfers = new Map<string, AbortController>()
  private completedFiles = new Map<string, RunnerToServerMessage>()
  private pending = new Set<Promise<void>>()

  constructor(
    private readonly config: Awaited<ReturnType<typeof resolveRunnerConfig>>,
    private readonly files: RunnerFiles,
    private readonly shell: RunnerShell,
    private readonly log: (message: string) => void = console.error,
  ) {}

  async run(signal?: AbortSignal): Promise<void> {
    const stop = () => this.stop()
    signal?.addEventListener('abort', stop, { once: true })
    if (signal?.aborted) this.stop()
    let attempt = 0
    try {
      while (!this.stopped.signal.aborted) {
        const wasReady = await this.connect()
        if (this.stopped.signal.aborted) break
        attempt = wasReady ? 0 : Math.min(attempt + 1, 5)
        this.log('Runner disconnected; reconnecting…')
        await delay(Math.min(1000 * 2 ** attempt, 30_000), undefined, {
          signal: this.stopped.signal,
        }).catch(() => {})
      }
    } finally {
      signal?.removeEventListener('abort', stop)
      this.stop()
      await Promise.allSettled(this.pending)
    }
  }

  stop() {
    this.stopped.abort()
    this.ready = false
    this.socket?.terminate()
    for (const execution of this.executions.values()) execution.controller.abort()
    for (const transfer of this.transfers.values()) transfer.abort()
  }

  private connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.config.url, {
        headers: { authorization: `Bearer ${this.config.key}` },
        handshakeTimeout: 10_000,
        maxPayload: 1024 * 1024,
        perMessageDeflate: false,
        followRedirects: false,
      })
      this.socket = socket
      let welcomed = false
      let lastMessage = Date.now()
      const heartbeat = setInterval(() => {
        if (Date.now() - lastMessage > (welcomed ? 75_000 : 10_000)) socket.terminate()
      }, 5_000)
      socket.on('error', () => {
        /* Close drives reconnect; never print credential-bearing request errors. */
      })
      socket.on('unexpected-response', (_request, response) => {
        response.destroy()
        socket.terminate()
        if ([401, 403, 404, 426].includes(response.statusCode ?? 0))
          reject(
            new CliError(
              `Runner connection rejected (HTTP ${response.statusCode}). Check the server URL and runner key.`,
            ),
          )
      })
      socket.on('close', (code) => {
        clearInterval(heartbeat)
        this.ready = false
        if ((code === 1008 || code === RUNNER_REPLACED_CLOSE_CODE) && !this.stopped.signal.aborted)
          reject(
            new CliError('Runner access was revoked or another connection replaced this runner.'),
          )
        else resolve(welcomed)
      })
      socket.on('message', (raw) => {
        try {
          const parsed = serverToRunnerMessageSchema.parse(JSON.parse(raw.toString()))
          if ('executionId' in parsed && !/^[A-Za-z0-9_-]{1,128}$/.test(parsed.executionId))
            throw new Error('Invalid execution ID.')
          lastMessage = Date.now()
          if (parsed.type === 'welcome') {
            if (welcomed) throw new Error('Duplicate welcome.')
            welcomed = true
            this.ready = true
            this.reconcile(parsed.inFlightExecutionIds)
            this.log(`Runner connected: ${parsed.runnerName} (${parsed.runnerId})`)
          } else {
            if (!welcomed) throw new Error('Expected welcome before runner requests.')
            this.handle(parsed)
          }
        } catch {
          reject(new CliError('Server sent an invalid runner protocol message.'))
          socket.terminate()
        }
      })
      if (this.stopped.signal.aborted) socket.terminate()
    })
  }

  private send(message: RunnerToServerMessage) {
    if (this.ready && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message))
  }

  private reconcile(inFlight: string[]) {
    const expected = new Set(inFlight)
    for (const [id, execution] of this.executions) {
      if (!expected.has(id)) {
        execution.controller.abort()
        if (execution.result) this.executions.delete(id)
        continue
      }
      // Replay before results: the server deduplicates chunks by UTF-8 byte offset.
      for (const chunk of execution.chunks) this.send(chunk)
    }
    this.send({
      type: 'reconcile',
      environment: this.shell.environment,
      activeExecutions: [...this.executions]
        .filter(([id, execution]) => expected.has(id) && !execution.result)
        .map(([executionId, execution]) => ({ executionId, nextOffset: execution.offset })),
      completedExecutions: [...this.executions]
        .filter(([id, execution]) => expected.has(id) && execution.result)
        .map(([, execution]) => execution.result!),
    })
  }

  private handle(message: Exclude<ServerToRunnerMessage, { type: 'welcome' }>) {
    if (message.type === 'ping') {
      this.send({ type: 'pong', ts: message.ts })
      return
    }
    if (message.type === 'exec.cancel') {
      this.executions.get(message.executionId)?.controller.abort()
      return
    }
    if (message.type === 'exec.start') {
      const previous = this.executions.get(message.executionId)
      if (previous) {
        if (previous.result) this.send(previous.result)
        return
      }
      const execution: Execution = {
        controller: new AbortController(),
        chunks: [],
        bytes: 0,
        offset: 0,
      }
      this.executions.set(message.executionId, execution)
      this.track(
        (async () => {
          const busy = this.activeCount() > MAX_ACTIVE
          const result = busy
            ? {
                type: 'exec.result' as const,
                executionId: message.executionId,
                exitCode: null,
                signal: null,
                timedOut: false,
                error: 'Runner is busy. Try again later.',
              }
            : await this.shell.run(message, execution.controller.signal, (stream, data) => {
                // Small frames keep reconnect replay and WebSocket buffering bounded.
                for (const part of data.match(/[\s\S]{1,8192}/gu) ?? []) {
                  const chunk: RunnerExecOutputMessage = {
                    type: 'exec.output',
                    executionId: message.executionId,
                    stream,
                    data: part,
                    offset: execution.offset,
                  }
                  const bytes = Buffer.byteLength(part)
                  execution.offset += bytes
                  execution.bytes += bytes
                  execution.chunks.push(chunk)
                  while (execution.bytes > MAX_REPLAY_BYTES) {
                    const removed = execution.chunks.shift()!
                    execution.bytes -= Buffer.byteLength(removed.data)
                    if (!this.ready) execution.controller.abort()
                  }
                  if ((this.socket?.bufferedAmount ?? 0) > MAX_REPLAY_BYTES) {
                    this.ready = false
                    this.socket?.terminate()
                  }
                  this.send(chunk)
                }
              })
          execution.result = result
          this.send(result)
          const completed = [...this.executions].filter(([, value]) => value.result)
          for (const [id] of completed.slice(0, -MAX_COMPLETED)) this.executions.delete(id)
        })(),
      )
      return
    }
    this.handleFile(message)
  }

  private activeCount() {
    return (
      [...this.executions.values()].filter((execution) => !execution.result).length +
      this.transfers.size
    )
  }

  private handleFile(message: FileMessage) {
    const previous = this.completedFiles.get(message.executionId)
    if (previous) {
      this.send(previous)
      return
    }
    if (this.transfers.has(message.executionId)) return
    const controller = new AbortController()
    this.transfers.set(message.executionId, controller)
    const timer = setTimeout(() => controller.abort(), 120_000)
    this.track(
      (async () => {
        try {
          const result =
            this.activeCount() > MAX_ACTIVE
              ? this.fileBusy(message)
              : await this.files.handle(message, controller.signal)
          this.completedFiles.set(message.executionId, result)
          if (this.completedFiles.size > MAX_COMPLETED)
            this.completedFiles.delete(this.completedFiles.keys().next().value!)
          this.send(result)
        } finally {
          clearTimeout(timer)
          this.transfers.delete(message.executionId)
        }
      })(),
    )
  }

  private fileBusy(message: FileMessage): RunnerToServerMessage {
    const result = {
      executionId: message.executionId,
      ok: false,
      error: 'Runner is busy. Try again later.',
    }
    switch (message.type) {
      case 'file.download':
        return { ...result, type: 'file.download.result' }
      case 'file.upload':
        return { ...result, type: 'file.upload.result' }
      case 'file.stat':
        return { ...result, type: 'file.stat.result', exists: false }
    }
  }

  private track(task: Promise<void>) {
    this.pending.add(task)
    void task.finally(() => this.pending.delete(task)).catch(() => this.stop())
  }
}

export async function startRunner(options: RunnerOptions) {
  const config = await resolveRunnerConfig(options)
  const files = new RunnerFiles(config.cwd)
  const shell = new RunnerShell(files, config.srt)
  // SRT resolves relative policy paths against the runner workspace.
  process.chdir(config.cwd)
  await shell.initialize()
  console.error(`Runner shell: ${shell.environment.shell}`)
  const runner = new RunnerClient(config, files, shell)
  const controller = new AbortController()
  const shutdown = () => controller.abort()
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  try {
    await runner.run(controller.signal)
  } finally {
    process.removeListener('SIGINT', shutdown)
    process.removeListener('SIGTERM', shutdown)
    await shell.close()
  }
}
