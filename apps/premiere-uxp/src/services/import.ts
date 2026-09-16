import { getShumaiClient } from '../api/client'
import type { AssetSummary } from '../components/FileItem'
import {
  getActiveProject,
  importFilesIntoProject,
  promptSaveFile,
  writeBinaryFile,
} from './premiere'

export interface ProxyOption {
  id: string
  label: string
  resolution: string
  url: string
  key: string
  width?: number
  height?: number
  size?: number
}

export function formatResolutionLabel(width?: number, height?: number, res?: string): string {
  if (res) {
    const cleanRes = res.endsWith('p') ? res : `${res}p`
    return `${cleanRes} (MP4)`
  }
  if (height) return `${height}p (MP4)`
  if (width) {
    if (width >= 3840) return '2160p (MP4)'
    if (width >= 1920) return '1080p (MP4)'
    if (width >= 1280) return '720p (MP4)'
    if (width >= 960) return '540p (MP4)'
    if (width >= 640) return '360p (MP4)'
  }
  return 'Proxy (MP4)'
}

export function getResolutionRank(label: string): number {
  const match = label.match(/(\d+)p/) || label.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Resolves the presigned download URL for the original / raw file.
 */
export async function resolveRawDownloadUrl(
  endpoint: string,
  apiKey: string,
  assetId: string,
): Promise<{ url: string; name?: string }> {
  const client = getShumaiClient(endpoint, apiKey)
  const res = await client.api.files['download-links'].$post({
    json: { ids: [assetId] },
  })

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errData.error || `Failed to get download link (${res.status})`)
  }

  const data = await res.json()
  const file = data.files?.[0]
  if (!file?.url) {
    throw new Error('No download URL returned from server.')
  }

  return { url: file.url, name: file.name }
}

/**
 * Fetches available video proxy transcodes for an asset.
 */
export async function fetchVideoProxies(
  endpoint: string,
  apiKey: string,
  assetId: string,
): Promise<ProxyOption[]> {
  const client = getShumaiClient(endpoint, apiKey)
  const res = await client.api.files[':fileId'].$get({
    param: { fileId: assetId },
  })

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errData.error || `Failed to get asset details (${res.status})`)
  }

  const asset = await res.json()
  const transcodes = asset.media?.videoTranscodes || []
  if (!transcodes.length) return []

  const proxies: ProxyOption[] = []
  for (const t of transcodes) {
    let url = t.url
    if (!url && t.key) {
      // If transcode url wasn't presigned yet, request via download-url endpoint
      try {
        const urlRes = await client.api.files['download-url'].$post({
          json: { key: t.key, assetId },
        })
        if (urlRes.ok) {
          const urlData = await urlRes.json()
          url = urlData.url
        }
      } catch (err) {
        console.warn(`Failed to presign transcode key ${t.key}:`, err)
      }
    }

    if (url) {
      const label = formatResolutionLabel(t.width, t.height)
      proxies.push({
        id: t.id || t.key,
        label,
        resolution: `${t.height || 0}p`,
        url,
        key: t.key,
        width: t.width,
        height: t.height,
        size: t.size,
      })
    }
  }

  // Sort descending by resolution (1080p, 720p, 540p, 360p)
  proxies.sort((a, b) => getResolutionRank(b.label) - getResolutionRank(a.label))
  return proxies
}

export interface ImportAssetOptions {
  endpoint: string
  apiKey: string
  asset: AssetSummary
  type: 'raw' | 'proxy'
  proxyItem?: ProxyOption
  onProgress?: (message: string) => void
}

export interface ImportResult {
  success: boolean
  cancelled?: boolean
  message: string
}

/**
 * Orchestrates the full import workflow:
 * 1. Checks active Premiere Pro project
 * 2. Prompts user with native file save picker (Frame.io pattern)
 * 3. Downloads file from Shumai S3 presigned URL
 * 4. Saves binary to disk
 * 5. Calls Premiere project.importFiles
 */
export async function importAssetIntoPremiere({
  endpoint,
  apiKey,
  asset,
  type,
  proxyItem,
  onProgress,
}: ImportAssetOptions): Promise<ImportResult> {
  // 1. Verify active Premiere project
  const project = await getActiveProject()
  if (!project) {
    return {
      success: false,
      message: 'Please open or create a project in Premiere Pro first.',
    }
  }

  // 2. Determine default filename
  let defaultFileName: string
  if (type === 'raw') {
    defaultFileName = asset.name
  } else {
    const rawName = asset.name
    const dotIndex = rawName.lastIndexOf('.')
    const baseName = dotIndex !== -1 ? rawName.slice(0, dotIndex) : rawName
    const resTag = proxyItem ? proxyItem.label.split(' ')[0] : 'proxy'
    defaultFileName = `${baseName}_proxy_${resTag}.mp4`
  }

  // 3. Resolve download URL first to fail fast before creating empty file on disk
  onProgress?.(`Preparing download link for ${defaultFileName}...`)
  let downloadUrl: string
  if (type === 'raw') {
    const rawInfo = await resolveRawDownloadUrl(endpoint, apiKey, asset.id)
    downloadUrl = rawInfo.url
  } else {
    if (!proxyItem?.url) {
      throw new Error('Proxy URL not available.')
    }
    downloadUrl = proxyItem.url
  }

  // 4. Open native save picker
  const saveFile = await promptSaveFile(defaultFileName)
  if (!saveFile) {
    return {
      success: false,
      cancelled: true,
      message: 'Import cancelled by user.',
    }
  }

  // 5. Download binary data
  onProgress?.(`Downloading ${defaultFileName}...`)
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(`Failed to download file (HTTP ${response.status})`)
  }
  const arrayBuffer = await response.arrayBuffer()

  // 6. Write file to disk
  onProgress?.(`Saving ${defaultFileName} to disk...`)
  await writeBinaryFile(saveFile, arrayBuffer)

  // 7. Import into Premiere Pro
  onProgress?.(`Importing into Premiere Pro...`)
  const imported = await importFilesIntoProject(project, [saveFile.nativePath])
  if (!imported) {
    throw new Error(`Premiere Pro could not import "${defaultFileName}".`)
  }

  return {
    success: true,
    message: `Successfully imported ${defaultFileName} into Premiere Pro.`,
  }
}
