import * as fs from 'fs'
import { prisma } from '@shumai/db'
import type { TurntableSettingsResponse, UpdateTurntableSettingsRequest } from '@shumai/dtos'
import { logger } from '../logger'

export interface TurntableConfig {
  url?: string
  username?: string
  password?: string
  isEnv: boolean
}

export interface TurntablePosterOutput {
  fileId: string
  size: number
  contentType: string
  width: number
  height: number
}

export interface TurntableRenderSyncResponse {
  taskId: string
  status: 'queued' | 'rendering'
  positionInQueue?: number
  metadata?: Record<string, unknown>
  poster: TurntablePosterOutput
}

export interface TurntableVideoOutput {
  fileId: string
  size: number
  contentType: string
  width: number
  height: number
}

export interface TurntableRenderStats {
  width: number
  height: number
  frames: number
  fps: number
  durationSeconds: number
  degreesPerFrame: number
  startAngle: number
  direction: string
  includeEndFrame: boolean
  engine: string
  elapsedMs: number
}

export interface TurntableTaskResponse {
  taskId: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  positionInQueue?: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  failedAt?: string
  render?: TurntableRenderStats
  video?: TurntableVideoOutput
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export class TurntableService {
  async resolveConfig(teamId?: string): Promise<TurntableConfig> {
    const envUrl = process.env.TURNTABLE_RENDERER_URL?.trim()
    const envUsername =
      process.env.TURNTABLE_RENDERER_BASIC_AUTH_USERNAME?.trim() ||
      process.env.TURNTABLE_RENDERER_USERNAME?.trim()
    const envPassword =
      process.env.TURNTABLE_RENDERER_BASIC_AUTH_PASSWORD?.trim() ||
      process.env.TURNTABLE_RENDERER_PASSWORD?.trim()

    if (envUrl) {
      return {
        url: envUrl.replace(/\/+$/, ''),
        username: envUsername || undefined,
        password: envPassword || undefined,
        isEnv: true,
      }
    }

    if (teamId) {
      try {
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          select: { settings: true },
        })
        const teamSettings = team?.settings as PrismaJson.Settings | null
        const turntable = teamSettings?.turntable
        if (turntable?.url?.trim()) {
          return {
            url: turntable.url.trim().replace(/\/+$/, ''),
            username: turntable.username?.trim() || undefined,
            password: turntable.password?.trim() || undefined,
            isEnv: false,
          }
        }
      } catch (err) {
        logger.error({ err, teamId }, 'Failed to load team turntable settings')
      }
    }

