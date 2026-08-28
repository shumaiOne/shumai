import { client } from '@/ui/api/client'
import type { Annotation } from '@/ui/types'
import type { AssetInfo } from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getViewerForFile } from '@/ui/components/viewers/registry'
import { CompareControlBar } from './compare-control-bar'
import { ComparePaneTopbar } from './compare-pane-topbar'
import type { ComparePaneHandle, CompareSide, PaneReportedState } from './types'

interface VersionItem {
  id: string
  version: number
  name?: string | null
  previewUrl?: string | null
  creator?: { id: string; name: string | null } | null
}

interface CompareViewerProps {
  isPublic?: boolean
  shareId?: string
  versions: VersionItem[]
  leftId: string
  rightId: string
  activeSide: CompareSide
  annotations: Annotation[]
  /** Bumped nonce requests the active pane seek to `second` (comment navigation). */
  seekRequest?: { second: number; nonce: number }
  onActiveSideChange: (side: CompareSide) => void
  onSwitchVersion: (side: CompareSide, versionId: string) => void
  onExit: () => void
  onActiveAssetChange: (asset: AssetInfo | null) => void
  onPlay?: () => void
  onTimeUpdate?: (second: number) => void
  /** When false, hides the download affordance. Defaults to true. */
  allowDownload?: boolean
}

function useCompareAsset(id: string, isPublic: boolean, shareId?: string) {
  return useQuery({
    queryKey: isPublic
      ? ['public-share-file', shareId, id, localStorage.getItem(`share_pwd_${shareId}`) || '']
      : ['files', id],
    queryFn: async () => {
      if (isPublic) {
        const password = localStorage.getItem(`share_pwd_${shareId}`) || ''
        const res = await client.api.shares[':shareId'].files[':fileId'].$get(
          { param: { shareId: shareId!, fileId: id } },
          { headers: { 'x-share-password': password } },
        )
        if (!res.ok) throw new Error('Failed to fetch version asset')
        return (await res.json()) as unknown as AssetInfo
      }
      const res = await client.api.files[':fileId'].$get({ param: { fileId: id } })
      if (!res.ok) throw new Error('Failed to fetch version asset')
      return (await res.json()) as unknown as AssetInfo
    },
    enabled: !!id && (!isPublic || !!shareId),
  })
}

