import React, {
  useEffect,
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react'
import type { AssetSummary } from './FileItem'
import { getFileTypeCategory } from './FileItem'
import { fetchVideoProxies, type ProxyOption } from '../services/import'
import { MoreVertical, Download, Film, File } from 'lucide-react'

export interface FileActionMenuHandle {
  openMenu: () => void
}

export interface FileActionMenuProps {
  asset: AssetSummary
  endpoint: string
  apiKey: string
  onImportRaw: (asset: AssetSummary) => void
  onImportProxy: (asset: AssetSummary, proxy: ProxyOption) => void
  className?: string
}

export const FileActionMenu = forwardRef<FileActionMenuHandle, FileActionMenuProps>(
  ({ asset, endpoint, apiKey, onImportRaw, onImportProxy, className }, ref) => {
    const isVideo = getFileTypeCategory(asset) === 'video'
    const [proxies, setProxies] = useState<ProxyOption[]>([])
    const [loadingProxies, setLoadingProxies] = useState(false)
    const proxiesLoadedRef = useRef(false)
    const proxiesRef = useRef<ProxyOption[]>([])
    proxiesRef.current = proxies

    const menuRef = useRef<HTMLElement & { open?: boolean; click?: () => void }>(null)
    const lastActionRef = useRef<{ id: string; time: number }>({ id: '', time: 0 })

    const triggerImportRaw = useCallback(() => {
      const now = Date.now()
      if (lastActionRef.current.id === 'raw' && now - lastActionRef.current.time < 500) return
      lastActionRef.current = { id: 'raw', time: now }
      onImportRaw(asset)
    }, [asset, onImportRaw])

    const triggerImportProxy = useCallback(
      (proxy: ProxyOption) => {
        const key = `proxy:${proxy.id}`
        const now = Date.now()
        if (lastActionRef.current.id === key && now - lastActionRef.current.time < 500) return
        lastActionRef.current = { id: key, time: now }
        onImportProxy(asset, proxy)
      },
      [asset, onImportProxy],
    )

    const loadProxies = useCallback(async () => {
      if (!isVideo || proxiesLoadedRef.current || loadingProxies) return
      setLoadingProxies(true)
      try {
        const items = await fetchVideoProxies(endpoint, apiKey, asset.id)
        setProxies(items)
        proxiesLoadedRef.current = true
      } catch (err) {
        console.warn('Failed to fetch video proxies:', err)
      } finally {
        setLoadingProxies(false)
      }
    }, [isVideo, endpoint, apiKey, asset.id, loadingProxies])

    useImperativeHandle(ref, () => ({
      openMenu: () => {
        if (menuRef.current) {
          if (isVideo) {
            void loadProxies()
          }
          menuRef.current.click?.()
        }
      },
    }))

    // Listen to change and sp-opened events from sp-action-menu
    useEffect(() => {
      const el = menuRef.current
      if (!el) return

      const handleChange = (e: Event) => {
        e.stopPropagation()
        const target = e.target as HTMLElement & { value?: string }
        const val = target?.value || (e as CustomEvent<{ value?: string }>).detail?.value
        if (!val) return

        if (val === 'raw') {
          triggerImportRaw()
        } else if (val.startsWith('proxy:')) {
          const proxyId = val.slice('proxy:'.length)
          const proxy = proxiesRef.current.find((p) => p.id === proxyId)
          if (proxy) {
            triggerImportProxy(proxy)
          }
        }
      }

      const handleOpened = () => {
        if (isVideo) {
          void loadProxies()
        }
      }

      el.addEventListener('change', handleChange)
      el.addEventListener('sp-opened', handleOpened)

      return () => {
        el.removeEventListener('change', handleChange)
        el.removeEventListener('sp-opened', handleOpened)
      }
    }, [isVideo, loadProxies, triggerImportRaw, triggerImportProxy])

    return (
      <sp-action-menu
        ref={menuRef}
        quiet
        size="xs"
        label="More actions"
        force-popover
        placement="bottom-end"
        className={className}
        onPointerEnter={() => {
          if (isVideo) {
            void loadProxies()
          }
        }}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation()
          if (isVideo) {
            void loadProxies()
          }
        }}
      >
        <MoreVertical size={13} slot="icon" />

        {!isVideo ? (
          <sp-menu-item value="raw" onClick={triggerImportRaw}>
            <Download size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Import
          </sp-menu-item>
        ) : (
          <sp-menu-item value="import-menu">
            <Download size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Import
            <sp-menu slot="submenu">
              <sp-menu-group>
                <span slot="header" className="shumai-menu-section-header">
                  Original
                </span>
                <sp-menu-item value="raw" onClick={triggerImportRaw}>
                  <File size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Original File
                </sp-menu-item>
              </sp-menu-group>

              <sp-menu-divider size="s"></sp-menu-divider>

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
                      value={`proxy:${proxy.id}`}
                      onClick={() => triggerImportProxy(proxy)}
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
          </sp-menu-item>
        )}
      </sp-action-menu>
    )
  },
)

FileActionMenu.displayName = 'FileActionMenu'
