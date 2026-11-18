import { createServer } from 'node:http'
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
  let connectRunner: (options?: { verbose?: boolean; log?: (line: string) => void }) => RunnerClient
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
    connectRunner = (options) => {
      const files = new RunnerFiles(cwd)
      return new RunnerClient(
        {
          url: new URL(`ws://127.0.0.1:${address.port}/api/runners/ws`),
          key: 'runner-key',
          cwd,
          srt: undefined,
          verbose: options?.verbose ?? false,
        },
        files,
        new RunnerShell(files),
        options?.log ?? (() => {}),
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

  it('logs compact lifecycle, bash, and transfer summaries in default mode', async () => {
    runner.stop()
    await running.catch(() => {})
    const logs: string[] = []
    messages = []
    runner = connectRunner({ verbose: false, log: (line) => logs.push(line) })
    running = runner.run()
    void running.catch(() => {})
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'reconcile')).toBe(true),
    )

    send({ type: 'exec.start', executionId: '01JTEST0000A8F2', command: 'printf "hello"' })
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'exec.result')).toBe(true),
    )

    send({
      type: 'exec.start',
      executionId: '01JTEST0000TOUT',
      command: 'sleep 5',
      timeoutSec: 0.1,
    })
    await vi.waitFor(() =>
      expect(
        messages.some(
          (message) => message.type === 'exec.result' && message.executionId === '01JTEST0000TOUT',
        ),
      ).toBe(true),
    )

    send({ type: 'file.stat', executionId: '01JTEST0000STAT', srcPath: '.pi/missing' })
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'file.stat.result')).toBe(true),
    )

    const httpServer = createServer((_request, response) => {
      response.end('payload')
    })
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    try {
      const httpAddress = httpServer.address()
      if (!httpAddress || typeof httpAddress === 'string') throw new Error('No HTTP address')
      send({
        type: 'file.download',
        executionId: '01JTEST0000C3D9',
        url: `http://127.0.0.1:${httpAddress.port}/file`,
        destPath: '.pi/assets/file.txt',
      })
      await vi.waitFor(() =>
        expect(messages.some((message) => message.type === 'file.download.result')).toBe(true),
      )
    } finally {
      httpServer.closeAllConnections()
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    }

    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} INFO {2}Runner connected: Test \(runner\)$/.test(line),
      ),
    ).toBe(true)
    expect(
      logs.some((line) => /^\d{2}:\d{2}:\d{2} INFO {2}Bash started \[a8f2\]$/.test(line)),
    ).toBe(true)
    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} INFO {2}Bash completed \[a8f2\] exit=0 duration=\d+\.\ds$/.test(line),
      ),
    ).toBe(true)
    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} WARN {2}Bash timed out \[tout\] duration=\d+\.\ds$/.test(line),
      ),
    ).toBe(true)
    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} INFO {2}File download completed \[c3d9\] size=7B duration=\d+\.\ds$/.test(
          line,
        ),
      ),
    ).toBe(true)
    expect(logs.join('\n')).not.toContain('command=')
    expect(logs.join('\n')).not.toContain('File stat')
    expect(logs.join('\n')).not.toContain('.pi/assets/file.txt')
  })

  it('logs commands, stream sizes, and file paths in verbose mode', async () => {
    runner.stop()
    await running.catch(() => {})
    const logs: string[] = []
    messages = []
    runner = connectRunner({ verbose: true, log: (line) => logs.push(line) })
    running = runner.run()
    void running.catch(() => {})
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'reconcile')).toBe(true),
    )

    send({
      type: 'exec.start',
      executionId: '01JTEST0000B9E1',
      command: 'printf "hi"; printf "err" >&2',
    })
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'exec.result')).toBe(true),
    )

    send({ type: 'file.stat', executionId: '01JTEST0000B1A4', srcPath: '.pi/missing' })
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'file.stat.result')).toBe(true),
    )

    const httpServer = createServer((_request, response) => {
      response.writeHead(500)
      response.end()
    })
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    try {
      const httpAddress = httpServer.address()
      if (!httpAddress || typeof httpAddress === 'string') throw new Error('No HTTP address')
      send({
        type: 'file.download',
        executionId: '01JTEST0000E5F1',
        url: `http://127.0.0.1:${httpAddress.port}/fail`,
        destPath: '.pi/assets/fail.txt',
      })
      await vi.waitFor(() =>
        expect(messages.some((message) => message.type === 'file.download.result')).toBe(true),
      )
    } finally {
      httpServer.closeAllConnections()
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    }

    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} INFO {2}Bash started \[b9e1\] command="printf \\"hi\\"; printf \\"err\\" >&2"$/.test(
          line,
        ),
      ),
    ).toBe(true)
    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} INFO {2}Bash completed \[b9e1\] exit=0 duration=\d+\.\ds stdout=2B stderr=3B$/.test(
          line,
        ),
      ),
    ).toBe(true)
    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} INFO {2}File stat \[b1a4\] path="\.pi\/missing" exists=false$/.test(
          line,
        ),
      ),
    ).toBe(true)
    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} INFO {2}File download started \[e5f1\] path="\.pi\/assets\/fail\.txt"$/.test(
          line,
        ),
      ),
    ).toBe(true)
    expect(
      logs.some((line) =>
        /^\d{2}:\d{2}:\d{2} WARN {2}File download failed \[e5f1\] path="\.pi\/assets\/fail\.txt" duration=\d+\.\ds error="Download failed \(HTTP 500\)\."$/.test(
          line,
        ),
      ),
    ).toBe(true)
  })
})
