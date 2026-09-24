import { client } from '@/ui/api/client'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { cn } from '@/ui/lib/utils'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import type { Annotation } from '@/ui/types'
import type { AssetInfo } from '@shumai/dtos'
import { Play, AudioLines } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import { useFramePlayer } from './use-frame-player'
import { resolveTotalFrames } from './utils'
import { clampFrame as clampFrameUtil } from '../../compare/compare-utils'
import type { ComparePaneHandle, DisplayTranscode, PaneReportedState } from '../../compare/types'

interface CompareVideoPaneProps {
  file: AssetInfo
  shareId?: string
  isActive: boolean
  /** Whether this pane's audio should be muted (only the active side plays audio). */
  muted?: boolean
  volume?: number
  annotations: Annotation[]
  onStateChange: (state: PaneReportedState) => void
  onActivate: () => void
  onRequestTogglePlay?: () => void
  /** Called with the current playhead time in seconds (used only for the active pane). */
  onTimeUpdate?: (second: number) => void
  onPlay?: () => void
}

function computeResolutions(file: AssetInfo): DisplayTranscode[] {
  // Only transcoded proxy versions are ever displayed; the raw original file
  // is never used as a playback source.
  return (file.media?.videoTranscodes ?? []).map((t) => {
    const longSide = Math.max(t.width, t.height)
    let resolution = `${t.height}p`
    if (longSide >= 3840) resolution = '2160p'
    else if (longSide >= 1920) resolution = '1080p'
    else if (longSide >= 1280) resolution = '720p'
    else if (longSide >= 960) resolution = '540p'
    else if (longSide >= 640) resolution = '360p'
    else if (longSide >= 320) resolution = '180p'
    return { ...t, resolution }
  })
}

function getInitialResolution(resolutions: DisplayTranscode[]): DisplayTranscode | null {
  if (resolutions.length === 0) return null
  if (typeof window === 'undefined') return resolutions[0]

  const prefersHdr =
    typeof window.matchMedia === 'function' && window.matchMedia('(dynamic-range: high)').matches
  const hasHdr = resolutions.some((r) => r.hdr)
  const hasSdr = resolutions.some((r) => !r.hdr)

  let candidates = resolutions
  if (prefersHdr && hasHdr) {
    candidates = resolutions.filter((r) => r.hdr)
  } else if (!prefersHdr && hasSdr) {
    candidates = resolutions.filter((r) => !r.hdr)
  }

  const screenWidth = window.innerWidth * (window.devicePixelRatio || 1)
  const sorted = [...candidates].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  const bestFit = sorted.find((r) => (r.width ?? 0) >= screenWidth)
  return bestFit || sorted[sorted.length - 1]
}

