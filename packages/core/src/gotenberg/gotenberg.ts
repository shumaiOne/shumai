import * as fs from 'fs'

export interface GotenbergConvertOptions {
  landscape?: boolean
}

export class GotenbergService {
  private getUrl(): string | undefined {
    const url = process.env.GOTENBERG_URL?.trim()
    return url ? url.replace(/\/+$/, '') : undefined
  }

  private getAuthHeader(): string | undefined {
    const username = process.env.GOTENBERG_BASIC_AUTH_USERNAME
    const password = process.env.GOTENBERG_BASIC_AUTH_PASSWORD

    if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64')
      return `Basic ${credentials}`
    }
    return undefined
  }

  async isAvailable(): Promise<boolean> {
    const baseUrl = this.getUrl()
    if (!baseUrl) {
      return false
    }

    try {
      const headers: Record<string, string> = {}
      const authHeader = this.getAuthHeader()
      if (authHeader) {
        headers['Authorization'] = authHeader
      }

      const response = await fetch(`${baseUrl}/health`, {
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
  ): Promise<Buffer> {
    const baseUrl = this.getUrl()
    if (!baseUrl) {
      throw new Error('Gotenberg URL is not configured.')
    }

    const fileBytes = fs.readFileSync(filePath)
    const formData = new FormData()
    formData.append('files', new Blob([fileBytes]), filename)

    if (options.landscape) {
      formData.append('landscape', 'true')
    }

    const headers: Record<string, string> = {}
    const authHeader = this.getAuthHeader()
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${baseUrl}/forms/libreoffice/convert`, {
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

  async convertHtmlToPdf(filePath: string, filename: string): Promise<Buffer> {
    const baseUrl = this.getUrl()
    if (!baseUrl) {
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
    const authHeader = this.getAuthHeader()
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${baseUrl}/forms/chromium/convert/html`, {
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

  async convertMarkdownToPdf(filePath: string, filename: string): Promise<Buffer> {
    const baseUrl = this.getUrl()
    if (!baseUrl) {
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
    const authHeader = this.getAuthHeader()
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${baseUrl}/forms/chromium/convert/markdown`, {
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
