import React, { useState } from 'react'
import { Folder, Film, Music, Image, FileText, Download } from 'lucide-react'
import { formatDateAgo } from '../utils/date'
import { formatBytes, formatDuration } from '../utils/format'
import { resolveAssetUrl } from '../utils/url'

export { formatBytes, formatDuration }

export interface AssetSummary {
  id: string
  name: string
  type: string
  size?: number | null
  sizeByte?: number | null
  mimeType?: string | null
  updatedAt?: string | Date
  createdAt?: string | Date
  commentsCount?: number
  fileCount?: number
  creator?: {
    id: string
    name: string
    image?: string | null
  } | null
  agent?: {
    id: string
    name: string
  } | null
  preview?: {
    thumbnailUrl?: string
    duration?: number
    pageCount?: number
    proxyType?: string | null
  } | null
  media?: {
    metadata?: {
      duration?: number
    }
    videoTranscodes?: Array<{
      id: string
      url: string
      key: string
      width: number
      height: number
      size: number
    }>
  } | null
}

export interface FileItemProps {
  asset: AssetSummary
  endpoint?: string
  apiKey?: string
  onClick: (e: React.MouseEvent) => void
  onImportRaw?: (asset: AssetSummary) => void
  onSelectVideoForImport?: (asset: AssetSummary) => void
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
export const FileItem: React.FC<FileItemProps> = ({
  asset,
  endpoint = '',
  onClick,
  onImportRaw,
  onSelectVideoForImport,
}) => {
  const [imgError, setImgError] = useState(false)
  const category = getFileTypeCategory(asset)
  const isFolder = category === 'folder'
  const effectiveSize = asset.sizeByte ?? asset.size
  const updatedText = formatDateAgo(asset.updatedAt)
  const thumbUrl = resolveAssetUrl(asset.preview?.thumbnailUrl, endpoint)

  const iconFallback = (
    <div className={`item-icon ${category}`}>
      {category === 'folder' && (
        <Folder size={16} color="#fbbf24" fill="#fbbf24" fillOpacity={0.2} />
      )}
      {category === 'video' && <Film size={16} color="#60a5fa" />}
      {category === 'audio' && <Music size={16} color="#a78bfa" />}
      {category === 'image' && <Image size={16} color="#f472b6" />}
      {category === 'file' && <FileText size={16} color="#999999" />}
    </div>
  )

  const handleImportAction = () => {
    if (isFolder) return
    if (category === 'video' && onSelectVideoForImport) {
      onSelectVideoForImport(asset)
    } else if (onImportRaw) {
      onImportRaw(asset)
    }
  }

  const handleRowClick = (e: React.MouseEvent) => {
    if (isFolder) {
      onClick(e)
    } else {
      e.stopPropagation()
      handleImportAction()
    }
  }

  return (
    <div
      className="item-row"
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleRowClick(e as unknown as React.MouseEvent)
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
          <span className="item-comments-count" title={`${asset.commentsCount} comments`}>
            {asset.commentsCount} {asset.commentsCount === 1 ? 'comment' : 'comments'}
          </span>
        )}
        {isFolder ? (
          <sp-icon-chevron-right size="xs"></sp-icon-chevron-right>
        ) : onImportRaw || onSelectVideoForImport ? (
          <sp-action-button
            quiet
            size="xs"
            icon-only
            label="Import into Premiere Pro"
            title="Import into Premiere Pro"
            className="item-row-import-btn"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              handleImportAction()
            }}
          >
            <Download size={13} slot="icon" />
          </sp-action-button>
        ) : null}
      </div>
    </div>
  )
}

/** Card View Row Item (2 Columns: Left Preview, Right Info as Raw Text) */
export const FileCardItem: React.FC<FileItemProps> = ({
  asset,
  endpoint = '',
  onClick,
  onImportRaw,
  onSelectVideoForImport,
}) => {
  const [imgError, setImgError] = useState(false)
  const category = getFileTypeCategory(asset)
  const isFolder = category === 'folder'
  const effectiveSize = asset.sizeByte ?? asset.size
  const updatedText = formatDateAgo(asset.updatedAt)
  const thumbUrl = resolveAssetUrl(asset.preview?.thumbnailUrl, endpoint)
  const duration = asset.preview?.duration ?? asset.media?.metadata?.duration
  const durationText = formatDuration(duration)
  const creatorName = asset.creator?.name || asset.agent?.name

  const cardFallback = (
    <div className={`file-row-placeholder ${category}`}>
      {category === 'folder' && (
        <Folder size={28} color="#fbbf24" fill="#fbbf24" fillOpacity={0.2} />
      )}
      {category === 'video' && <Film size={28} color="#60a5fa" />}
      {category === 'audio' && <Music size={28} color="#a78bfa" />}
      {category === 'image' && <Image size={28} color="#f472b6" />}
      {category === 'file' && <FileText size={28} color="#999999" />}
    </div>
  )

  const handleImportAction = () => {
    if (isFolder) return
    if (category === 'video' && onSelectVideoForImport) {
      onSelectVideoForImport(asset)
    } else if (onImportRaw) {
      onImportRaw(asset)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (isFolder) {
      onClick(e)
    } else {
      e.stopPropagation()
      handleImportAction()
    }
  }

  // Assemble raw text details for Line 3 (Duration • Size/Type • Comments)
  const details: string[] = []
  if (durationText) {
    details.push(durationText)
  }
  if (isFolder) {
    details.push(asset.fileCount != null ? `${asset.fileCount} items` : 'Folder')
  } else if (effectiveSize != null) {
    details.push(formatBytes(effectiveSize))
  }
  if (asset.commentsCount != null && asset.commentsCount > 0) {
    details.push(`${asset.commentsCount} ${asset.commentsCount === 1 ? 'comment' : 'comments'}`)
  }

  return (
    <div
      className="file-row-card"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      title={asset.name}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick(e as unknown as React.MouseEvent)
        }
      }}
    >
      {/* Left Column: Preview Only (NO LABELS, NO BADGES) */}
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
      </div>

      {/* Right Column: Title, Creator & Date, Duration / Size / Comments as Raw Text */}
      <div className="file-row-content">
        <div className="file-row-header">
          <span className="file-row-title" title={asset.name}>
            {asset.name}
          </span>
        </div>

        {(creatorName || updatedText) && (
          <div className="file-row-meta">
            {creatorName && (
              <span className="file-row-creator" title={`Created by ${creatorName}`}>
                {creatorName}
              </span>
            )}
            {creatorName && updatedText && <span className="file-row-meta-dot">•</span>}
            {updatedText && (
              <span className="file-row-time" title={updatedText}>
                {updatedText}
              </span>
            )}
          </div>
        )}

        {details.length > 0 && (
          <div className="file-row-subtext file-row-details">
            {details.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="file-row-meta-dot">•</span>}
                <span className="file-row-detail-item">{item}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Far Right Action Column (Centered Vertically across the card) */}
      <div className="file-row-actions">
        {isFolder ? (
          <sp-icon-chevron-right size="xs" className="file-row-chevron"></sp-icon-chevron-right>
        ) : onImportRaw || onSelectVideoForImport ? (
          <sp-action-button
            quiet
            size="xs"
            icon-only
            label="Import into Premiere Pro"
            title="Import into Premiere Pro"
            className="file-row-import-btn"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              handleImportAction()
            }}
          >
            <Download size={13} slot="icon" />
          </sp-action-button>
        ) : null}
      </div>
    </div>
  )
}