export const CompareVideoPane = forwardRef<ComparePaneHandle, CompareVideoPaneProps>(
  function CompareVideoPane(
    {
      file,
      shareId,
      isActive,
      muted = true,
      volume = 1,
      annotations,
      onStateChange,
      onActivate,
      onRequestTogglePlay,
      onTimeUpdate,
      onPlay,
    },
    ref,
  ) {
    const playerRef = useRef<Player | null>(null)
    const videoContainerRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)

    const {
      isDrawing,
      currentTool,
      currentColor,
      addAnnotation,
      annotations: draftAnnotations,
    } = useAnnotationStore()

    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
    const [zoom, setZoom] = useState(1)
    const [hasManuallyZoomed, setHasManuallyZoomed] = useState(false)
    const [pan, setPan] = useState<{ x: number; y: number } | null>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [hasStartedPlaying, setHasStartedPlaying] = useState(false)
    const [isLooping, setIsLooping] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [buffered, setBuffered] = useState(0)
    const [playerVolume, setPlayerVolume] = useState(volume)
    const [playerMuted, setPlayerMuted] = useState(muted)
    const [isPlayerReady, setIsPlayerReady] = useState(false)

    const metadata = file.media?.metadata
    const frameRate = metadata?.frameRate || 30
    const dbTotalFrames = metadata?.totalFrames || 0
    const containerDuration = metadata?.duration || 0
    const totalFrames = resolveTotalFrames({ dbTotalFrames, containerDuration, frameRate })

    const resolutions = computeResolutions(file)
    const initialRes = getInitialResolution(resolutions)
    const [currentResolution, setCurrentResolution] = useState(initialRes?.resolution ?? '')
    const [isCurrentHdr, setIsCurrentHdr] = useState(initialRes?.hdr)
    const currentSrcRef = useRef(initialRes?.url)

    const isAudio = file.proxyType === 'audio'
    const { currentFrame, seekToFrame } = useFramePlayer(videoRef, frameRate, totalFrames, isAudio)

    const zoomRef = useRef(zoom)
    zoomRef.current = zoom
    const currentFrameRef = useRef(currentFrame)
    currentFrameRef.current = currentFrame

    // Resize observer
    useEffect(() => {
      if (!containerRef.current) return
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) {
          setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
        }
      })
      observer.observe(containerRef.current)
      return () => observer.disconnect()
    }, [])

    const vidW = metadata?.originalWidth || 1920
    const vidH = metadata?.originalHeight || 1080

    // Auto-fit zoom
    useEffect(() => {
      if (containerSize.width > 0 && containerSize.height > 0 && !hasManuallyZoomed) {
        const scale = Math.min(containerSize.width / vidW, containerSize.height / vidH)
        setZoom(scale)
      }
    }, [containerSize.width, containerSize.height, vidW, vidH, hasManuallyZoomed])

    // Keep the resolution selection and source url in sync when the displayed
    // asset changes, so the player (re)initializes with the correct source even
    // if the parent renders this pane without a per-asset `key`. Runs before the
    // video.js init effect below (declaration order) so the ref is fresh.
    useEffect(() => {
      const res = getInitialResolution(resolutions)
      setCurrentResolution(res?.resolution ?? '')
      setIsCurrentHdr(res?.hdr)
      currentSrcRef.current = res?.url
      setHasStartedPlaying(false)
    }, [file.id])

    // Initialize video.js
    useEffect(() => {
      if (!videoContainerRef.current) return
      const videoElement = document.createElement('video-js')
      videoElement.classList.add('vjs-big-play-centered', '!h-full', '!w-full')
      videoElement.style.pointerEvents = 'none'
      videoContainerRef.current.appendChild(videoElement)

      const player = (playerRef.current = videojs(videoElement, {
        controls: false,
        autoplay: false,
        preload: 'auto',
        playsinline: true,
        sources: [{ src: currentSrcRef.current ?? '', type: 'video/mp4' }],
      }))

      const htmlVid = videoElement.querySelector('video')
      if (htmlVid) {
        videoRef.current = htmlVid
      } else {
        player.ready(() => {
          const techEl = player.tech({ iWillNotUseThisInPlugins: true })?.el() as HTMLVideoElement
          if (techEl) {
            videoRef.current = techEl
          }
        })
      }

      player.on('play', () => {
        setIsPlaying(true)
        setHasStartedPlaying(true)
        onPlay?.()
      })
      player.on('pause', () => setIsPlaying(false))
      player.on('ended', () => setIsPlaying(false))

      player.on('timeupdate', () => {
        setBuffered(player.bufferedPercent())
      })

      player.on('loadedmetadata', () => {
        setIsPlayerReady(true)
      })
      player.on('loadstart', () => setIsPlayerReady(false))
      player.on('volumechange', () => {
        setPlayerVolume(player.volume() || 0)
        setPlayerMuted(player.muted() || false)
      })
      player.on('ratechange', () => setPlaybackRate(player.playbackRate() || 1))

      return () => {
        if (player && !player.isDisposed()) {
          player.dispose()
          playerRef.current = null
          videoRef.current = null
        }
      }
    }, [file.id])

    // Apply muted / volume (audio routing: only active side unmuted)
    useEffect(() => {
      const player = playerRef.current
      if (!player || !isPlayerReady) return
      player.muted(muted)
      player.volume(volume)
    }, [muted, volume, isPlayerReady])

    // Report state upward
    useEffect(() => {
      const state: PaneReportedState = {
        kind: 'video',
        zoom,
        video: {
          frameRate,
          totalFrames,
          currentFrame,
          isPlaying,
          volume: playerVolume,
          isMuted: playerMuted,
          playbackRate,
          isLooping,
          currentResolution,
          isCurrentHdr,
          resolutions,
          buffered,
        },
      }
      onStateChange(state)
    }, [
      zoom,
      frameRate,
      totalFrames,
      currentFrame,
      isPlaying,
      playerVolume,
      playerMuted,
      playbackRate,
      isLooping,
      currentResolution,
      isCurrentHdr,
      buffered,
    ])

    // Propagate active playhead time
    useEffect(() => {
      if (isActive) onTimeUpdate?.(currentFrame / frameRate)
    }, [currentFrame, frameRate, isActive, onTimeUpdate])

    const applyZoom = useCallback((factor: number) => {
      const cur = zoomRef.current
      const newZoom = cur * factor
      if (newZoom < 0.01 || newZoom > 50) return
      setZoom(newZoom)
      setHasManuallyZoomed(true)
    }, [])

    const fit = useCallback(() => {
      setHasManuallyZoomed(false)
      setPan(null)
    }, [])

    const clampFrame = useCallback(
      (frame: number) => clampFrameUtil(frame, totalFrames),
      [totalFrames],
    )

    const handleDownload = useCallback(
      async (key?: string) => {
        const dlKey = key ?? file.media?.original?.key
        if (!dlKey || !file.id) return
        try {
          const res = shareId
            ? await client.api.shares[':shareId'].files[':fileId']['download-url'].$post({
                param: { shareId, fileId: file.id },
                json: { key: dlKey },
              })
            : await client.api.files['download-url'].$post({
                json: { key: dlKey, assetId: file.id },
              })
          if (!res.ok) return
          const { url } = await res.json()
          const link = document.createElement('a')
          link.href = url
          link.download = ''
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        } catch {
          // silently fail
        }
      },
      [file.id, file.media?.original?.key, shareId],
    )

    const changeResolution = useCallback(
      (resolution: string, hdr?: boolean) => {
        const player = playerRef.current
        if (!player) return
        const target =
          hdr !== undefined
            ? resolutions.find(
                (r) => r.resolution === resolution && Boolean(r.hdr) === Boolean(hdr),
              )
            : resolutions.find((r) => r.resolution === resolution)
        if (!target) return
        const wasPlaying = !player.paused()
        const currentT = player.currentTime()
        setCurrentResolution(resolution)
        setIsCurrentHdr(target.hdr)
        currentSrcRef.current = target.url
        player.src({ type: 'video/mp4', src: target.url })
        player.one('loadedmetadata', () => {
          player.currentTime(currentT)
          if (wasPlaying) {
            const p = player.play()
            if (p !== undefined) p.catch(() => {})
          }
        })
      },
      [resolutions],
    )

    useImperativeHandle(
      ref,
      (): ComparePaneHandle => ({
        getKind: () => 'video',
        play: () => {
          const p = playerRef.current?.play()
          if (p !== undefined) p.catch(() => {})
        },
        pause: () => playerRef.current?.pause(),
        togglePlay: () => {
          const player = playerRef.current
          if (!player) return
          if (player.paused() || player.ended()) {
            const p = player.play()
            if (p !== undefined) p.catch(() => {})
          } else {
            player.pause()
          }
        },
        seekToFrame: (frame) => {
          setHasStartedPlaying(true)
          return seekToFrame(clampFrame(frame))
        },
        seekToSecond: (second) => {
          setHasStartedPlaying(true)
          const frame = Math.floor(second * frameRate + 0.45)
          seekToFrame(clampFrame(frame))
        },
        stepFrame: (delta) => {
          setHasStartedPlaying(true)
          return seekToFrame(clampFrame(currentFrameRef.current + delta))
        },
        setMuted: (m) => playerRef.current?.muted(m),
        setVolume: (v) => {
          const player = playerRef.current
          if (!player) return
          player.volume(v)
          if (v > 0 && player.muted()) player.muted(false)
          else if (v === 0 && !player.muted()) player.muted(true)
        },
        setPlaybackRate: (rate) => playerRef.current?.playbackRate(rate),
        toggleLoop: () => {
          const player = playerRef.current
          if (!player) return
          const next = !player.loop()
          player.loop(next)
          setIsLooping(next)
        },
        changeResolution,
        zoomBy: applyZoom,
        fit,
        panBy: (dx, dy) =>
          setPan((p) => {
            const scale = zoomRef.current
            const base = p ?? {
              x: (containerSize.width - vidW * scale) / 2,
              y: (containerSize.height - vidH * scale) / 2,
            }
            return { x: base.x + dx, y: base.y + dy }
          }),
        download: (key?: string) => handleDownload(key),
      }),
      [
        seekToFrame,
        clampFrame,
        frameRate,
        applyZoom,
        fit,
        changeResolution,
        handleDownload,
        containerSize.width,
        containerSize.height,
        vidW,
        vidH,
      ],
    )

    const displayAnnotations = [...annotations, ...(isActive ? draftAnnotations : [])]

    const scale = zoom
    const defaultPanX = (containerSize.width - vidW * scale) / 2
    const defaultPanY = (containerSize.height - vidH * scale) / 2
    const panX = pan?.x ?? defaultPanX
    const panY = pan?.y ?? defaultPanY

    const handleAreaClick = useCallback(() => {
      if (useAnnotationStore.getState().isDrawing) return
      // Clicking an inactive pane only activates it; playback is untouched.
      if (!isActive) {
        onActivate?.()
        return
      }
      onRequestTogglePlay?.()
    }, [isActive, onActivate, onRequestTogglePlay])

    if (!file.media?.metadata || resolutions.length === 0) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-black">
          <p className="text-muted-foreground">Media is not available.</p>
        </div>
      )
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative flex flex-1 cursor-pointer items-center justify-center overflow-hidden bg-black',
        )}
        onClick={handleAreaClick}
        data-testid="compare-video-area"
      >
        {/* Native Video Layer (Hardware-accelerated, full HDR EDR) */}
        {!isAudio && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: vidW,
              height: vidH,
              transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <div
              ref={videoContainerRef}
              className="w-full h-full [&_.video-js]:!w-full [&_.video-js]:!h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!block [&_video]:!object-contain"
            />
          </div>
        )}
        {isAudio && (
          <div ref={videoContainerRef} className="absolute inset-0 pointer-events-none opacity-0" />
        )}

        {isAudio ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground w-full h-full pointer-events-none select-none">
            <AudioLines
              className={cn(
                'w-16 h-16 text-foreground/75 transition-transform duration-500',
                isPlaying ? 'animate-pulse scale-110 text-primary' : '',
              )}
            />
          </div>
        ) : (
          containerSize.width > 0 && (
            <DrawingCanvas
              width={containerSize.width}
              height={containerSize.height}
              mediaDimensions={{ width: vidW, height: vidH }}
              annotations={displayAnnotations}
              scale={scale}
              offset={{ x: panX, y: panY }}
              className="absolute inset-0"
              onClick={handleAreaClick}
              isDrawing={isActive && isDrawing}
              currentTool={currentTool}
              currentColor={currentColor}
              onAddAnnotation={isActive ? addAnnotation : undefined}
            />
          )
        )}

        {!hasStartedPlaying && !isDrawing && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-opacity duration-200">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm">
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            </div>
          </div>
        )}
      </div>
    )
  },
)
