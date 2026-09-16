import React, { useEffect, useState, useRef } from 'react'
import type { AssetSummary } from './FileItem'
import { getFileTypeCategory } from './FileItem'
import { fetchVideoProxies, type ProxyOption } from '../services/import'
import { Download, Film, File } from 'lucide-react'

interface ContextMenuProps {
  asset: AssetSummary
  position: { x: number; y: number }
  endpoint: string
  apiKey: string
  onClose: () => void
  onImportRaw: (asset: AssetSummary) => void
  onImportProxy: (asset: AssetSummary, proxy: ProxyOption) => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  asset,
  position,
  endpoint,
  apiKey,
  onClose,
  onImportRaw,
  onImportProxy,
}) => {
  const isVideo = getFileTypeCategory(asset) === 'video'
  const [showSubmenu, setShowSubmenu] = useState(false)
  const [proxies, setProxies] = useState<ProxyOption[]>([])
  const [loadingProxies, setLoadingProxies] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch proxies if this is a video asset
  useEffect(() => {
    if (!isVideo) return
    let isMounted = true
    setLoadingProxies(true)

    fetchVideoProxies(endpoint, apiKey, asset.id)
      .then((items) => {
        if (isMounted) {
          setProxies(items)
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch video proxies:', err)
      })
      .finally(() => {
        if (isMounted) {
          setLoadingProxies(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isVideo, endpoint, apiKey, asset.id])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Calculate clamped coordinates for main menu
  const menuWidth = 160
  const menuHeight = isVideo ? 50 : 45
  const panelWidth = typeof window !== 'undefined' ? window.innerWidth : 320
  const panelHeight = typeof window !== 'undefined' ? window.innerHeight : 480

  const clampedX = Math.max(8, Math.min(position.x, panelWidth - menuWidth - 8))
  const clampedY = Math.max(8, Math.min(position.y, panelHeight - menuHeight - 8))

  // Determine submenu side
  const submenuWidth = 190
  const openSubmenuLeft = clampedX + menuWidth + submenuWidth > panelWidth

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="shumai-menu-backdrop"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
      />

      {/* Main Menu Popover */}
      <div
        ref={menuRef}
        className="shumai-menu-popover"
        style={{
          top: clampedY,
          left: clampedX,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <sp-menu>
          {!isVideo ? (
            <sp-menu-item
              onClick={() => {
                onImportRaw(asset)
                onClose()
              }}
            >
              <Download size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              Import
            </sp-menu-item>
          ) : (
            <div
              className="shumai-menu-item-wrapper"
              onMouseEnter={() => setShowSubmenu(true)}
              onClick={() => setShowSubmenu((prev) => !prev)}
            >
              <sp-menu-item selected={showSubmenu}>
                <Download size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                <span style={{ flex: 1 }}>Import</span>
                <sp-icon-chevron-right size="xs" slot="icon"></sp-icon-chevron-right>
              </sp-menu-item>

              {/* Submenu Popover */}
              {showSubmenu && (
                <div
                  className={`shumai-submenu-popover ${openSubmenuLeft ? 'left' : 'right'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <sp-menu>
                    {/* ORIGINAL SECTION */}
                    <sp-menu-group>
                      <span slot="header" className="shumai-menu-section-header">
                        Original
                      </span>
                      <sp-menu-item
                        onClick={() => {
                          onImportRaw(asset)
                          onClose()
                        }}
                      >
                        <File size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Original File
                      </sp-menu-item>
                    </sp-menu-group>

                    <sp-menu-divider size="s"></sp-menu-divider>

                    {/* PROXY SECTION */}
                    <sp-menu-group>
                      <span slot="header" className="shumai-menu-section-header">
                        Proxy
                      </span>
                      {loadingProxies ? (
                        <sp-menu-item disabled>Loading proxies...</sp-menu-item>
                      ) : proxies.length > 0 ? (
                        proxies.map((proxy) => (
                          <sp-menu-item
                            key={proxy.id}
                            onClick={() => {
                              onImportProxy(asset, proxy)
                              onClose()
                            }}
                          >
                            <Film size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            {proxy.label}
                          </sp-menu-item>
                        ))
                      ) : (
                        <sp-menu-item disabled>No proxy available</sp-menu-item>
                      )}
                    </sp-menu-group>
                  </sp-menu>
                </div>
              )}
            </div>
          )}
        </sp-menu>
      </div>
    </>
  )
}