export function CompareViewer({
  isPublic = false,
  shareId,
  versions,
  leftId,
  rightId,
  activeSide,
  annotations,
  seekRequest,
  onActiveSideChange,
  onSwitchVersion,
  onExit,
  onActiveAssetChange,
  onPlay,
  onTimeUpdate,
  allowDownload = true,
}: CompareViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<ComparePaneHandle | null>(null)
  const rightRef = useRef<ComparePaneHandle | null>(null)

  const [leftState, setLeftState] = useState<PaneReportedState | null>(null)
  const [rightState, setRightState] = useState<PaneReportedState | null>(null)
  const [userVolume, setUserVolume] = useState(1)
  const [userMuted, setUserMuted] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)

  const { data: leftAsset, isLoading: leftLoading } = useCompareAsset(leftId, isPublic, shareId)
  const { data: rightAsset, isLoading: rightLoading } = useCompareAsset(rightId, isPublic, shareId)

  const leftDef = getViewerForFile(leftAsset)
  const rightDef = getViewerForFile(rightAsset)
  const sameType = !!leftAsset && !!rightAsset && leftDef.id === rightDef.id

  const activeAsset = activeSide === 'left' ? leftAsset : rightAsset
  const activeState = activeSide === 'left' ? leftState : rightState

  const getActive = useCallback(
    () => (activeSide === 'left' ? leftRef.current : rightRef.current),
    [activeSide],
  )
  const getOther = useCallback(
    () => (activeSide === 'left' ? rightRef.current : leftRef.current),
    [activeSide],
  )

  // Bind right sidebar to active asset
  useEffect(() => {
    onActiveAssetChange(activeAsset ?? null)
  }, [activeAsset, onActiveAssetChange])

  // Comment-driven seek on the active pane
  useEffect(() => {
    if (!seekRequest) return
    const active = getActive()
    active?.seekToSecond(seekRequest.second)
    active?.pause()
    if (sameType) {
      const other = getOther()
      other?.seekToSecond(seekRequest.second)
      other?.pause()
    }
  }, [seekRequest?.nonce])

  // Fullscreen tracking
  useEffect(() => {
    const onFs = () => setIsFullScreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const handleStateChangeLeft = useCallback((s: PaneReportedState) => setLeftState(s), [])
  const handleStateChangeRight = useCallback((s: PaneReportedState) => setRightState(s), [])

  const applyBoth = useCallback(
    (fn: (h: ComparePaneHandle) => void) => {
      const active = getActive()
      if (active) fn(active)
      if (sameType) {
        const other = getOther()
        if (other) fn(other)
      }
    },
    [getActive, getOther, sameType],
  )

  // --- Control handlers ---
  const handleTogglePlay = useCallback(() => {
    const shouldPlay = !activeState?.video?.isPlaying
    applyBoth((h) => (shouldPlay ? h.play() : h.pause()))
  }, [activeState?.video?.isPlaying, applyBoth])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl instanceof HTMLElement && activeEl.isContentEditable))
      ) {
        return
      }

      const isSpace = e.key === ' '
      const isInteractive =
        activeEl &&
        (activeEl.tagName === 'BUTTON' ||
          activeEl.tagName === 'A' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'OPTION' ||
          activeEl.getAttribute('role') === 'button' ||
          activeEl.getAttribute('role') === 'link' ||
          activeEl.getAttribute('role') === 'checkbox' ||
          activeEl.getAttribute('role') === 'radio' ||
          activeEl.getAttribute('role') === 'menuitem')

      if (isSpace && isInteractive) {
        return
      }

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handleTogglePlay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleTogglePlay])

  const handleSeek = useCallback(
    (frame: number) => applyBoth((h) => h.seekToFrame(frame)),
    [applyBoth],
  )

  const handleToggleLoop = useCallback(() => getActive()?.toggleLoop(), [getActive])

  const handleVolumeChange = useCallback((v: number) => {
    setUserVolume(v)
    setUserMuted(v === 0)
  }, [])

  const handleToggleMute = useCallback(() => setUserMuted((m) => !m), [])

  const handlePlaybackRate = useCallback(
    (rate: number) => applyBoth((h) => h.setPlaybackRate(rate)),
    [applyBoth],
  )

  const handleChangeResolution = useCallback(
    (resolution: string) => getActive()?.changeResolution(resolution),
    [getActive],
  )

  const handleZoomIn = useCallback(() => applyBoth((h) => h.zoomBy(1.2)), [applyBoth])
  const handleZoomOut = useCallback(() => applyBoth((h) => h.zoomBy(0.8)), [applyBoth])
  const handleFit = useCallback(() => applyBoth((h) => h.fit()), [applyBoth])
  const handleDownload = useCallback(
    (key?: string) => {
      getActive()?.download(key)
    },
    [getActive],
  )

  const handleToggleFullScreen = useCallback(() => {
    const el = rootRef.current
    if (!el || typeof el.requestFullscreen !== 'function') return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const handleUserPanLeft = useCallback(
    (dx: number, dy: number) => {
      if (sameType) rightRef.current?.panBy(dx, dy)
    },
    [sameType],
  )
  const handleUserPanRight = useCallback(
    (dx: number, dy: number) => {
      if (sameType) leftRef.current?.panBy(dx, dy)
    },
    [sameType],
  )

  const handleRequestTogglePlay = useCallback(() => handleTogglePlay(), [handleTogglePlay])

  const versionOf = useCallback(
    (id: string) => versions.find((v) => v.id === id)?.version,
    [versions],
  )

  const activePreviewUrl = useMemo(
    () => activeAsset?.media?.videoPreview?.url,
    [activeAsset?.media?.videoPreview?.url],
  )

  const renderPane = (side: CompareSide, asset: AssetInfo) => {
    const def = getViewerForFile(asset)
    const ComparePane = def?.comparePane

    if (!ComparePane) {
      return (
        <div className="flex flex-1 items-center justify-center bg-gray-100 dark:bg-gray-950">
          <p className="text-muted-foreground">Preview unavailable</p>
        </div>
      )
    }

    const isActive = activeSide === side
    const paneRef = side === 'left' ? leftRef : rightRef
    const onStateChange = side === 'left' ? handleStateChangeLeft : handleStateChangeRight
    const onUserPan = side === 'left' ? handleUserPanLeft : handleUserPanRight
    const paneAnnotations = isActive ? annotations : []

    return (
      <ComparePane
        key={asset.id}
        ref={paneRef}
        file={asset}
        shareId={shareId}
        isActive={isActive}
        annotations={paneAnnotations}
        onStateChange={onStateChange}
        onUserPan={onUserPan}
        onActivate={() => onActiveSideChange(side)}
        muted={isActive ? userMuted : true}
        volume={userVolume}
        onPlay={onPlay}
        onTimeUpdate={onTimeUpdate}
        onRequestTogglePlay={handleRequestTogglePlay}
      />
    )
  }

  const bothLoaded = !!leftAsset && !!rightAsset
  const isLoading = leftLoading || rightLoading

  return (
    <div ref={rootRef} className="flex h-full flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        {/* Left pane */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-zinc-800">
          {leftAsset && (
            <ComparePaneTopbar
              side="left"
              fileName={leftAsset.name}
              version={versionOf(leftId)}
              activeVersionId={leftId}
              versions={versions}
              isActive={activeSide === 'left'}
              onActivate={() => onActiveSideChange('left')}
              onSwitchVersion={(vid) => onSwitchVersion('left', vid)}
              onExit={onExit}
            />
          )}
          <div className="relative flex min-h-0 flex-1">
            {leftAsset ? (
              renderPane('left', leftAsset)
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Right pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {rightAsset && (
            <ComparePaneTopbar
              side="right"
              fileName={rightAsset.name}
              version={versionOf(rightId)}
              activeVersionId={rightId}
              versions={versions}
              isActive={activeSide === 'right'}
              onActivate={() => onActiveSideChange('right')}
              onSwitchVersion={(vid) => onSwitchVersion('right', vid)}
              onExit={onExit}
            />
          )}
          <div className="relative flex min-h-0 flex-1">
            {rightAsset ? (
              renderPane('right', rightAsset)
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading && !bothLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/30">
          <Loader2 className="h-8 w-8 animate-spin text-foreground" />
        </div>
      )}

      <CompareControlBar
        activeState={activeState}
        activeAsset={activeAsset ?? null}
        previewUrl={activePreviewUrl}
        isFullScreen={isFullScreen}
        onTogglePlay={handleTogglePlay}
        onToggleLoop={handleToggleLoop}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onChangePlaybackRate={handlePlaybackRate}
        onChangeResolution={handleChangeResolution}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onDownload={handleDownload}
        onToggleFullScreen={handleToggleFullScreen}
        allowDownload={allowDownload}
      />
    </div>
  )
}
