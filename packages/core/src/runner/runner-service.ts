import crypto from 'node:crypto'
import path from 'node:path'
import { ulid } from 'ulid'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '@shumai/db'
import {
  CreateRunnerRequest,
  CreateRunnerResponse,
  RotateRunnerKeyResponse,
  RunnerFileDownloadResultMessage,
  RunnerFileStatResultMessage,
  RunnerFileUploadResultMessage,
  RunnerInfo,
  RunnerToServerMessage,
  runnerToServerMessageSchema,
  ServerToRunnerMessage,
  UpdateRunnerRequest,
} from '@shumai/dtos'
import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'
import type {
  ResolvedRunnerTarget,
  RunnerExecOptions,
  RunnerExecResult,
  RunnerSocket,
} from './types'

const RUNNER_KEY_PREFIX = 'shm_rn_'
const DEFAULT_RECONNECT_GRACE_MS = 30_000
const DEFAULT_FILE_OP_TIMEOUT_MS = 120_000
const DEFAULT_EXEC_TIMEOUT_SEC = 120
const HEARTBEAT_INTERVAL_MS = 25_000
const HEARTBEAT_TIMEOUT_MS = 60_000

interface ActiveRunnerSession {
  runnerId: string
  teamId: string
  runnerName: string
  ws: RunnerSocket
  lastPongAt: number
  stagedSkills: Map<string, string>
  stagedGeneratedFiles: Set<string>
}

interface PendingExecOperation {
  kind: 'exec'
  executionId: string
  runnerId: string
  message: ServerToRunnerMessage
  outputChunks: string[]
  nextOffset: number
  onOutput?: (chunk: string, stream: 'stdout' | 'stderr') => void
  resolve: (result: RunnerExecResult) => void
  reject: (err: Error) => void
  timeoutTimer?: ReturnType<typeof setTimeout>
  cleanupSignal?: () => void
}

interface PendingFileDownloadOperation {
  kind: 'file.download'
  executionId: string
  runnerId: string
  message: ServerToRunnerMessage
  resolve: (result: RunnerFileDownloadResultMessage) => void
  reject: (err: Error) => void
  timeoutTimer?: ReturnType<typeof setTimeout>
}

interface PendingFileUploadOperation {
  kind: 'file.upload'
  executionId: string
  runnerId: string
  message: ServerToRunnerMessage
  resolve: (result: RunnerFileUploadResultMessage) => void
  reject: (err: Error) => void
  timeoutTimer?: ReturnType<typeof setTimeout>
}

interface PendingFileStatOperation {
  kind: 'file.stat'
  executionId: string
  runnerId: string
  message: ServerToRunnerMessage
  resolve: (result: RunnerFileStatResultMessage) => void
  reject: (err: Error) => void
  timeoutTimer?: ReturnType<typeof setTimeout>
}

type PendingOperation =
  | PendingExecOperation
  | PendingFileDownloadOperation
  | PendingFileUploadOperation
  | PendingFileStatOperation

export function generateRunnerKey(): { key: string; keyPrefix: string; keyHash: string } {
  const secretHex = crypto.randomBytes(24).toString('hex')
  const key = `${RUNNER_KEY_PREFIX}${secretHex}`
  const keyPrefix = key.slice(0, 14)
  const keyHash = hashRunnerKey(key)
  return { key, keyPrefix, keyHash }
}

export function hashRunnerKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export function validateRunnerWorkspacePath(targetPath: string): string {
  const trimmed = targetPath.trim().replace(/\\/g, '/')
  if (!trimmed || trimmed.startsWith('/')) {
    throw new Error(`Invalid runner workspace path "${targetPath}": path must be relative to .pi`)
  }
  const normalized = path.posix.normalize(trimmed)
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    (normalized !== '.pi' && !normalized.startsWith('.pi/'))
  ) {
    throw new Error(
      `Invalid runner workspace path "${targetPath}": path must stay within .pi/ directory`,
    )
  }
  return normalized
}

export class RunnerService {
  private sessions = new Map<string, ActiveRunnerSession>()
  private pendingOps = new Map<string, PendingOperation>()
  private disconnectGraceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectGraceMs = DEFAULT_RECONNECT_GRACE_MS

