import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runnerToServerMessageSchema, type RunnerToServerMessage } from '@shumai/dtos'
import { RunnerClient } from './client'
import { RunnerFiles } from './files'
import { RunnerShell } from './shell'

describe('runner WebSocket client', () => {
  let cwd: string
  let server: WebSocketServer
  let runner: RunnerClient
  let running: Promise<void>
  let socket: WebSocket
  let messages: RunnerToServerMessage[]
  let welcomeInFlight: string[]
  let connections: number
  let replacePrevious: boolean
  let connectRunner: () => RunnerClient
  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'shumai-client-test-'))
    messages = []
    welcomeInFlight = []
    connections = 0
    replacePrevious = false
    server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No WebSocket address')
    server.on('connection', (connection, request) => {
      expect(request.headers.authorization).toBe('Bearer runner-key')
      if (replacePrevious) socket.close(4000, 'Replaced by a newer connection')
      socket = connection
      connections++
      connection.on('message', (raw) =>
        messages.push(runnerToServerMessageSchema.parse(JSON.parse(raw.toString()))),
      )
      connection.send(
        JSON.stringify({
          type: 'welcome',
          runnerId: 'runner',
          runnerName: 'Test',
          serverTime: Date.now(),
          inFlightExecutionIds: welcomeInFlight,
        }),
      )
    })
    connectRunner = () => {
      const files = new RunnerFiles(cwd)
      return new RunnerClient(
        {
          url: new URL(`ws://127.0.0.1:${address.port}/api/runners/ws`),
          key: 'runner-key',
          cwd,
          srt: undefined,
        },
        files,
        new RunnerShell(files),
        () => {},
      )
    }
    runner = connectRunner()
    running = runner.run()
    // Attach an error handler immediately, including for tests exercising terminal errors.
    void running.catch(() => {})
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'reconcile')).toBe(true),
    )
  })
  afterEach(async () => {
    runner.stop()
    await running.catch(() => {})
    for (const connection of server.clients) connection.terminate()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(cwd, { recursive: true, force: true })
  })
  const send = (message: unknown) => socket.send(JSON.stringify(message))

  it('responds to heartbeat, executes a command once and streams byte offsets', async () => {
    expect(messages).toContainEqual(
      expect.objectContaining({
        type: 'reconcile',
        environment: { platform: process.platform, shell: '/bin/sh' },
      }),
    )
    send({ type: 'ping', ts: 123 })
    const command = {
      type: 'exec.start',
      executionId: 'one',
      command: 'printf "世界"; printf "error" >&2',
    }
    send(command)
    send(command)
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'exec.result')).toBe(true),
    )
    expect(messages).toContainEqual({ type: 'pong', ts: 123 })
    expect(messages.filter((message) => message.type === 'exec.result')).toHaveLength(1)
    const chunks = messages.filter((message) => message.type === 'exec.output')
    expect(chunks.map((chunk) => chunk.data).join('')).toContain('世界')
    let offset = 0
    for (const chunk of chunks) {
      expect(chunk.offset).toBe(offset)
      offset += Buffer.byteLength(chunk.data)
    }
  })

  it('cancels an active command through the protocol', async () => {
    send({ type: 'exec.start', executionId: 'cancel', command: 'echo ready; sleep 30' })
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'exec.output')).toBe(true),
    )
    send({ type: 'exec.cancel', executionId: 'cancel' })
    await vi.waitFor(() =>
      expect(messages).toContainEqual(
        expect.objectContaining({ type: 'exec.result', executionId: 'cancel', aborted: true }),
      ),
    )
  })

  it('reconnects and replays output before completing an in-flight command', async () => {
    send({
      type: 'exec.start',
      executionId: 'reconnect',
      command: 'echo before; sleep 0.2; echo after',
    })
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'exec.output')).toBe(true),
    )
    welcomeInFlight = ['reconnect']
    socket.terminate()
    messages = []
    await vi.waitFor(() => expect(connections).toBe(2), { timeout: 5000 })
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'reconcile')).toBe(true),
    )
    const reconciliation = messages.findIndex((message) => message.type === 'reconcile')
    expect(
      messages
        .slice(0, reconciliation)
        .filter((message) => message.type === 'exec.output')
        .map((message) => message.data)
        .join(''),
    ).toContain('after')
    expect(messages[reconciliation]).toMatchObject({
      completedExecutions: [expect.objectContaining({ executionId: 'reconnect', exitCode: 0 })],
    })
  })

  it('handles file requests and returns a cached result for a duplicate request', async () => {
    const request = { type: 'file.stat', executionId: 'stat', srcPath: '.pi/missing' }
    send(request)
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'file.stat.result')).toBe(true),
    )
    send(request)
    await vi.waitFor(() =>
      expect(messages.filter((message) => message.type === 'file.stat.result')).toHaveLength(2),
    )
    expect(messages.at(-1)).toMatchObject({ ok: true, exists: false })
  })

  it('stops instead of reconnecting when the runner key is revoked', async () => {
    socket.close(1008, 'revoked')
    await expect(running).rejects.toThrow('revoked')
    expect(connections).toBe(1)
  })

  it('stops the superseded client when a second runner connects with the same key', async () => {
    replacePrevious = true
    let replaced: unknown
    void running.catch((error: unknown) => {
      replaced = error
    })
    const replacement = connectRunner()
    const replacementRun = replacement.run()
    void replacementRun.catch(() => {})
    try {
      await vi.waitFor(() => expect(replaced).toBeInstanceOf(Error))
      await expect(running).rejects.toThrow('replaced')
      expect(connections).toBe(2)
    } finally {
      replacement.stop()
      await replacementRun.catch(() => {})
    }
  })

  it('rejects invalid messages and path-like execution IDs', async () => {
    send({ type: 'exec.start', executionId: '../escape', command: 'echo unsafe' })
    await expect(running).rejects.toThrow('invalid runner protocol')
    expect(messages.some((message) => message.type === 'exec.output')).toBe(false)
  })
})
