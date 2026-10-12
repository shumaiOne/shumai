import * as fs from 'fs'
import type { TurntableSettingsResponse, UpdateTurntableSettingsRequest } from '@shumai/dtos'
import {
  IntegrationDefinition,
  resolveIntegrationConfig,
  getIntegrationSettings,
  updateIntegrationSettings,
  resolveTestConnectionConfig,
  getIntegrationBasicAuthHeader,
} from '@shumai/core/src/integrations/helper'

export const TURNTABLE_INTEGRATION_DEF: IntegrationDefinition<'turntable'> = {
  name: 'Turntable',
  settingsKey: 'turntable',
  envKeys: {
    url: ['TURNTABLE_RENDERER_URL'],
    username: ['TURNTABLE_RENDERER_BASIC_AUTH_USERNAME', 'TURNTABLE_RENDERER_USERNAME'],
    password: ['TURNTABLE_RENDERER_BASIC_AUTH_PASSWORD', 'TURNTABLE_RENDERER_PASSWORD'],
  },
}

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
    return resolveIntegrationConfig(TURNTABLE_INTEGRATION_DEF, teamId)
  }

  private getAuthHeader(config: TurntableConfig): string | undefined {
    return getIntegrationBasicAuthHeader(config)
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
    return getIntegrationSettings(TURNTABLE_INTEGRATION_DEF, teamId)
  }

  async updateSettings(
    teamId: string,
    req: UpdateTurntableSettingsRequest,
  ): Promise<TurntableSettingsResponse> {
    return updateIntegrationSettings(TURNTABLE_INTEGRATION_DEF, teamId, req)
  }

  async testConnection(
    config?: {
      url?: string
      username?: string
      password?: string
    },
    teamId?: string,
  ): Promise<{ ok: boolean; version?: string; blender?: string; error?: string }> {
    const target = await resolveTestConnectionConfig(TURNTABLE_INTEGRATION_DEF, config, teamId)

    if (!target.resolvedUrl) {
      return { ok: false, error: 'URL is required' }
    }
    const cleanUrl = target.resolvedUrl.replace(/\/+$/, '')

    try {
      const headers: Record<string, string> = {}
      const authHeader = getIntegrationBasicAuthHeader({
        username: target.resolvedUsername,
        password: target.resolvedPassword,
      })
      if (authHeader) {
        headers['Authorization'] = authHeader
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
      body: Bun.file(filePath),
      signal: AbortSignal.timeout(900000),
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
