import { getShumaiClient } from '../api/client'
import type { AssetSummary } from '../components/FileItem'
import {
  getActiveProject,
  importFilesIntoProject,
  promptSelectFolder,
  writeBinaryFile,
} from './premiere'
import { resolveAssetUrl } from '../utils/url'

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
  knownAsset?: AssetSummary,
): Promise<{ url: string; name?: string }> {
  const client = getShumaiClient(endpoint, apiKey)

  // 1. If original key is known directly from asset summary, presign via download-url endpoint
  const directKey = knownAsset?.media?.original?.key
  if (directKey) {
    try {
      const res = await client.api.files['download-url']?.$post({
        json: { key: directKey, assetId },
      })
      if (res?.ok) {
        const data = await res.json()
        if (data.url) {
          return { url: data.url, name: knownAsset?.name }
        }
      }
    } catch (err) {
      console.warn('Failed to resolve download URL via known key:', err)
    }
  }

  // 2. Fetch full asset details via GET /api/files/:fileId to get the original media key
  try {
    const detailRes = await client.api.files[':fileId']?.$get({
      param: { fileId: assetId },
    })
    if (detailRes?.ok) {
      const assetData = await detailRes.json()
      const originalKey = assetData.media?.original?.key
      if (originalKey) {
        const urlRes = await client.api.files['download-url']?.$post({
          json: { key: originalKey, assetId },
        })
        if (urlRes?.ok) {
          const urlData = await urlRes.json()
          if (urlData.url) {
            return { url: urlData.url, name: assetData.name || knownAsset?.name }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to fetch asset details for download URL:', err)
  }

  // 3. Fallback to POST /api/files/download-links batch resolution
  const res = await client.api.files['download-links']?.$post({
    json: { ids: [assetId] },
  })

  if (res?.ok) {
    const data = await res.json()
    const file = data.files?.[0]
    if (file?.url) {
      return { url: file.url, name: file.name || knownAsset?.name }
    }
  } else if (res) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errData.error || `Failed to get download link (${res.status})`)
  }

  throw new Error('No download URL returned from server.')
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

/**
 * Resolves a unique filename within the specified existing file names in a folder.
 * If requestedName exists, it appends _1, _2, etc. before the file extension.
 * Comparison is case-insensitive to safely handle Windows and macOS filesystems.
 */
export function getUniqueFileName(existingNames: string[], requestedName: string): string {
  const existingSet = new Set(existingNames.map((n) => n.toLowerCase()))
  if (!existingSet.has(requestedName.toLowerCase())) {
    return requestedName
  }

  const dotIndex = requestedName.lastIndexOf('.')
  const base = dotIndex > 0 ? requestedName.slice(0, dotIndex) : requestedName
  const ext = dotIndex > 0 ? requestedName.slice(dotIndex) : ''

  let counter = 1
  while (true) {
    const candidate = `${base}_${counter}${ext}`
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate
    }
    counter++
  }
}

/**
 * Reads existing file/folder names inside a UXP FolderEntry safely.
 */
export async function getFolderEntryNames(folder: UxpFolderEntry): Promise<string[]> {
  try {
    if (typeof folder.getEntries === 'function') {
      const entries = await folder.getEntries()
      return entries.map((e) => e.name)
    }
    const folderRecord = folder as unknown as Record<string, unknown>
    if (typeof folderRecord.getFiles === 'function') {
      const files = await (folderRecord.getFiles as () => Promise<Array<{ name: string }>>)()
      return files.map((f) => f.name)
    }
  } catch (err) {
    console.warn('Failed to read folder entries:', err)
  }
  return []
}

/**
 * Creates a unique file entry in the target folder, preventing overwrites by auto-incrementing suffixes (_1, _2).
 */
export async function createUniqueFileInFolder(
  folder: UxpFolderEntry,
  requestedName: string,
): Promise<{ file: UxpFileEntry; name: string }> {
  const existingNames = await getFolderEntryNames(folder)
  const candidateName = getUniqueFileName(existingNames, requestedName)

  try {
    const file = await folder.createFile(candidateName, { overwrite: false })
    return { file, name: candidateName }
  } catch (err) {
    console.warn(`Could not create file "${candidateName}" with overwrite: false, retrying...`, err)
    const dotIndex = requestedName.lastIndexOf('.')
    const base = dotIndex > 0 ? requestedName.slice(0, dotIndex) : requestedName
    const ext = dotIndex > 0 ? requestedName.slice(dotIndex) : ''

    for (let counter = 1; counter <= 50; counter++) {
      const retryName = `${base}_${counter}${ext}`
      try {
        const file = await folder.createFile(retryName, { overwrite: false })
        return { file, name: retryName }
      } catch {
        continue
      }
    }
    const fallbackFile = await folder.createFile(candidateName, { overwrite: true })
    return { file: fallbackFile, name: candidateName }
  }
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
  fileName?: string
}

/**
 * Orchestrates the full import workflow:
 * 1. Checks active Premiere Pro project
 * 2. Prompts user with native folder picker (Frame.io pattern)
 * 3. Resolves download URL from Shumai S3 presigned URL
 * 4. Resolves unique filename in folder with auto-increment (_1, _2) on collision
 * 5. Downloads binary data and writes to disk
 * 6. Calls Premiere project.importFiles
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

  // 2. Open native folder picker (Frame.io pattern)
  const targetFolder = await promptSelectFolder()
  if (!targetFolder) {
    return {
      success: false,
      cancelled: true,
      message: 'Import cancelled by user.',
    }
  }

  // 3. Determine default filename & download URL
  onProgress?.('Preparing download link...')
  let downloadUrl: string
  let defaultFileName: string
  if (type === 'raw') {
    const rawInfo = await resolveRawDownloadUrl(endpoint, apiKey, asset.id, asset)
    downloadUrl = rawInfo.url
    defaultFileName = rawInfo.name || asset.name
  } else {
    if (!proxyItem?.url) {
      throw new Error('Proxy URL not available.')
    }
    downloadUrl = proxyItem.url
    const rawName = asset.name
    const dotIndex = rawName.lastIndexOf('.')
    const baseName = dotIndex !== -1 ? rawName.slice(0, dotIndex) : rawName
    const resTag = proxyItem ? proxyItem.label.split(' ')[0] : 'proxy'
    defaultFileName = `${baseName}_proxy_${resTag}.mp4`
  }

  const resolvedDownloadUrl = resolveAssetUrl(downloadUrl, endpoint) || downloadUrl

  // 4. Create unique file in destination folder with collision avoidance (_1, _2)
  const { file: saveFile, name: finalFileName } = await createUniqueFileInFolder(
    targetFolder,
    defaultFileName,
  )

  // 5. Download binary data
  onProgress?.(`Downloading ${finalFileName}...`)
  const response = await fetch(resolvedDownloadUrl)
  if (!response.ok) {
    throw new Error(`Failed to download file (HTTP ${response.status})`)
  }
  const arrayBuffer = await response.arrayBuffer()

  // 6. Write file to disk
  onProgress?.(`Saving ${finalFileName} to disk...`)
  await writeBinaryFile(saveFile, arrayBuffer)

  // 7. Import into Premiere Pro
  onProgress?.('Importing into Premiere Pro...')
  const imported = await importFilesIntoProject(project, [saveFile.nativePath])
  if (!imported) {
    throw new Error(`Premiere Pro could not import "${finalFileName}".`)
  }

  return {
    success: true,
    fileName: finalFileName,
    message: `Successfully imported ${finalFileName} into Premiere Pro.`,
  }
}