  setReconnectGraceMs(ms: number): void {
    this.reconnectGraceMs = ms
  }

  startHeartbeatMonitor(): void {
    if (this.heartbeatTimer) return
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      for (const [runnerId, session] of this.sessions.entries()) {
        if (now - session.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
          logger.warn({ runnerId }, 'Runner WebSocket heartbeat timed out, closing socket')
          try {
            session.ws.close(1001, 'Heartbeat timeout')
          } catch {
            // Ignore close errors
          }
          this.handleDisconnect(runnerId, session.ws, 1001)
          continue
        }
        this.sendToSession(session, { type: 'ping', ts: now })
      }
    }, HEARTBEAT_INTERVAL_MS)
    if (typeof this.heartbeatTimer.unref === 'function') {
      this.heartbeatTimer.unref()
    }
  }

  stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  isRunnerConnected(runnerId: string): boolean {
    return this.sessions.has(runnerId)
  }

  // ----------------------------------------------------------------------
  // Runner CRUD & Default Runner Invariant
  // ----------------------------------------------------------------------

  async listRunners(teamId: string): Promise<RunnerInfo[]> {
    const runners = await prisma.runner.findMany({
      where: { teamId },
      orderBy: { id: 'desc' },
    })
    return runners.map((r) => this.toRunnerInfo(r))
  }

  async getRunner(teamId: string, runnerId: string): Promise<RunnerInfo> {
    const runner = await prisma.runner.findFirst({
      where: { id: runnerId, teamId },
    })
    if (!runner) {
      throw new HTTPException(404, { message: 'Runner not found' })
    }
    return this.toRunnerInfo(runner)
  }

  async createRunner(teamId: string, req: CreateRunnerRequest): Promise<CreateRunnerResponse> {
    const name = req.name.trim()
    const existingByName = await prisma.runner.findFirst({
      where: { teamId, name },
    })
    if (existingByName) {
      throw new HTTPException(409, { message: `Runner "${name}" already exists` })
    }

    const { key, keyPrefix, keyHash } = generateRunnerKey()

    const runner = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.runner.count({ where: { teamId } })
      const shouldBeDefault = existingCount === 0 || req.isDefault === true

      if (shouldBeDefault && existingCount > 0) {
        await tx.runner.updateMany({
          where: { teamId, isDefault: true },
          data: { isDefault: false },
        })
      }

      return await tx.runner.create({
        data: {
          teamId,
          name,
          description: req.description?.trim() || null,
          keyPrefix,
          keyHash,
          isDefault: shouldBeDefault,
        },
      })
    })

    logger.info({ teamId, runnerId: runner.id, name: runner.name }, 'Runner created')
    return {
      runner: this.toRunnerInfo(runner),
      key,
    }
  }

  async updateRunner(
    teamId: string,
    runnerId: string,
    req: UpdateRunnerRequest,
  ): Promise<RunnerInfo> {
    const existing = await prisma.runner.findFirst({
      where: { id: runnerId, teamId },
    })
    if (!existing) {
      throw new HTTPException(404, { message: 'Runner not found' })
    }

    const nextName = req.name !== undefined ? req.name.trim() : existing.name
    if (nextName !== existing.name) {
      const duplicate = await prisma.runner.findFirst({
        where: { teamId, name: nextName },
      })
      if (duplicate && duplicate.id !== runnerId) {
        throw new HTTPException(409, { message: `Runner "${nextName}" already exists` })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      let nextIsDefault = existing.isDefault

      if (req.isDefault === true && !existing.isDefault) {
        await tx.runner.updateMany({
          where: { teamId, id: { not: runnerId }, isDefault: true },
          data: { isDefault: false },
        })
        nextIsDefault = true
      } else if (req.isDefault === false && existing.isDefault) {
        const fallback = await tx.runner.findFirst({
          where: { teamId, id: { not: runnerId } },
          orderBy: { id: 'desc' },
        })
        if (fallback) {
          await tx.runner.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          })
          nextIsDefault = false
        } else {
          // Only runner in team must remain default to preserve the invariant
          nextIsDefault = true
        }
      }

      return await tx.runner.update({
        where: { id: runnerId },
        data: {
          name: nextName,
          ...(req.description !== undefined && {
            description: req.description ? req.description.trim() : null,
          }),
          isDefault: nextIsDefault,
        },
      })
    })

    const session = this.sessions.get(runnerId)
    if (session) {
      session.runnerName = updated.name
    }

    logger.info({ teamId, runnerId }, 'Runner updated')
    return this.toRunnerInfo(updated)
  }

  async rotateRunnerKey(teamId: string, runnerId: string): Promise<RotateRunnerKeyResponse> {
    const existing = await prisma.runner.findFirst({
      where: { id: runnerId, teamId },
    })
    if (!existing) {
      throw new HTTPException(404, { message: 'Runner not found' })
    }

    const { key, keyPrefix, keyHash } = generateRunnerKey()
    const updated = await prisma.runner.update({
      where: { id: runnerId },
      data: { keyPrefix, keyHash },
    })

    this.revokeActiveSession(runnerId, 'Runner key rotated')
    logger.info({ teamId, runnerId }, 'Runner key rotated')

    return {
      runner: this.toRunnerInfo(updated),
      key,
    }
  }

  async deleteRunner(teamId: string, runnerId: string): Promise<void> {
    const existing = await prisma.runner.findFirst({
      where: { id: runnerId, teamId },
    })
    if (!existing) {
      throw new HTTPException(404, { message: 'Runner not found' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.runner.delete({
        where: { id: runnerId },
      })

      if (existing.isDefault) {
        const newestRemaining = await tx.runner.findFirst({
          where: { teamId },
          orderBy: { id: 'desc' },
        })
        if (newestRemaining) {
          await tx.runner.update({
            where: { id: newestRemaining.id },
            data: { isDefault: true },
          })
        }
      }
    })

    this.revokeActiveSession(runnerId, 'Runner deleted')
    logger.info({ teamId, runnerId }, 'Runner deleted')
  }

  // ----------------------------------------------------------------------
  // Agent Runner Resolution
  // ----------------------------------------------------------------------

  async resolveRunnerForAgent(
    teamId: string,
    agentRunnerId?: string | null,
  ): Promise<ResolvedRunnerTarget> {
    const runners = await prisma.runner.findMany({
      where: { teamId },
      orderBy: { id: 'desc' },
    })

    if (runners.length === 0) {
      return {
        hasConfiguredRunner: false,
        runner: null,
        isBoundToAgent: false,
      }
    }

    if (agentRunnerId) {
      const bound = runners.find((r) => r.id === agentRunnerId)
      if (bound) {
        return {
          hasConfiguredRunner: true,
          runner: this.toRunnerInfo(bound),
          isBoundToAgent: true,
        }
      }
    }

    const defaultRunner = runners.find((r) => r.isDefault) ?? runners[0]
    return {
      hasConfiguredRunner: true,
      runner: this.toRunnerInfo(defaultRunner),
      isBoundToAgent: false,
    }
  }

  async requireOnlineRunner(teamId: string, agentRunnerId?: string | null): Promise<RunnerInfo> {
    const resolved = await this.resolveRunnerForAgent(teamId, agentRunnerId)
    if (!resolved.hasConfiguredRunner || !resolved.runner) {
      throw new Error(
        'No Runner is configured for this team. Please configure and start a Runner in Team Settings > Runners.',
      )
    }

    if (!this.isRunnerConnected(resolved.runner.id)) {
      if (resolved.isBoundToAgent) {
        throw new Error(
          `Runner "${resolved.runner.name}" is currently offline. Please start the runner ("shumai runner start") and try again.`,
        )
      }
      throw new Error(
        `Default runner "${resolved.runner.name}" is currently offline. Please start the runner ("shumai runner start") and try again.`,
      )
    }

    return resolved.runner
  }

  // ----------------------------------------------------------------------
  // WebSocket Authentication & Session Management
  // ----------------------------------------------------------------------

  async authenticateRunnerKey(
    rawKey: string,
  ): Promise<{ id: string; teamId: string; name: string } | null> {
    const trimmed = rawKey.trim()
    if (!trimmed.startsWith(RUNNER_KEY_PREFIX)) {
      return null
    }
    const keyHash = hashRunnerKey(trimmed)
    const runner = await prisma.runner.findUnique({
      where: { keyHash },
      select: { id: true, teamId: true, name: true },
    })
    return runner
  }

  async registerConnection(
    runner: { id: string; teamId: string; name: string },
    ws: RunnerSocket,
  ): Promise<void> {
    const existingTimer = this.disconnectGraceTimers.get(runner.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.disconnectGraceTimers.delete(runner.id)
    }

    const existingSession = this.sessions.get(runner.id)
    if (existingSession && existingSession.ws !== ws) {
      logger.info({ runnerId: runner.id }, 'Evicting previous runner WebSocket connection')
      // Remove from sessions before closing so handleDisconnect is a no-op for the old socket
      this.sessions.delete(runner.id)
      try {
        existingSession.ws.close(4000, 'Replaced by a newer connection')
      } catch {
        // Ignore close errors
      }
    }

    const session: ActiveRunnerSession = {
      runnerId: runner.id,
      teamId: runner.teamId,
      runnerName: runner.name,
      ws,
      lastPongAt: Date.now(),
      stagedSkills: new Map(),
      stagedGeneratedFiles: new Set(),
    }
    this.sessions.set(runner.id, session)
    this.startHeartbeatMonitor()

    await prisma.runner
      .update({
        where: { id: runner.id },
        data: { lastConnectedAt: new Date() },
      })
      .catch((err) => {
        logger.warn({ err, runnerId: runner.id }, 'Failed to update runner lastConnectedAt')
      })

    const inFlightExecutionIds = this.getInFlightExecutionIdsForRunner(runner.id)
    this.sendToSession(session, {
      type: 'welcome',
      runnerId: runner.id,
      runnerName: runner.name,
      serverTime: Date.now(),
      inFlightExecutionIds,
    })
  }

  handleMessage(runnerId: string, ws: RunnerSocket, rawData: string | Buffer | Uint8Array): void {
    const session = this.sessions.get(runnerId)
    if (!session || session.ws !== ws) {
      return
    }
    session.lastPongAt = Date.now()

    let parsedJson: unknown
    try {
      const text = typeof rawData === 'string' ? rawData : Buffer.from(rawData).toString('utf-8')
      parsedJson = JSON.parse(text)
    } catch (err) {
      logger.warn({ err, runnerId }, 'Invalid JSON received from runner WebSocket')
      return
    }

    const parsed = runnerToServerMessageSchema.safeParse(parsedJson)
    if (!parsed.success) {
      logger.warn(
        { runnerId, issues: parsed.error.issues },
        'Invalid protocol message received from runner WebSocket',
      )
      return
    }

    const msg: RunnerToServerMessage = parsed.data
    switch (msg.type) {
      case 'pong':
        break
      case 'reconcile':
        this.handleReconcileMessage(session, msg)
        break
      case 'exec.output':
        this.handleExecOutputMessage(runnerId, msg)
        break
      case 'exec.result':
        this.handleExecResultMessage(runnerId, msg)
        break
      case 'file.download.result':
        this.handleFileDownloadResultMessage(runnerId, msg)
        break
      case 'file.upload.result':
        this.handleFileUploadResultMessage(runnerId, msg)
        break
      case 'file.stat.result':
        this.handleFileStatResultMessage(runnerId, msg)
        break
    }
  }

  handleDisconnect(runnerId: string, ws: RunnerSocket, code?: number): void {
    const session = this.sessions.get(runnerId)
    if (!session || session.ws !== ws) {
      return
    }
    this.sessions.delete(runnerId)

    void prisma.runner
      .update({
        where: { id: runnerId },
        data: { lastDisconnectedAt: new Date() },
      })
      .catch(() => {
        // Runner may have been deleted
      })

    const inFlightIds = this.getInFlightExecutionIdsForRunner(runnerId)
    if (inFlightIds.length === 0) {
      return
    }

    if (code === 1008 || this.reconnectGraceMs <= 0) {
      this.failPendingOperationsForRunner(
        runnerId,
        new Error('Runner disconnected while operation was in progress'),
      )
      return
    }

    const timer = setTimeout(() => {
      this.disconnectGraceTimers.delete(runnerId)
      if (!this.isRunnerConnected(runnerId)) {
        this.failPendingOperationsForRunner(
          runnerId,
          new Error('Runner disconnected and did not reconnect within the grace period'),
        )
      }
    }, this.reconnectGraceMs)

    if (typeof timer.unref === 'function') {
      timer.unref()
    }
    this.disconnectGraceTimers.set(runnerId, timer)
  }

  // ----------------------------------------------------------------------
  // RPC Methods (Server -> Runner)
  // ----------------------------------------------------------------------

  async exec(runnerId: string, options: RunnerExecOptions): Promise<RunnerExecResult> {
    const session = this.sessions.get(runnerId)
    if (!session) {
      throw new Error('Runner is not connected')
    }

    if (options.signal?.aborted) {
      throw new Error('Command aborted before execution started')
    }

    const executionId = ulid()
    const timeoutSec = options.timeoutSec ?? DEFAULT_EXEC_TIMEOUT_SEC
    const message: ServerToRunnerMessage = {
      type: 'exec.start',
      executionId,
      command: options.command,
      timeoutSec,
      ...(options.env && Object.keys(options.env).length > 0 ? { env: options.env } : {}),
    }

    return await new Promise<RunnerExecResult>((resolve, reject) => {
      const safetyTimeoutMs = Math.max((timeoutSec + 15) * 1000, 15_000)
      const timeoutTimer = setTimeout(() => {
        const pending = this.pendingOps.get(executionId)
        if (!pending) return
        this.cleanupPendingOp(executionId)
        const currentSession = this.sessions.get(runnerId)
        if (currentSession) {
          this.sendToSession(currentSession, { type: 'exec.cancel', executionId })
        }
        resolve({
          executionId,
          output: pending.kind === 'exec' ? pending.outputChunks.join('') : '',
          exitCode: null,
          signal: 'SIGKILL',
          timedOut: true,
          aborted: false,
        })
      }, safetyTimeoutMs)

      let cleanupSignal: (() => void) | undefined
      if (options.signal) {
        const onAbort = () => {
          const currentSession = this.sessions.get(runnerId)
          if (currentSession) {
            this.sendToSession(currentSession, { type: 'exec.cancel', executionId })
          }
          // Give runner a short window to report exec.result, otherwise resolve as aborted
          const abortTimer = setTimeout(() => {
            const pending = this.pendingOps.get(executionId)
            if (!pending) return
            this.cleanupPendingOp(executionId)
            resolve({
              executionId,
              output: pending.kind === 'exec' ? pending.outputChunks.join('') : '',
              exitCode: null,
              signal: 'SIGKILL',
              timedOut: false,
              aborted: true,
            })
          }, 2_000)
          if (typeof abortTimer.unref === 'function') {
            abortTimer.unref()
          }
        }
        options.signal.addEventListener('abort', onAbort, { once: true })
        cleanupSignal = () => options.signal?.removeEventListener('abort', onAbort)
      }

      const pendingOp: PendingExecOperation = {
        kind: 'exec',
        executionId,
        runnerId,
        message,
        outputChunks: [],
        nextOffset: 0,
        onOutput: options.onOutput,
        resolve,
        reject,
        timeoutTimer,
        cleanupSignal,
      }

      this.pendingOps.set(executionId, pendingOp)
      this.sendToSession(session, message)
    })
  }

  async downloadToRunner(
    runnerId: string,
    options: {
      url: string
      destPath: string
      extractZip?: boolean
      expectedHash?: string
      timeoutMs?: number
    },
  ): Promise<RunnerFileDownloadResultMessage> {
    const session = this.sessions.get(runnerId)
    if (!session) {
      throw new Error('Runner is not connected')
    }

    const normalizedDestPath = validateRunnerWorkspacePath(options.destPath)
    const executionId = ulid()
    const message: ServerToRunnerMessage = {
      type: 'file.download',
      executionId,
      url: options.url,
      destPath: normalizedDestPath,
      ...(options.extractZip !== undefined ? { extractZip: options.extractZip } : {}),
      ...(options.expectedHash !== undefined ? { expectedHash: options.expectedHash } : {}),
    }

    return await new Promise<RunnerFileDownloadResultMessage>((resolve, reject) => {
      const timeoutMs = options.timeoutMs ?? DEFAULT_FILE_OP_TIMEOUT_MS
      const timeoutTimer = setTimeout(() => {
        this.cleanupPendingOp(executionId)
        reject(new Error(`Timed out downloading file to runner path ${normalizedDestPath}`))
      }, timeoutMs)

      this.pendingOps.set(executionId, {
        kind: 'file.download',
        executionId,
        runnerId,
        message,
        resolve,
        reject,
        timeoutTimer,
      })

      this.sendToSession(session, message)
    })
  }

  async statOnRunner(
    runnerId: string,
    srcPath: string,
    timeoutMs = DEFAULT_FILE_OP_TIMEOUT_MS,
  ): Promise<RunnerFileStatResultMessage> {
    const session = this.sessions.get(runnerId)
    if (!session) {
      throw new Error('Runner is not connected')
    }

    const normalizedSrcPath = validateRunnerWorkspacePath(srcPath)
    const executionId = ulid()
    const message: ServerToRunnerMessage = {
      type: 'file.stat',
      executionId,
      srcPath: normalizedSrcPath,
    }

    return await new Promise<RunnerFileStatResultMessage>((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        this.cleanupPendingOp(executionId)
        reject(new Error(`Timed out inspecting file on runner path ${normalizedSrcPath}`))
      }, timeoutMs)

      this.pendingOps.set(executionId, {
        kind: 'file.stat',
        executionId,
        runnerId,
        message,
        resolve,
        reject,
        timeoutTimer,
      })

      this.sendToSession(session, message)
    })
  }

  async uploadFromRunner(
    runnerId: string,
    options: {
      srcPath: string
      url: string
      contentType?: string
      timeoutMs?: number
    },
  ): Promise<RunnerFileUploadResultMessage> {
    const session = this.sessions.get(runnerId)
    if (!session) {
      throw new Error('Runner is not connected')
    }

    const normalizedSrcPath = validateRunnerWorkspacePath(options.srcPath)
    const executionId = ulid()
    const message: ServerToRunnerMessage = {
      type: 'file.upload',
      executionId,
      srcPath: normalizedSrcPath,
      url: options.url,
      ...(options.contentType ? { contentType: options.contentType } : {}),
    }

    return await new Promise<RunnerFileUploadResultMessage>((resolve, reject) => {
      const timeoutMs = options.timeoutMs ?? DEFAULT_FILE_OP_TIMEOUT_MS
      const timeoutTimer = setTimeout(() => {
        this.cleanupPendingOp(executionId)
        reject(new Error(`Timed out uploading file from runner path ${normalizedSrcPath}`))
      }, timeoutMs)

      this.pendingOps.set(executionId, {
        kind: 'file.upload',
        executionId,
        runnerId,
        message,
        resolve,
        reject,
        timeoutTimer,
      })

      this.sendToSession(session, message)
    })
  }

  async ensureSkillOnRunner(
    runnerId: string,
    skill: { id: string; assetId: string; hash: string },
  ): Promise<string> {
    const session = this.sessions.get(runnerId)
    if (!session) {
      throw new Error('Runner is not connected')
    }

    const destPath = `.pi/skills/${skill.id}`
    if (session.stagedSkills.get(skill.id) === skill.hash) {
      return destPath
    }

    const asset = await prisma.asset.findUnique({
      where: { id: skill.assetId },
      include: { storageKey: true },
    })
    if (!asset || !asset.storageKey?.key) {
      throw new Error(`Skill storage key not found for asset ${skill.assetId}`)
    }

    const bucket = process.env.S3_BUCKET || 'shumai'
    const signedUrl = await s3Service.presign(
      bucket,
      asset.storageKey.key,
      'GET',
      false,
      undefined,
      false,
      600,
    )

    const res = await this.downloadToRunner(runnerId, {
      url: signedUrl,
      destPath,
      extractZip: true,
      expectedHash: skill.hash,
    })
    if (!res.ok) {
      throw new Error(res.error || `Failed to stage skill ${skill.id} to runner`)
    }

    session.stagedSkills.set(skill.id, skill.hash)
    return destPath
  }

  async ensureGeneratedFileOnRunner(runnerId: string, virtualPath: string): Promise<string> {
    const session = this.sessions.get(runnerId)
    if (!session) {
      throw new Error('Runner is not connected')
    }

    const normalizedPath = validateRunnerWorkspacePath(virtualPath)
    if (!normalizedPath.startsWith('.pi/generated/')) {
      throw new Error(
        `Invalid generated file path "${virtualPath}": must start with .pi/generated/`,
      )
    }

    if (session.stagedGeneratedFiles.has(normalizedPath)) {
      return normalizedPath
    }

    // Virtual path .pi/generated/<ulid>/<filename> maps to storage key temp/generated/<ulid>/<filename>
    const bucket = process.env.S3_BUCKET || 'shumai'
    const storageKey = `temp/${normalizedPath.slice('.pi/'.length)}`
    try {
      await s3Service.headObject(bucket, storageKey)
    } catch {
      throw new Error(`Generated file "${virtualPath}" was not found or has expired`)
    }

    const signedUrl = await s3Service.presign(
      bucket,
      storageKey,
      'GET',
      false,
      undefined,
      false,
      600,
    )

    const res = await this.downloadToRunner(runnerId, {
      url: signedUrl,
      destPath: normalizedPath,
    })
    if (!res.ok) {
      throw new Error(res.error || `Failed to stage generated file "${virtualPath}" to runner`)
    }

    session.stagedGeneratedFiles.add(normalizedPath)
    return normalizedPath
  }

  // ----------------------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------------------

  private handleReconcileMessage(
    session: ActiveRunnerSession,
    msg: Extract<RunnerToServerMessage, { type: 'reconcile' }>,
  ): void {
    const completedIds = new Set<string>()
    for (const completed of msg.completedExecutions) {
      completedIds.add(completed.executionId)
      this.handleExecResultMessage(session.runnerId, completed)
    }

    const activeIds = new Set(msg.activeExecutions.map((a) => a.executionId))

    for (const [executionId, pending] of this.pendingOps.entries()) {
      if (pending.runnerId !== session.runnerId) continue
      if (completedIds.has(executionId) || activeIds.has(executionId)) {
        continue
      }

      if (pending.kind === 'exec') {
        this.cleanupPendingOp(executionId)
        pending.reject(
          new Error(
            `Runner reconnected without active execution ${executionId} (runner process may have restarted)`,
          ),
        )
      } else {
        // Re-send idempotent file control operations on reconnect
        this.sendToSession(session, pending.message)
      }
    }
  }

  private handleExecOutputMessage(
    runnerId: string,
    msg: Extract<RunnerToServerMessage, { type: 'exec.output' }>,
  ): void {
    const pending = this.pendingOps.get(msg.executionId)
    if (!pending || pending.runnerId !== runnerId || pending.kind !== 'exec') {
      return
    }

    const buf = Buffer.from(msg.data, 'utf-8')
    const endOffset = msg.offset + buf.length
    if (endOffset <= pending.nextOffset) {
      return
    }

    const sliceStart = Math.max(0, pending.nextOffset - msg.offset)
    const newText = buf.subarray(sliceStart).toString('utf-8')
    pending.nextOffset = endOffset
    pending.outputChunks.push(newText)
    pending.onOutput?.(newText, msg.stream)
  }

  private handleExecResultMessage(
    runnerId: string,
    msg: Extract<RunnerToServerMessage, { type: 'exec.result' }>,
  ): void {
    const pending = this.pendingOps.get(msg.executionId)
    if (!pending || pending.runnerId !== runnerId || pending.kind !== 'exec') {
      return
    }

    this.cleanupPendingOp(msg.executionId)
    pending.resolve({
      executionId: msg.executionId,
      output: pending.outputChunks.join(''),
      exitCode: msg.exitCode,
      signal: msg.signal,
      timedOut: msg.timedOut,
      aborted: msg.aborted ?? false,
      fullOutputPath: msg.fullOutputPath,
      error: msg.error,
    })
  }

  private handleFileDownloadResultMessage(
    runnerId: string,
    msg: RunnerFileDownloadResultMessage,
  ): void {
    const pending = this.pendingOps.get(msg.executionId)
    if (!pending || pending.runnerId !== runnerId || pending.kind !== 'file.download') {
      return
    }
    this.cleanupPendingOp(msg.executionId)
    pending.resolve(msg)
  }

  private handleFileUploadResultMessage(
    runnerId: string,
    msg: RunnerFileUploadResultMessage,
  ): void {
    const pending = this.pendingOps.get(msg.executionId)
    if (!pending || pending.runnerId !== runnerId || pending.kind !== 'file.upload') {
      return
    }
    this.cleanupPendingOp(msg.executionId)
    pending.resolve(msg)
  }

  private handleFileStatResultMessage(runnerId: string, msg: RunnerFileStatResultMessage): void {
    const pending = this.pendingOps.get(msg.executionId)
    if (!pending || pending.runnerId !== runnerId || pending.kind !== 'file.stat') {
      return
    }
    this.cleanupPendingOp(msg.executionId)
    pending.resolve(msg)
  }

  private getInFlightExecutionIdsForRunner(runnerId: string): string[] {
    const ids: string[] = []
    for (const [executionId, pending] of this.pendingOps.entries()) {
      if (pending.runnerId === runnerId) {
        ids.push(executionId)
      }
    }
    return ids
  }

  private revokeActiveSession(runnerId: string, reason: string): void {
    const timer = this.disconnectGraceTimers.get(runnerId)
    if (timer) {
      clearTimeout(timer)
      this.disconnectGraceTimers.delete(runnerId)
    }

    const session = this.sessions.get(runnerId)
    if (session) {
      this.sessions.delete(runnerId)
      try {
        session.ws.close(1008, reason)
      } catch {
        // Ignore close errors
      }
    }

    this.failPendingOperationsForRunner(runnerId, new Error(reason))
  }

  private failPendingOperationsForRunner(runnerId: string, error: Error): void {
    for (const [executionId, pending] of this.pendingOps.entries()) {
      if (pending.runnerId === runnerId) {
        this.cleanupPendingOp(executionId)
        pending.reject(error)
      }
    }
  }

  private cleanupPendingOp(executionId: string): void {
    const pending = this.pendingOps.get(executionId)
    if (!pending) return
    this.pendingOps.delete(executionId)
    if (pending.timeoutTimer) {
      clearTimeout(pending.timeoutTimer)
    }
    if (pending.kind === 'exec' && pending.cleanupSignal) {
      pending.cleanupSignal()
    }
  }

  private sendToSession(session: ActiveRunnerSession, message: ServerToRunnerMessage): void {
    try {
      session.ws.send(JSON.stringify(message))
    } catch (err) {
      logger.warn({ err, runnerId: session.runnerId, type: message.type }, 'Failed to send WS msg')
    }
  }

  private toRunnerInfo(runner: {
    id: string
    teamId: string
    name: string
    description: string | null
    keyPrefix: string
    isDefault: boolean
    lastConnectedAt: Date | null
    lastDisconnectedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }): RunnerInfo {
    return {
      id: runner.id,
      teamId: runner.teamId,
      name: runner.name,
      description: runner.description,
      keyPrefix: runner.keyPrefix,
      isDefault: runner.isDefault,
      status: this.isRunnerConnected(runner.id) ? 'connected' : 'disconnected',
      lastConnectedAt: runner.lastConnectedAt,
      lastDisconnectedAt: runner.lastDisconnectedAt,
      createdAt: runner.createdAt,
      updatedAt: runner.updatedAt,
    }
  }
}

export const runnerService = new RunnerService()
