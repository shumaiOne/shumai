import React, { useState, useEffect, useCallback } from 'react'
import type { AssetSummary } from './FileItem'
import { fetchVideoProxies, type ProxyOption } from '../services/import'
import { formatBytes, formatDuration } from '../utils/format'
import { resolveAssetUrl } from '../utils/url'
import { ProgressCircle } from '@swc-react/progress-circle'

export interface ImportVideoDialogProps {
  asset: AssetSummary | null
  endpoint: string
  apiKey: string
  isOpen: boolean
  onClose: () => void
  onImportRaw: (asset: AssetSummary) => void
  onImportProxy: (asset: AssetSummary, proxy: ProxyOption) => void
}

export const ImportVideoDialog: React.FC<ImportVideoDialogProps> = ({
  asset,
  endpoint,
  apiKey,
  isOpen,
  onClose,
  onImportRaw,
  onImportProxy,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<'raw' | string>('raw')
  const [proxies, setProxies] = useState<ProxyOption[]>([])
  const [loadingProxies, setLoadingProxies] = useState(false)
  const [thumbError, setThumbError] = useState(false)

  // Reset and fetch proxies when a new video asset is opened
  useEffect(() => {
    if (!isOpen || !asset) {
      setProxies([])
      setSelectedVersion('raw')
      setLoadingProxies(false)
      setThumbError(false)
      return
    }

    let isMounted = true
    setLoadingProxies(true)
    setSelectedVersion('raw')

    void fetchVideoProxies(endpoint, apiKey, asset.id)
      .then((items) => {
        if (isMounted) {
          setProxies(items)
        }
      })
      .catch((err) => {
        console.warn('Failed to load video proxies:', err)
      })
      .finally(() => {
        if (isMounted) {
          setLoadingProxies(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, asset, endpoint, apiKey])

  // Handle Escape key to close dialog
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleConfirm = useCallback(() => {
    if (!asset) return

    if (selectedVersion === 'raw') {
      onClose()
      onImportRaw(asset)
    } else if (selectedVersion.startsWith('proxy:')) {
      const proxyId = selectedVersion.slice('proxy:'.length)
      const targetProxy = proxies.find((p) => p.id === proxyId)
      if (targetProxy) {
        onClose()
        onImportProxy(asset, targetProxy)
      }
    }
  }, [asset, selectedVersion, proxies, onClose, onImportRaw, onImportProxy])

  if (!isOpen || !asset) return null

  const effectiveSize = asset.sizeByte ?? asset.size
  const thumbUrl = resolveAssetUrl(asset.preview?.thumbnailUrl, endpoint)
  const duration = asset.preview?.duration ?? asset.media?.metadata?.duration
  const durationText = formatDuration(duration)

  return (
    <div
      className="shumai-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="shumai-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        {/* Dialog Header */}
        <div className="shumai-dialog-header">
          <span id="dialog-title" className="shumai-dialog-title">
            Import Video
          </span>
          <button
            type="button"
            className="shumai-dialog-close"
            onClick={onClose}
            title="Close dialog"
            aria-label="Close dialog"
          >
            <sp-icon-close size="s"></sp-icon-close>
          </button>
        </div>

        {/* Video Asset Preview Info */}
        <div className="shumai-dialog-asset-info">
          <div className="shumai-dialog-thumb">
            {thumbUrl && !thumbError ? (
              <img src={thumbUrl} alt={asset.name} onError={() => setThumbError(true)} />
            ) : (
              <sp-icon-filmstrip size="xxl" style={{ color: '#60a5fa' }}></sp-icon-filmstrip>
            )}
          </div>
          <div className="shumai-dialog-asset-meta">
            <span className="shumai-dialog-asset-name" title={asset.name}>
              {asset.name}
            </span>
            <span className="shumai-dialog-asset-details">
              {durationText ? `${durationText} • ` : ''}
              {effectiveSize ? formatBytes(effectiveSize) : 'Video'}
            </span>
          </div>
        </div>

        {/* Options Selection Body */}
        <div className="shumai-dialog-body">
          <div className="shumai-dialog-section-label">Choose Version to Import</div>

          {/* Original Version Card */}
          <div
            className={`shumai-option-card ${selectedVersion === 'raw' ? 'selected' : ''}`}
            onClick={() => setSelectedVersion('raw')}
            role="radio"
            aria-checked={selectedVersion === 'raw'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSelectedVersion('raw')
              }
            }}
          >
            <div className="shumai-option-left">
              <div className="shumai-option-texts">
                <span className="shumai-option-title">Original File</span>
                <span className="shumai-option-meta">
                  Full resolution • {effectiveSize ? formatBytes(effectiveSize) : 'Raw file'}
                </span>
              </div>
            </div>
            <div className="shumai-option-radio">
              {selectedVersion === 'raw' && <div className="shumai-option-radio-dot" />}
            </div>
          </div>

          <div className="shumai-dialog-divider" />

          {/* Proxies Section */}
          <div className="shumai-dialog-section-label">Transcode Proxies</div>

          {loadingProxies ? (
            <div className="shumai-dialog-loading">
              <ProgressCircle indeterminate size="s" label="Checking available proxies..." />
              <span>Checking available proxies...</span>
            </div>
          ) : proxies.length > 0 ? (
            proxies.map((proxy) => {
              const isSelected = selectedVersion === `proxy:${proxy.id}`
              return (
                <div
                  key={proxy.id}
                  className={`shumai-option-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedVersion(`proxy:${proxy.id}`)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedVersion(`proxy:${proxy.id}`)
                    }
                  }}
                >
                  <div className="shumai-option-left">
                    <div className="shumai-option-texts">
                      <span className="shumai-option-title">{proxy.label}</span>
                      <span className="shumai-option-meta">
                        {proxy.width && proxy.height ? `${proxy.width}x${proxy.height} • ` : ''}
                        {proxy.size ? `${formatBytes(proxy.size)} • ` : ''}
                        Fast editing proxy
                      </span>
                    </div>
                  </div>
                  <div className="shumai-option-radio">
                    {isSelected && <div className="shumai-option-radio-dot" />}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="shumai-dialog-empty-proxies">
              <span>No proxy transcodes available for this video.</span>
            </div>
          )}
        </div>

        {/* Dialog Footer Actions */}
        <div className="shumai-dialog-footer">
          <sp-button quiet variant="secondary" size="s" onClick={onClose}>
            Cancel
          </sp-button>
          <sp-button variant="accent" size="s" onClick={handleConfirm}>
            Import
          </sp-button>
        </div>
      </div>
    </div>
  )
}
