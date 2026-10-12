import * as fs from 'fs'
import type { GotenbergSettingsResponse, UpdateGotenbergSettingsRequest } from '@shumai/dtos'
import {
  IntegrationDefinition,
  resolveIntegrationConfig,
  getIntegrationSettings,
  updateIntegrationSettings,
  resolveTestConnectionConfig,
  getIntegrationBasicAuthHeader,
  ResolvedIntegrationConfig,
} from '@shumai/core/src/integrations/helper'

export const GOTENBERG_INTEGRATION_DEF: IntegrationDefinition<'gotenberg'> = {
  name: 'Gotenberg',
  settingsKey: 'gotenberg',
  envKeys: {
    url: ['GOTENBERG_URL'],
    username: ['GOTENBERG_BASIC_AUTH_USERNAME'],
    password: ['GOTENBERG_BASIC_AUTH_PASSWORD'],
  },
}

export interface GotenbergConvertOptions {
  landscape?: boolean
  teamId?: string
}

export class GotenbergService {
  async resolveConfig(teamId?: string): Promise<ResolvedIntegrationConfig> {
    return resolveIntegrationConfig(GOTENBERG_INTEGRATION_DEF, teamId)
  }

  private getAuthHeader(config: { username?: string; password?: string }): string | undefined {
    return getIntegrationBasicAuthHeader(config)
  }

  async getSettings(teamId: string): Promise<GotenbergSettingsResponse> {
    return getIntegrationSettings(GOTENBERG_INTEGRATION_DEF, teamId)
  }

  async updateSettings(
    teamId: string,
    req: UpdateGotenbergSettingsRequest,
  ): Promise<GotenbergSettingsResponse> {
    return updateIntegrationSettings(GOTENBERG_INTEGRATION_DEF, teamId, req)
  }

  async testConnection(
    config?: UpdateGotenbergSettingsRequest,
    teamId?: string,
  ): Promise<{ ok: boolean; version?: string; error?: string }> {
    const target = await resolveTestConnectionConfig(GOTENBERG_INTEGRATION_DEF, config, teamId)

    if (!target.resolvedUrl) {
      return { ok: false, error: 'URL is required' }
    }
    const cleanUrl = target.resolvedUrl.replace(/\/+$/, '')

    try {
      const headers: Record<string, string> = {}
      const authHeader = this.getAuthHeader({
        username: target.resolvedUsername,
        password: target.resolvedPassword,
      })
      if (authHeader) {
        headers['Authorization'] = authHeader
      }

      const response = await fetch(`${cleanUrl}/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        return {
          ok: false,
          error: `Health check returned status ${response.status}: ${errText || response.statusText}`,
        }
      }

      // Optionally try /version to obtain version string
      let version: string | undefined
      try {
        const versionRes = await fetch(`${cleanUrl}/version`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(2000),
        })
        if (versionRes.ok) {
          const vData = (await versionRes.json().catch(() => null)) as
            | { version?: string }
            | string
            | null
          if (vData && typeof vData === 'object' && 'version' in vData) {
            version = String(vData.version)
          } else if (typeof vData === 'string') {
            version = vData
          }
        }
      } catch {
        // Version endpoint is optional in some Gotenberg versions
      }

      return {
        ok: true,
        version,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: msg,
      }
    }
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

  async convertDocumentToPdf(
    filePath: string,
    filename: string,
    options: GotenbergConvertOptions = {},
    teamId?: string,
  ): Promise<Buffer> {
    const effectiveTeamId = teamId ?? options.teamId
    const config = await this.resolveConfig(effectiveTeamId)
    if (!config.url) {
      throw new Error('Gotenberg URL is not configured.')
    }

    const fileBytes = fs.readFileSync(filePath)
    const formData = new FormData()
    formData.append('files', new Blob([fileBytes]), filename)

    if (options.landscape) {
      formData.append('landscape', 'true')
    }

    const headers: Record<string, string> = {}
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${config.url}/forms/libreoffice/convert`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Gotenberg conversion failed with status ${response.status}: ${errorText || response.statusText}`,
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async convertHtmlToPdf(filePath: string, filename: string, teamId?: string): Promise<Buffer> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      throw new Error('Gotenberg URL is not configured.')
    }

    const fileBytes = fs.readFileSync(filePath)
    const formData = new FormData()
    const targetFilename =
      filename.toLowerCase().endsWith('.html') || filename.toLowerCase().endsWith('.htm')
        ? filename
        : 'index.html'
    formData.append('files', new Blob([fileBytes]), targetFilename)

    const headers: Record<string, string> = {}
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${config.url}/forms/chromium/convert/html`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Gotenberg HTML conversion failed with status ${response.status}: ${errorText || response.statusText}`,
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async convertMarkdownToPdf(filePath: string, filename: string, teamId?: string): Promise<Buffer> {
    const config = await this.resolveConfig(teamId)
    if (!config.url) {
      throw new Error('Gotenberg URL is not configured.')
    }

    const mdFilename = filename.toLowerCase().endsWith('.md') ? filename : 'file.md'

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>PDF</title>
  </head>
  <body>
    {{ toHTML "${mdFilename}" }}
  </body>
</html>`

    const fileBytes = fs.readFileSync(filePath)
    const formData = new FormData()
    formData.append('files', new Blob([htmlTemplate], { type: 'text/html' }), 'index.html')
    formData.append('files', new Blob([fileBytes]), mdFilename)

    const headers: Record<string, string> = {}
    const authHeader = this.getAuthHeader(config)
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${config.url}/forms/chromium/convert/markdown`, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `Gotenberg Markdown conversion failed with status ${response.status}: ${errorText || response.statusText}`,
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
}

export const gotenbergService = new GotenbergService()
