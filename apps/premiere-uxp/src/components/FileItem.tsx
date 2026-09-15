import React, { useState } from 'react'
import { Folder, Film, Music, Image, FileText, ChevronRight, MessageSquare } from 'lucide-react'
import { Badge } from '@swc-react/badge'
import { formatDateAgo } from '../utils/date'
import { resolveAssetUrl } from '../utils/url'

export interface AssetSummary {
  id: string
  name: string
  type: string
  size?: number | null
  sizeByte?: number | null
  mimeType?: string | null
  updatedAt?: string | Date
  commentsCount?: number
  preview?: {
    thumbnailUrl?: string
  } | null
}

interface FileItemProps {
  asset: AssetSummary
  endpoint?: string
  onClick: () => void
}

export function formatBytes(bytes?: number | null): string {
  if (bytes == null || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function getFileTypeCategory(
  asset: AssetSummary,
): 'folder' | 'video' | 'audio' | 'image' | 'file' {
  if (asset.type === 'folder') return 'folder'
  const name = asset.name.toLowerCase()
  const mime = asset.mimeType?.toLowerCase() || ''

  if (mime.startsWith('video/') || /\.(mp4|mov|avi|mkv|m4v|webm)$/.test(name)) {
    return 'video'
  }
  if (mime.startsWith('audio/') || /\.(mp3|wav|aac|flac|m4a|ogg)$/.test(name)) {
    return 'audio'
  }
  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/.test(name)) {
    return 'image'
  }
  return 'file'
}

/** List View Row Item */
export const FileItem: React.FC<FileItemProps> = ({ asset, endpoint, onClick }) => {
  const [imgError, setImgError] = useState(false)
  const category = getFileTypeCategory(asset)
  const isFolder = category === 'folder'
  const effectiveSize = asset.sizeByte ?? asset.size
  const updatedText = formatDateAgo(asset.updatedAt)
  const thumbUrl = resolveAssetUrl(asset.preview?.thumbnailUrl, endpoint)

  const iconFallback = (
    <div className={`item-icon ${category}`}>
      {category === 'folder' && <Folder size={16} fill="currentColor" fillOpacity={0.2} />}
      {category === 'video' && <Film size={16} />}
      {category === 'audio' && <Music size={16} />}
      {category === 'image' && <Image size={16} />}
      {category === 'file' && <FileText size={16} />}
    </div>
  )

  return (
    <div
      className="item-row"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="item-left">
        {thumbUrl && !isFolder && !imgError ? (
          <div className="item-thumb-wrapper">
            <img
              src={thumbUrl}
              alt={asset.name}
              className="item-thumb-img"
              onLoad={() => console.log('[UXP Image OK]', thumbUrl)}
              onError={() => {
                console.error('[UXP Image Failed]', thumbUrl)
                setImgError(true)
              }}
            />
          </div>
        ) : (
          iconFallback
        )}

        <div className="item-meta">
          <span className="item-name" title={asset.name}>
            {asset.name}
          </span>
          <span className="item-subtext">
            {isFolder ? 'Folder' : formatBytes(effectiveSize)}
            {updatedText ? ` • ${updatedText}` : ''}
          </span>
        </div>
      </div>

      <div className="item-right">
        {asset.commentsCount != null && asset.commentsCount > 0 && (
          <Badge variant="informative" size="s" title={`${asset.commentsCount} comments`}>
            <MessageSquare size={10} slot="icon" />
            {asset.commentsCount}
          </Badge>
        )}
        {isFolder && <ChevronRight size={14} />}
      </div>
    </div>
  )
}

/** Card View Row Item (2 Columns: Left Preview, Right Info) */
export const FileCardItem: React.FC<FileItemProps> = ({ asset, endpoint, onClick }) => {
  const [imgError, setImgError] = useState(false)
  const category = getFileTypeCategory(asset)
  const isFolder = category === 'folder'
  const effectiveSize = asset.sizeByte ?? asset.size
  const updatedText = formatDateAgo(asset.updatedAt)
  const thumbUrl = resolveAssetUrl(asset.preview?.thumbnailUrl, endpoint)

  const cardFallback = (
    <div className={`file-row-placeholder ${category}`}>
      {category === 'folder' && <Folder size={28} fill="currentColor" fillOpacity={0.2} />}
      {category === 'video' && <Film size={28} />}
      {category === 'audio' && <Music size={28} />}
      {category === 'image' && <Image size={28} />}
      {category === 'file' && <FileText size={28} />}
    </div>
  )

  return (
    <div
      className="file-row-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={asset.name}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="file-row-preview">
        {thumbUrl && !isFolder && !imgError ? (
          <img
            src={thumbUrl}
            alt={asset.name}
            className="file-row-img"
            onError={() => setImgError(true)}
          />
        ) : (
          cardFallback
        )}

        {asset.commentsCount != null && asset.commentsCount > 0 && (
          <div style={{ position: 'absolute', top: '4px', right: '4px' }}>
            <Badge variant="informative" size="s" title={`${asset.commentsCount} comments`}>
              <MessageSquare size={9} slot="icon" />
              {asset.commentsCount}
            </Badge>
          </div>
        )}
      </div>

      <div className="file-row-content">
        <div className="file-row-header">
          <span className="file-row-title">{asset.name}</span>
          {isFolder && <ChevronRight size={14} className="file-row-chevron" />}
        </div>
        <div className="file-row-subtext">
          <span>{isFolder ? 'Folder' : formatBytes(effectiveSize)}</span>
          {updatedText && <span>• {updatedText}</span>}
        </div>
      </div>
    </div>
  )
}
