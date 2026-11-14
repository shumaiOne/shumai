import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { s3Service } from '../s3/s3'
import {
  RunnerService,
  generateRunnerKey,
  hashRunnerKey,
  validateRunnerWorkspacePath,
} from './runner-service'
import type { RunnerSocket } from './types'

function createMockWs() {
  const sent: string[] = []
  let closed: { code?: number; reason?: string } | null = null
  const ws: RunnerSocket = {
    send: vi.fn((data: string) => {
      sent.push(data)
    }),
    close: vi.fn((code?: number, reason?: string) => {
      closed = { code, reason }
    }),
  }
  return {
    ws,
    sent,
    getClosed: () => closed,
    lastSentJson: () => {
      const last = sent[sent.length - 1]
      return last ? JSON.parse(last) : null
    },
  }
}

describe('RunnerService', () => {
  setupTestDbHooks()

  let service: RunnerService
  let teamId: string

  beforeEach(async () => {
    service = new RunnerService()
    const user = await prisma.user.create({
      data: { name: 'Runner Owner', email: `runner-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await prisma.team.create({
      data: { name: 'Runner Test Team', members: { create: { userId: user.id, role: 'owner' } } },
    })
    teamId = team.id
  })

  afterEach(() => {
    service.stopHeartbeatMonitor()
    vi.restoreAllMocks()
  })

  describe('Key & workspace path helpers', () => {
    it('generates and hashes runner keys', () => {
      const { key, keyPrefix, keyHash } = generateRunnerKey()
      expect(key).toMatch(/^shm_rn_[0-9a-f]{48}$/)
      expect(keyPrefix).toBe(key.slice(0, 14))
      expect(keyHash).toBe(hashRunnerKey(key))
    })

    it('validates runner workspace paths strictly under .pi/', () => {
      expect(validateRunnerWorkspacePath('.pi/file.txt')).toBe('.pi/file.txt')
      expect(validateRunnerWorkspacePath('.pi/skills/s1')).toBe('.pi/skills/s1')
      expect(() => validateRunnerWorkspacePath('/etc/passwd')).toThrow(/must be relative/)
      expect(() => validateRunnerWorkspacePath('.pi/../../etc/passwd')).toThrow(
        /must stay within \.pi\//,
      )
      expect(() => validateRunnerWorkspacePath('outside.txt')).toThrow(/must stay within \.pi\//)
    })
  })

  describe('CRUD & Default Runner Invariant', () => {
    it('auto-promotes first runner to default and preserves invariant across CRUD', async () => {
      const resolvedEmpty = await service.resolveRunnerForAgent(teamId)
      expect(resolvedEmpty.hasConfiguredRunner).toBe(false)

      const r1 = await service.createRunner(teamId, { name: 'Mac Mini 1' })
      expect(r1.runner.isDefault).toBe(true)
      expect(r1.runner.status).toBe('disconnected')
      expect(r1.key).toMatch(/^shm_rn_[0-9a-f]{48}$/)

      // Creating second runner without isDefault keeps first as default
      const r2 = await service.createRunner(teamId, { name: 'Mac Mini 2' })
      expect(r2.runner.isDefault).toBe(false)

      let list = await service.listRunners(teamId)
      expect(list).toHaveLength(2)
      expect(list.find((r) => r.id === r1.runner.id)?.isDefault).toBe(true)
      expect(list.find((r) => r.id === r2.runner.id)?.isDefault).toBe(false)

      // Promoting r2 demotes r1
      const updatedR2 = await service.updateRunner(teamId, r2.runner.id, {
        name: 'Mac Mini 2 Pro',
        isDefault: true,
      })
      expect(updatedR2.name).toBe('Mac Mini 2 Pro')
      expect(updatedR2.isDefault).toBe(true)

      list = await service.listRunners(teamId)
      expect(list.find((r) => r.id === r1.runner.id)?.isDefault).toBe(false)
      expect(list.find((r) => r.id === r2.runner.id)?.isDefault).toBe(true)

      // Deleting the default runner (r2) promotes the remaining runner (r1)
      await service.deleteRunner(teamId, r2.runner.id)
      list = await service.listRunners(teamId)
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe(r1.runner.id)
      expect(list[0].isDefault).toBe(true)
    })

    it('preserves a concurrent default promotion during name-only updates and enforces single default in DB', async () => {
      const older = await service.createRunner(teamId, { name: 'Older Runner' })
      const newer = await service.createRunner(teamId, { name: 'Newer Default', isDefault: true })

      // Simulate rename-only update alongside promoting older runner
      await service.updateRunner(teamId, older.runner.id, { isDefault: true })
      const renamedNewer = await service.updateRunner(teamId, newer.runner.id, {
        name: 'Newer Default Renamed',
      })
      expect(renamedNewer.isDefault).toBe(false)

      // Concurrent rename + promote should serialize cleanly and never produce two defaults
      await Promise.all([
        service.updateRunner(teamId, older.runner.id, { name: 'Older Renamed' }),
        service.updateRunner(teamId, newer.runner.id, { isDefault: true }),
      ])

      const list = await service.listRunners(teamId)
      expect(list.filter((r) => r.isDefault)).toHaveLength(1)
      expect(list.find((r) => r.id === newer.runner.id)?.isDefault).toBe(true)
      expect(list.find((r) => r.id === older.runner.id)?.name).toBe('Older Renamed')

      // Partial unique index enforces single default even on direct DB writes
      await expect(
        prisma.runner.update({
          where: { id: older.runner.id },
          data: { isDefault: true },
        }),
      ).rejects.toThrow()
    })

    it('authenticates runner keys and invalidates old key on rotation', async () => {
      const created = await service.createRunner(teamId, { name: 'Runner A' })
      const verified = await service.authenticateRunnerKey(created.key)
      expect(verified).toEqual({
        id: created.runner.id,
        teamId,
        name: 'Runner A',
        keyHash: hashRunnerKey(created.key),
      })

      const rotated = await service.rotateRunnerKey(teamId, created.runner.id)
      expect(rotated.key).not.toBe(created.key)
      expect(await service.authenticateRunnerKey(created.key)).toBeNull()
      expect(await service.authenticateRunnerKey(rotated.key)).toEqual({
        id: created.runner.id,
        teamId,
        name: 'Runner A',
        keyHash: hashRunnerKey(rotated.key),
      })
    })
  })

  describe('WebSocket connection lifecycle & eviction', () => {
    it('evicts existing connection with 4000 when a new connection arrives', async () => {
      const { runner, key } = await service.createRunner(teamId, { name: 'Runner WS' })
      const keyHash = hashRunnerKey(key)
      const conn1 = createMockWs()
      const conn2 = createMockWs()

      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash },
        conn1.ws,
      )
      expect(service.isRunnerConnected(runner.id)).toBe(true)

      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash },
        conn2.ws,
      )
      expect(conn1.getClosed()).toEqual({
        code: 4000,
        reason: 'Replaced by a newer connection',
      })
      expect(service.isRunnerConnected(runner.id)).toBe(true)
    })

    it('closes active connection with 1008 when key is rotated or runner is deleted', async () => {
      const { runner, key } = await service.createRunner(teamId, { name: 'Runner Rotate' })
      const conn1 = createMockWs()
      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash: hashRunnerKey(key) },
        conn1.ws,
      )

      const rotated = await service.rotateRunnerKey(teamId, runner.id)
      expect(conn1.getClosed()?.code).toBe(1008)
      expect(service.isRunnerConnected(runner.id)).toBe(false)

      const conn2 = createMockWs()
      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash: hashRunnerKey(rotated.key) },
        conn2.ws,
      )
      await service.deleteRunner(teamId, runner.id)
      expect(conn2.getClosed()?.code).toBe(1008)
    })

    it('rejects outstanding handshake if key was rotated or runner deleted before open()', async () => {
      const { runner, key } = await service.createRunner(teamId, { name: 'Runner Race' })
      const authenticated = await service.authenticateRunnerKey(key)
      expect(authenticated).not.toBeNull()

      // Key rotates before registerConnection finishes
      await service.rotateRunnerKey(teamId, runner.id)
      const staleConn = createMockWs()
      await service.registerConnection(authenticated!, staleConn.ws)

      expect(staleConn.getClosed()?.code).toBe(1008)
      expect(service.isRunnerConnected(runner.id)).toBe(false)
      expect(staleConn.sent).toHaveLength(0)

      // Deleting runner after authentication also blocks registration
      const { runner: rDel, key: kDel } = await service.createRunner(teamId, { name: 'Runner Del' })
      const authedDel = await service.authenticateRunnerKey(kDel)
      await service.deleteRunner(teamId, rDel.id)

      const delConn = createMockWs()
      await service.registerConnection(authedDel!, delConn.ws)
      expect(delConn.getClosed()?.code).toBe(1008)
      expect(service.isRunnerConnected(rDel.id)).toBe(false)
    })
  })

  describe('Agent Runner Resolution', () => {
    it('resolves team default runner when agentRunnerId is null and specific runner when set', async () => {
      const r1 = await service.createRunner(teamId, { name: 'Default Runner' })
      const r2 = await service.createRunner(teamId, { name: 'Dedicated GPU Runner' })

      const resolvedDefault = await service.resolveRunnerForAgent(teamId, null)
      expect(resolvedDefault.runner?.id).toBe(r1.runner.id)
      expect(resolvedDefault.isBoundToAgent).toBe(false)

      const resolvedPinned = await service.resolveRunnerForAgent(teamId, r2.runner.id)
      expect(resolvedPinned.runner?.id).toBe(r2.runner.id)
      expect(resolvedPinned.isBoundToAgent).toBe(true)

      // When offline, requireOnlineRunner throws a clear message naming the runner
      await expect(service.requireOnlineRunner(teamId, r2.runner.id)).rejects.toThrow(
        /Dedicated GPU Runner.*currently offline/,
      )

      const conn2 = createMockWs()
      await service.registerConnection(
        { id: r2.runner.id, teamId, name: r2.runner.name, keyHash: hashRunnerKey(r2.key) },
        conn2.ws,
      )
      const online = await service.requireOnlineRunner(teamId, r2.runner.id)
      expect(online.id).toBe(r2.runner.id)
    })
  })

  describe('RPC Execution & File Operations over WebSocket', () => {
    it('executes bash commands, streams stdout/stderr, and returns exit result', async () => {
      const { runner, key } = await service.createRunner(teamId, { name: 'Exec Runner' })
      const conn = createMockWs()
      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash: hashRunnerKey(key) },
        conn.ws,
      )

      const chunks: Array<{ stream: string; text: string }> = []
      const execPromise = service.exec(runner.id, {
        command: 'echo hi',
        env: { FOO: 'bar' },
        onOutput: (text, stream) => chunks.push({ stream, text }),
      })

      const startMsg = conn.lastSentJson()
      expect(startMsg).toMatchObject({
        type: 'exec.start',
        command: 'echo hi',
        env: { FOO: 'bar' },
      })

      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'exec.output',
          executionId: startMsg.executionId,
          stream: 'stdout',
          offset: 0,
          data: 'hello ',
        }),
      )
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'exec.output',
          executionId: startMsg.executionId,
          stream: 'stderr',
          offset: 6,
          data: 'warn',
        }),
      )
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'exec.result',
          executionId: startMsg.executionId,
          exitCode: 0,
          signal: null,
          timedOut: false,
          aborted: false,
          fullOutputPath: '.pi/logs/bash-123.log',
        }),
      )

      const res = await execPromise
      expect(res).toMatchObject({
        executionId: startMsg.executionId,
        output: 'hello warn',
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        fullOutputPath: '.pi/logs/bash-123.log',
      })
      expect(chunks).toEqual([
        { stream: 'stdout', text: 'hello ' },
        { stream: 'stderr', text: 'warn' },
      ])
    })

    it('omits retained output when collectOutput is false and bounds tail when maxBufferedOutputBytes is set', async () => {
      const { runner, key } = await service.createRunner(teamId, { name: 'Bounded Runner' })
      const keyHash = hashRunnerKey(key)
      const conn = createMockWs()
      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash },
        conn.ws,
      )

      const streamed: string[] = []
      const noCollectPromise = service.exec(runner.id, {
        command: 'yes | head -n 100',
        collectOutput: false,
        onOutput: (chunk) => streamed.push(chunk),
      })
      const msg1 = conn.lastSentJson()
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'exec.output',
          executionId: msg1.executionId,
          stream: 'stdout',
          offset: 0,
          data: 'a'.repeat(4096),
        }),
      )
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'exec.result',
          executionId: msg1.executionId,
          exitCode: 0,
          signal: null,
          timedOut: false,
          aborted: false,
        }),
      )
      const noCollectRes = await noCollectPromise
      expect(noCollectRes.output).toBe('')
      expect(streamed.join('')).toHaveLength(4096)

      const boundedPromise = service.exec(runner.id, {
        command: 'echo bounded',
        maxBufferedOutputBytes: 6,
      })
      const msg2 = conn.lastSentJson()
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'exec.output',
          executionId: msg2.executionId,
          stream: 'stdout',
          offset: 0,
          data: '1234567890',
        }),
      )
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'exec.result',
          executionId: msg2.executionId,
          exitCode: 0,
          signal: null,
          timedOut: false,
          aborted: false,
        }),
      )
      const boundedRes = await boundedPromise
      expect(boundedRes.output).toBe('567890')
    })

    it('sends exec.cancel when AbortSignal fires', async () => {
      const { runner, key } = await service.createRunner(teamId, { name: 'Cancel Runner' })
      const conn = createMockWs()
      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash: hashRunnerKey(key) },
        conn.ws,
      )

      const abortController = new AbortController()
      const execPromise = service.exec(runner.id, {
        command: 'sleep 30',
        signal: abortController.signal,
      })

      const startMsg = conn.lastSentJson()
      abortController.abort()

      const cancelMsg = conn.lastSentJson()
      expect(cancelMsg).toEqual({
        type: 'exec.cancel',
        executionId: startMsg.executionId,
      })

      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'exec.result',
          executionId: startMsg.executionId,
          exitCode: null,
          signal: 'SIGKILL',
          timedOut: false,
          aborted: true,
        }),
      )

      const res = await execPromise
      expect(res.aborted).toBe(true)
    })

    it('handles downloadToRunner, uploadFromRunner, statOnRunner, and session caching', async () => {
      vi.spyOn(s3Service, 'presign').mockResolvedValue('https://signed.example.com/file')
      const { runner, key } = await service.createRunner(teamId, { name: 'File Runner' })
      const conn = createMockWs()
      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash: hashRunnerKey(key) },
        conn.ws,
      )

      // 1. downloadToRunner
      const dlPromise = service.downloadToRunner(runner.id, {
        url: 'https://signed.example.com/asset',
        destPath: '.pi/video.mp4',
      })
      const dlReq = conn.lastSentJson()
      expect(dlReq.type).toBe('file.download')
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'file.download.result',
          executionId: dlReq.executionId,
          ok: true,
          size: 1024,
          mimeType: 'video/mp4',
        }),
      )
      await expect(dlPromise).resolves.toMatchObject({
        ok: true,
        size: 1024,
        mimeType: 'video/mp4',
      })

      // 2. statOnRunner
      const statPromise = service.statOnRunner(runner.id, '.pi/out.png')
      const statReq = conn.lastSentJson()
      expect(statReq.type).toBe('file.stat')
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'file.stat.result',
          executionId: statReq.executionId,
          ok: true,
          exists: true,
          size: 512,
          mimeType: 'image/png',
        }),
      )
      await expect(statPromise).resolves.toMatchObject({
        ok: true,
        exists: true,
        size: 512,
        mimeType: 'image/png',
      })

      // 3. uploadFromRunner
      const ulPromise = service.uploadFromRunner(runner.id, {
        srcPath: '.pi/out.png',
        url: 'https://signed.example.com/put',
        contentType: 'image/png',
      })
      const ulReq = conn.lastSentJson()
      expect(ulReq.type).toBe('file.upload')
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'file.upload.result',
          executionId: ulReq.executionId,
          ok: true,
          size: 512,
        }),
      )
      await expect(ulPromise).resolves.toMatchObject({ ok: true, size: 512 })

      // 4. ensureSkillOnRunner caches by skillId:hash per connection
      const asset = await prisma.asset.create({
        data: {
          name: 'skill.zip',
          type: 'file',
          status: 'uploaded',
          storageKey: { create: { key: 'skills/s1.zip' } },
        },
      })
      const skillPromise1 = service.ensureSkillOnRunner(runner.id, {
        id: 'skill-1',
        assetId: asset.id,
        hash: 'h1',
      })
      await vi.waitFor(() => expect(conn.lastSentJson()?.type).toBe('file.download'))
      const skillReq = conn.lastSentJson()
      expect(skillReq).toMatchObject({
        type: 'file.download',
        destPath: '.pi/skills/skill-1',
        extractZip: true,
        expectedHash: 'h1',
      })
      service.handleMessage(
        runner.id,
        conn.ws,
        JSON.stringify({
          type: 'file.download.result',
          executionId: skillReq.executionId,
          ok: true,
          size: 100,
        }),
      )
      await skillPromise1

      const countBeforeSecondCall = conn.sent.length
      await service.ensureSkillOnRunner(runner.id, {
        id: 'skill-1',
        assetId: asset.id,
        hash: 'h1',
      })
      expect(conn.sent.length).toBe(countBeforeSecondCall)
    })

    it('recovers in-flight execution across a brief disconnect when runner reconciles', async () => {
      const { runner, key } = await service.createRunner(teamId, { name: 'Reconnect Runner' })
      const keyHash = hashRunnerKey(key)
      const conn1 = createMockWs()
      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash },
        conn1.ws,
      )

      const execPromise = service.exec(runner.id, { command: 'long-job' })
      const startMsg = conn1.lastSentJson()

      // Disconnect conn1 (starts grace timer)
      service.handleDisconnect(runner.id, conn1.ws)

      // Reconnect conn2 within grace period and send reconcile with active executionId
      const conn2 = createMockWs()
      await service.registerConnection(
        { id: runner.id, teamId, name: runner.name, keyHash },
        conn2.ws,
      )
      service.handleMessage(
        runner.id,
        conn2.ws,
        JSON.stringify({
          type: 'reconcile',
          activeExecutions: [{ executionId: startMsg.executionId, nextOffset: 0 }],
          completedExecutions: [],
        }),
      )

      // Finish execution on conn2
      service.handleMessage(
        runner.id,
        conn2.ws,
        JSON.stringify({
          type: 'exec.result',
          executionId: startMsg.executionId,
          exitCode: 0,
          signal: null,
          timedOut: false,
          aborted: false,
        }),
      )

      const result = await execPromise
      expect(result.exitCode).toBe(0)
    })
  })
})