    return {
      isEnv: false,
    }
  }

  private getAuthHeader(config: TurntableConfig): string | undefined {
    if (config.username && config.password) {
      const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64')
      return `Basic ${credentials}`
    }
    return undefined
  }

  async isAvailable(teamId?: string): Promise<boolean> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      return false
    }

    try {
      const headers: Record<string, string> = {}
      const authHeader = this.getAuthHeader(config)
      if (authHeader) {
        headers['Authorization'] = authHeader
      }

      const response = await fetch(`${config.url}/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(3000),
      })

      return response.ok
    } catch {
      return false
    }
  }

  async getSettings(teamId: string): Promise<TurntableSettingsResponse> {
    const config = await this.resolveConfig(teamId)
    return {
      url: config.url,
      username: config.username,
      hasPassword: Boolean(config.password),
      isEnvConfigured: config.isEnv,
    }
  }

  async updateSettings(
    teamId: string,
    req: UpdateTurntableSettingsRequest,
  ): Promise<TurntableSettingsResponse> {
    const currentConfig = await this.resolveConfig(teamId)
    if (currentConfig.isEnv) {
      throw new Error(
        'Turntable settings are configured via environment variables and cannot be edited',
      )
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { settings: true },
    })
    const settings = (team?.settings || {}) as PrismaJson.Settings
    const prevTurntable = settings.turntable || {}

    settings.turntable = {
      url: req.url !== undefined ? req.url : prevTurntable.url,
      username: req.username !== undefined ? req.username : prevTurntable.username,
      password: req.password !== undefined ? req.password : prevTurntable.password,
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { settings },
    })

    return this.getSettings(teamId)
  }

  async testConnection(
    config?: {
      url?: string
      username?: string
      password?: string
    },
    teamId?: string,
  ): Promise<{ ok: boolean; version?: string; blender?: string; error?: string }> {
    let resolvedUrl = config?.url?.trim()
    let resolvedUsername = config?.username?.trim()
    let resolvedPassword = config?.password

    if (teamId && (!resolvedUrl || resolvedPassword === undefined)) {
      const savedConfig = await this.resolveConfig(teamId)
      if (!resolvedUrl) {
        resolvedUrl = savedConfig.url
      }
      if (!resolvedUsername && savedConfig.username) {
        resolvedUsername = savedConfig.username
      }
      if (resolvedPassword === undefined) {
        resolvedPassword = savedConfig.password
      }
    }

    if (!resolvedUrl) {
      return { ok: false, error: 'URL is required' }
    }
    const cleanUrl = resolvedUrl.replace(/\/+$/, '')

    try {
      const headers: Record<string, string> = {}
      if (resolvedUsername && resolvedPassword) {
        const credentials = Buffer.from(`${resolvedUsername}:${resolvedPassword}`).toString(
          'base64',
        )
        headers['Authorization'] = `Basic ${credentials}`
      }

      const response = await fetch(`${cleanUrl}/version`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        return {
          ok: false,
          error: `Server returned status ${response.status}: ${errText || response.statusText}`,
        }
      }

      const body = (await response.json()) as { version?: string; blender?: string }
      return {
        ok: true,
        version: body.version,
        blender: body.blender,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  }

  async uploadFile(
    filePath: string,
    filename: string,
    teamId?: string,
  ): Promise<{ id: string; name: string; size: number }> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      throw new Error('Turntable renderer URL is not configured.')
    }

    const fileBytes = fs.readFileSync(filePath)
    const headers: Record<string, string> = {
      'content-type': 'application/octet-stream',
      'x-filename': encodeURIComponent(filename),
    }
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${config.url}/v1/files`, {
      method: 'POST',
      headers,
      body: fileBytes,
      signal: AbortSignal.timeout(120000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Turntable upload failed with status ${response.status}: ${errorText || response.statusText}`,
      )
    }

    return (await response.json()) as { id: string; name: string; size: number }
  }

  async startRender(
    fileId: string,
    options: Record<string, unknown> = {},
    teamId?: string,
  ): Promise<TurntableRenderSyncResponse> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      throw new Error('Turntable renderer URL is not configured.')
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${config.url}/v1/render`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: { fileId },
        options,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Turntable render request failed with status ${response.status}: ${errorText || response.statusText}`,
      )
    }

    return (await response.json()) as TurntableRenderSyncResponse
  }

  async getTaskStatus(taskId: string, teamId?: string): Promise<TurntableTaskResponse> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      throw new Error('Turntable renderer URL is not configured.')
    }

    const headers: Record<string, string> = {}
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${config.url}/v1/render/tasks/${taskId}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Failed to fetch task status (${response.status}): ${errorText || response.statusText}`,
      )
    }

    return (await response.json()) as TurntableTaskResponse
  }

  async downloadFile(fileId: string, targetPath?: string, teamId?: string): Promise<Buffer> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      throw new Error('Turntable renderer URL is not configured.')
    }

    const headers: Record<string, string> = {}
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${config.url}/v1/files/${fileId}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(120000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Failed to download file ${fileId} (${response.status}): ${errorText || response.statusText}`,
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (targetPath) {
      fs.writeFileSync(targetPath, buffer)
    }
    return buffer
  }

  async deleteTask(taskId: string, teamId?: string): Promise<boolean> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      return false
    }

    const headers: Record<string, string> = {}
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    try {
      const response = await fetch(`${config.url}/v1/render/tasks/${taskId}`, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(10000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  async deleteFile(fileId: string, teamId?: string): Promise<boolean> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      return false
    }

    const headers: Record<string, string> = {}
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    try {
      const response = await fetch(`${config.url}/v1/files/${fileId}`, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(10000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export const turntableService = new TurntableService()
