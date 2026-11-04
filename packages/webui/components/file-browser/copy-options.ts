import type { AssetInfo } from '@shumai/dtos'
import { formatSize } from '@/ui/lib/format'

export type CopyKind =
  'image' | 'name' | 'link' | 'download-link' | 'id' | 'markdown' | 'tsv' | 'storage-path'

export interface CopyOption {
  kind: CopyKind
  disabled: boolean
  hint?: string
}

export interface CopyOptionsContext {
  isPublicShare?: boolean
  isTeamOwner?: boolean
  allowDownload?: boolean
}

export interface CopyFormatContext {
  origin: string
  projectId?: string
}

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'svg',
  'bmp',
  'tiff',
  'avif',
  'heic',
])

export function isImageItem(item: AssetInfo): boolean {
  if (item.type === 'folder' || item.type === 'root' || item.type === 'share_root') return false
  if (item.proxyType === 'image') return true
  const ext = item.name?.split('.').pop()?.toLowerCase()
  return IMAGE_EXTENSIONS.has(ext || '')
}

export function isArchivedStatus(status?: string | null): boolean {
  return status === 'archived' || status === 'archiving' || status === 'restoring'
}

export interface TranscodeCandidate {
  url?: string
  key?: string
  width?: number
  height?: number
}

export function pickClipboardTranscode(
  transcodes?: TranscodeCandidate[],
): TranscodeCandidate | null {
  if (!transcodes || transcodes.length === 0) return null
  const valid = transcodes.filter((t) => !!t.url || !!t.key)
  if (valid.length === 0) return null

  // Prefer largest transcode <= 2048px on long edge
  const suitable = valid.filter((t) => {
    const maxDim = Math.max(t.width || 0, t.height || 0)
    return maxDim <= 2048
  })

  if (suitable.length > 0) {
    suitable.sort((a, b) => {
      const dimA = Math.max(a.width || 0, a.height || 0)
      const dimB = Math.max(b.width || 0, b.height || 0)
      return dimB - dimA
    })
    return suitable[0]
  }

  // Fallback to smallest available if all > 2048px
  valid.sort((a, b) => {
    const dimA = Math.max(a.width || 0, a.height || 0)
    const dimB = Math.max(b.width || 0, b.height || 0)
    return dimA - dimB
  })
  return valid[0]
}

export function getItemInAppUrl(item: AssetInfo, origin: string, projectId?: string): string {
  const base = origin.replace(/\/$/, '')
  if (item.type === 'folder') {
    return projectId
      ? `${base}/projects/${projectId}/folders/${item.id}`
      : `${base}/folders/${item.id}`
  }
  const targetId = item.versionStack ? item.versionStack.id : item.id
  return projectId ? `${base}/projects/${projectId}/files/${targetId}` : `${base}/files/${targetId}`
}

export function getCopyOptions(items: AssetInfo[], context: CopyOptionsContext = {}): CopyOption[] {
  if (items.length === 0) return []

  const { isPublicShare = false, isTeamOwner = false, allowDownload = true } = context

  const options: CopyOption[] = []

  if (items.length === 1) {
    const item = items[0]
    const isImage = isImageItem(item)

    if (isImage) {
      const isArchived = isArchivedStatus(item.status)
      const transcode = pickClipboardTranscode(item.media?.imageTranscodes)
      const hasTranscode =
        !!transcode || item.status === 'processed' || !!item.preview?.thumbnailUrl
      const disabled = isArchived || !hasTranscode || (isPublicShare && !allowDownload)
      options.push({ kind: 'image', disabled })
    }

    options.push({ kind: 'name', disabled: false })
    options.push({ kind: 'link', disabled: false })

    if (item.type !== 'folder') {
      const isArchived = isArchivedStatus(item.status)
      const disabled = isArchived || (isPublicShare && !allowDownload)
      options.push({ kind: 'download-link', disabled })
    }

    if (!isPublicShare) {
      options.push({ kind: 'id', disabled: false })
    }

    options.push({ kind: 'markdown', disabled: false })

    if (isTeamOwner && !isPublicShare && item.type !== 'folder') {
      options.push({ kind: 'storage-path', disabled: false })
    }

    return options
  }

  // Multi-selection
  options.push({ kind: 'name', disabled: false })
  options.push({ kind: 'link', disabled: false })

  const files = items.filter((i) => i.type !== 'folder')
  if (files.length > 0) {
    const allArchived = files.every((f) => isArchivedStatus(f.status))
    const disabled = allArchived || (isPublicShare && !allowDownload)
    options.push({ kind: 'download-link', disabled })
  }

  if (!isPublicShare) {
    options.push({ kind: 'id', disabled: false })
  }

  options.push({ kind: 'markdown', disabled: false })
  options.push({ kind: 'tsv', disabled: false })

  if (isTeamOwner && !isPublicShare && files.length > 0) {
    options.push({ kind: 'storage-path', disabled: false })
  }

  return options
}

export function formatCopyText(
  kind: CopyKind,
  items: AssetInfo[],
  context: CopyFormatContext,
): string {
  if (items.length === 0) return ''

  switch (kind) {
    case 'name':
      return items.map((i) => i.name).join('\n')

    case 'link':
      return items.map((i) => getItemInAppUrl(i, context.origin, context.projectId)).join('\n')

    case 'id':
      return items.map((i) => (i.versionStack ? i.versionStack.id : i.id)).join('\n')

    case 'markdown':
      if (items.length === 1) {
        const item = items[0]
        const safeName = item.name.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
        const url = getItemInAppUrl(item, context.origin, context.projectId)
        return `[${safeName}](${url})`
      }
      return items
        .map((i) => {
          const safeName = i.name.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
          const url = getItemInAppUrl(i, context.origin, context.projectId)
          return `- [${safeName}](${url})`
        })
        .join('\n')

    case 'tsv': {
      const header = 'Name\tType\tSize\tLink\tID'
      const rows = items.map((i) => {
        const type = i.type === 'folder' ? 'folder' : 'file'
        const size = i.type === 'folder' ? '—' : formatSize(i.sizeByte || 0)
        const link = getItemInAppUrl(i, context.origin, context.projectId)
        const id = i.versionStack ? i.versionStack.id : i.id
        const safeName = i.name.replace(/[\t\r\n]+/g, ' ')
        return `${safeName}\t${type}\t${size}\t${link}\t${id}`
      })
      return [header, ...rows].join('\n')
    }

    default:
      return ''
  }
}
