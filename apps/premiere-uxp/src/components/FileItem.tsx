import React, { useState } from 'react'
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
    original?: {
      key?: string
      filesizeInBytes?: number
      codec?: string
    } | null
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
  versionStack?: {
    id: string
    versions: Array<{
      version: number
      current: boolean
      id: string
      name?: string | null
      createdAt?: string | null
      previewUrl?: string | null
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
  onLinkSequence?: (asset: AssetSummary) => void
  onUnlinkSequence?: (asset: AssetSummary) => void
  isLinked?: boolean
  linkedSequenceName?: string
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

export function getAssetVersionLabel(asset: AssetSummary): string | null {
  if (asset.versionStack?.versions && asset.versionStack.versions.length > 0) {
    const matched = asset.versionStack.versions.find((v) => v.id === asset.id)
    if (matched?.version != null) {
      return `v${matched.version}`
    }
    const current = asset.versionStack.versions.find((v) => v.current)
    if (current?.version != null) {
      return `v${current.version}`
    }
    const first = asset.versionStack.versions[0]
    if (first?.version != null) {
      return `v${first.version}`
    }
    return `v${asset.versionStack.versions.length}`
  }
  return null
}

/** List View Row Item */
export const FileItem: React.FC<FileItemProps> = ({
  asset,
  endpoint = '',
  onClick,
  onImportRaw,
  onSelectVideoForImport,
  onLinkSequence,
  onUnlinkSequence,
  isLinked = false,
  linkedSequenceName,
}) => {
  const [imgError, setImgError] = useState(false)
  const category = getFileTypeCategory(asset)
  const isFolder = category === 'folder'
  const versionLabel = getAssetVersionLabel(asset)
  const effectiveSize = asset.sizeByte ?? asset.size
  const timeText = formatDateAgo(asset.createdAt || asset.updatedAt)
  const thumbUrl = resolveAssetUrl(asset.preview?.thumbnailUrl, endpoint)

  const iconFallback = (
    <div className={`item-icon ${category}`}>
      {category === 'folder' && (
        <sp-icon-folder size="s" style={{ color: '#fbbf24' }}></sp-icon-folder>
      )}
      {category === 'video' && (
        <sp-icon-filmstrip size="s" style={{ color: '#60a5fa' }}></sp-icon-filmstrip>
      )}
      {category === 'audio' && (
        <sp-icon-audio size="s" style={{ color: '#a78bfa' }}></sp-icon-audio>
      )}
      {category === 'image' && (
        <sp-icon-image size="s" style={{ color: '#f472b6' }}></sp-icon-image>
      )}
      {category === 'file' && (
        <sp-icon-document size="s" style={{ color: '#999999' }}></sp-icon-document>
      )}
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
            {versionLabel ? `${versionLabel} • ` : ''}
            {isFolder ? 'Folder' : formatBytes(effectiveSize)}
            {timeText ? ` • ${timeText}` : ''}
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {(onLinkSequence || onUnlinkSequence) &&
              (category === 'video' || category === 'audio') && (
                <sp-action-button
                  quiet
                  size="xs"
                  icon-only
                  label={
                    isLinked
                      ? onUnlinkSequence
                        ? `Unlink from ${linkedSequenceName || 'Sequence'}`
                        : `Linked to ${linkedSequenceName || 'Sequence'}`
                      : 'Link to Sequence'
                  }
                  title={
                    isLinked
                      ? onUnlinkSequence
                        ? `Unlink from ${linkedSequenceName || 'Sequence'}`
                        : `Linked to ${linkedSequenceName || 'Sequence'}`
                      : 'Link to Sequence'
                  }
                  className="item-row-link-btn"
                  style={{ marginRight: 4 }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    if (isLinked && onUnlinkSequence) {
                      onUnlinkSequence(asset)
                    } else if (onLinkSequence) {
                      onLinkSequence(asset)
                    }
                  }}
                >
                  {isLinked ? (
                    <sp-icon-unlink
                      size="s"
                      slot="icon"
                      style={{ color: '#f87171' }}
                    ></sp-icon-unlink>
                  ) : (
                    <sp-icon-link size="s" slot="icon"></sp-icon-link>
                  )}
                </sp-action-button>
              )}
            {(onImportRaw || onSelectVideoForImport) && (
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
                <sp-icon-download size="s" slot="icon"></sp-icon-download>
              </sp-action-button>
            )}
          </div>
        )}
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
  onLinkSequence,
  onUnlinkSequence,
  isLinked = false,
  linkedSequenceName,
}) => {
  const [imgError, setImgError] = useState(false)
  const category = getFileTypeCategory(asset)
  const isFolder = category === 'folder'
  const effectiveSize = asset.sizeByte ?? asset.size
  const timeText = formatDateAgo(asset.createdAt || asset.updatedAt)
  const thumbUrl = resolveAssetUrl(asset.preview?.thumbnailUrl, endpoint)
  const duration = asset.preview?.duration ?? asset.media?.metadata?.duration
  const durationText = formatDuration(duration)
  const creatorName = asset.creator?.name || asset.agent?.name

  const cardFallback = (
    <div className={`file-row-placeholder ${category}`}>
      {category === 'folder' && (
        <sp-icon-folder size="l" style={{ color: '#fbbf24' }}></sp-icon-folder>
      )}
      {category === 'video' && (
        <sp-icon-filmstrip size="l" style={{ color: '#60a5fa' }}></sp-icon-filmstrip>
      )}
      {category === 'audio' && (
        <sp-icon-audio size="l" style={{ color: '#a78bfa' }}></sp-icon-audio>
      )}
      {category === 'image' && (
        <sp-icon-image size="l" style={{ color: '#f472b6' }}></sp-icon-image>
      )}
      {category === 'file' && (
        <sp-icon-document size="l" style={{ color: '#999999' }}></sp-icon-document>
      )}
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
    }
  }

  // Assemble raw text details for Line 3 (Version • Duration • Size/Type • Comments)
  const details: string[] = []
  const versionLabel = getAssetVersionLabel(asset)
  if (versionLabel) {
    details.push(versionLabel)
  }
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
  if (isLinked) {
    details.push(`Linked: ${linkedSequenceName || 'Sequence'}`)
  }

  return (
    <div
      className={`file-row-card ${isFolder ? 'is-folder' : 'is-file'}`}
      onClick={isFolder ? handleCardClick : undefined}
      role={isFolder ? 'button' : undefined}
      tabIndex={isFolder ? 0 : undefined}
      title={isFolder ? asset.name : undefined}
      onKeyDown={
        isFolder
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleCardClick(e as unknown as React.MouseEvent)
              }
            }
          : undefined
      }
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
          <span className="file-row-title" title={isFolder ? asset.name : undefined}>
            {asset.name}
          </span>
        </div>

        {(creatorName || timeText) && (
          <div className="file-row-meta">
            {creatorName && <span className="file-row-creator">{creatorName}</span>}
            {creatorName && timeText && <span className="file-row-meta-dot">•</span>}
            {timeText && <span className="file-row-time">{timeText}</span>}
          </div>
        )}

        {details.length > 0 && (
          <div className="file-row-subtext file-row-details">
            {details.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="file-row-meta-dot">•</span>}
                <span
                  className={`file-row-detail-item${item === versionLabel ? ' file-row-version' : ''}`}
                >
                  {item}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Far Right Action Column (Centered Vertically across the card) */}
      <div className="file-row-actions" style={{ display: 'flex', alignItems: 'center' }}>
        {isFolder ? (
          <sp-icon-chevron-right size="xs" className="file-row-chevron"></sp-icon-chevron-right>
        ) : (
          <>
            {(onLinkSequence || onUnlinkSequence) &&
              (category === 'video' || category === 'audio') && (
                <sp-action-button
                  quiet
                  size="xs"
                  icon-only
                  label={
                    isLinked
                      ? onUnlinkSequence
                        ? `Unlink from ${linkedSequenceName || 'Sequence'}`
                        : `Linked to ${linkedSequenceName || 'Sequence'}`
                      : 'Link to Sequence'
                  }
                  title={
                    isLinked
                      ? onUnlinkSequence
                        ? `Unlink from ${linkedSequenceName || 'Sequence'}`
                        : `Linked to ${linkedSequenceName || 'Sequence'}`
                      : 'Link to Sequence'
                  }
                  className="file-row-link-btn"
                  style={{ marginRight: 4 }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    if (isLinked && onUnlinkSequence) {
                      onUnlinkSequence(asset)
                    } else if (onLinkSequence) {
                      onLinkSequence(asset)
                    }
                  }}
                >
                  {isLinked ? (
                    <sp-icon-unlink
                      size="s"
                      slot="icon"
                      style={{ color: '#f87171' }}
                    ></sp-icon-unlink>
                  ) : (
                    <sp-icon-link size="s" slot="icon"></sp-icon-link>
                  )}
                </sp-action-button>
              )}
            {(onImportRaw || onSelectVideoForImport) && (
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
                <sp-icon-download size="s" slot="icon"></sp-icon-download>
              </sp-action-button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
