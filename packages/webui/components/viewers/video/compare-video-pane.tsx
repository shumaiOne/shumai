import { client } from '@/ui/api/client'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { cn } from '@/ui/lib/utils'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import type { Annotation } from '@/ui/types'
import type { AssetInfo } from '@shumai/dtos'
import { Play, AudioLines, Loader2 } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Hls from 'hls.js'
import { useFramePlayer } from './use-frame-player'
import { calculateFrameCenterTime, resolveTotalFrames } from './utils'
import { clampFrame as clampFrameUtil } from '../../compare/compare-utils'
import type { ComparePaneHandle, DisplayTranscode, PaneReportedState } from '../../compare/types'
import { getVideoResolutionLabel } from '@/ui/lib/media'

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
  const isHls = Boolean(file.media?.isHls && file.media.hls?.url)
  const baseTranscodes = isHls
    ? (file.media?.hls?.resolutions ?? [])
    : (file.media?.videoTranscodes ?? [])

  return baseTranscodes.map((t) => ({
    ...t,
    resolution: getVideoResolutionLabel(t),
  }))
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
    const hlsRef = useRef<Hls | null>(null)
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
    const [isLoading, setIsLoading] = useState(true)
    const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const metadata = file.media?.metadata
    const frameRate = metadata?.frameRate || 30
    const dbTotalFrames = metadata?.totalFrames || 0
    const containerDuration = metadata?.duration || 0
    const totalFrames = resolveTotalFrames({ dbTotalFrames, containerDuration, frameRate })

    const isHls = Boolean(file.media?.isHls && file.media.hls?.url)
    const resolutions = computeResolutions(file)
    const initialRes = isHls ? null : getInitialResolution(resolutions)
    const [currentResolution, setCurrentResolution] = useState(
      isHls ? 'Auto' : (initialRes?.resolution ?? ''),
    )
    const [isCurrentHdr, setIsCurrentHdr] = useState(initialRes?.hdr)
    const [activeAutoResolution, setActiveAutoResolution] = useState<string | undefined>(undefined)
    const pendingResolutionCorrectionRef = useRef<(() => void) | null>(null)
    const isHlsManualSupported = !isHls || Boolean(Hls.isSupported())
    const currentSrcRef = useRef(isHls ? file.media!.hls!.url : initialRes?.url)

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
      const res = isHls ? null : getInitialResolution(resolutions)
      setCurrentResolution(isHls ? 'Auto' : (res?.resolution ?? ''))
      setIsCurrentHdr(res?.hdr)
      setActiveAutoResolution(undefined)
      currentSrcRef.current = isHls ? file.media!.hls!.url : res?.url
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current)
        waitingTimeoutRef.current = null
      }
      setIsLoading(true)
      setIsPlayerReady(false)
      setHasStartedPlaying(false)
    }, [file.id, Boolean(isHls ? file.media?.hls?.url : initialRes?.url)])

    // Initialize player (Hls.js or native HTML5 video)
    useEffect(() => {
      const video = videoRef.current
      if (!video) return

      const targetSrc = isHls ? file.media!.hls!.url! : (currentSrcRef.current ?? '')
      if (!targetSrc) return

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current)
        waitingTimeoutRef.current = null
      }
      setIsPlayerReady(false)
      setIsLoading(true)

      let hls: Hls | null = null

      if (isHls) {
        if (Hls.isSupported()) {
          hls = new Hls({
            autoStartLoad: true,
            startLevel: -1,
            capLevelToPlayerSize: false,
            enableWorker: true,
          })
          hlsRef.current = hls
          hls.attachMedia(video)
          hls.loadSource(targetSrc)

          hls.on(Hls.Events.LEVEL_SWITCHED, (_event, eventData) => {
            const level = hls?.levels[eventData.level]
            if (level) {
              const matched = resolutions.find(
                (r) => r.width === level.width && r.height === level.height,
              )
              if (matched?.resolution) {
                setActiveAutoResolution(matched.resolution)
              } else {
                const shortSide =
                  level.width && level.height
                    ? Math.min(level.width, level.height)
                    : level.height || level.width
                setActiveAutoResolution(shortSide ? `${shortSide}p` : undefined)
              }
            }
          })

          hls.on(Hls.Events.ERROR, (_event, eventData) => {
            if (eventData.fatal) {
              switch (eventData.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls?.startLoad()
                  break
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls?.recoverMediaError()
                  break
                default:
                  hls?.destroy()
                  break
              }
            }
          })
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = targetSrc
        }
      } else {
        video.src = targetSrc
      }

      const clearWaitingTimeout = () => {
        if (waitingTimeoutRef.current) {
          clearTimeout(waitingTimeoutRef.current)
          waitingTimeoutRef.current = null
        }
      }

      const handlePlay = () => {
        clearWaitingTimeout()
        setIsLoading(false)
        setIsPlayerReady(true)
        if (pendingResolutionCorrectionRef.current) {
          pendingResolutionCorrectionRef.current()
          pendingResolutionCorrectionRef.current = null
        }
        setIsPlaying(true)
        setHasStartedPlaying(true)
        onPlay?.()
      }
      const handlePause = () => setIsPlaying(false)
      const handleEnded = () => {
        clearWaitingTimeout()
        setIsLoading(false)
        setIsPlaying(false)
      }
      const handleLoadedData = () => {
        clearWaitingTimeout()
        setIsLoading(false)
        setIsPlayerReady(true)
      }
      const handleCanPlay = () => {
        clearWaitingTimeout()
        setIsLoading(false)
        setIsPlayerReady(true)
      }
      const handlePlaying = () => {
        clearWaitingTimeout()
        setIsLoading(false)
      }
      const handleWaiting = () => {
        clearWaitingTimeout()
        waitingTimeoutRef.current = setTimeout(() => {
          setIsLoading(true)
        }, 200)
      }
      const handleLoadStart = () => {
        clearWaitingTimeout()
        setIsLoading(true)
        setIsPlayerReady(false)
      }
      const handleProgress = () => {
        const vidDuration = video.duration || containerDuration || 0
        if (vidDuration > 0 && video.buffered.length > 0) {
          let bufferedEnd = 0
          for (let i = 0; i < video.buffered.length; i++) {
            if (
              video.buffered.start(i) <= video.currentTime &&
              video.currentTime <= video.buffered.end(i)
            ) {
              bufferedEnd = video.buffered.end(i)
              break
            }
          }
          if (bufferedEnd === 0) {
            bufferedEnd = video.buffered.end(video.buffered.length - 1)
          }
          setBuffered((bufferedEnd / vidDuration) * 100)
        }
      }
      const handleVolumeChange = () => {
        setPlayerVolume(video.volume || 0)
        setPlayerMuted(video.muted || false)
      }
      const handleRateChange = () => setPlaybackRate(video.playbackRate || 1)

      if (video.readyState >= 2) {
        setIsLoading(false)
        setIsPlayerReady(true)
      }

      video.addEventListener('play', handlePlay)
      video.addEventListener('pause', handlePause)
      video.addEventListener('ended', handleEnded)
      video.addEventListener('loadeddata', handleLoadedData)
      video.addEventListener('canplay', handleCanPlay)
      video.addEventListener('playing', handlePlaying)
      video.addEventListener('waiting', handleWaiting)
      video.addEventListener('loadstart', handleLoadStart)
      video.addEventListener('timeupdate', handleProgress)
      video.addEventListener('progress', handleProgress)
      video.addEventListener('volumechange', handleVolumeChange)
      video.addEventListener('ratechange', handleRateChange)

      return () => {
        clearWaitingTimeout()
        video.removeEventListener('play', handlePlay)
        video.removeEventListener('pause', handlePause)
        video.removeEventListener('ended', handleEnded)
        video.removeEventListener('loadeddata', handleLoadedData)
        video.removeEventListener('canplay', handleCanPlay)
        video.removeEventListener('playing', handlePlaying)
        video.removeEventListener('waiting', handleWaiting)
        video.removeEventListener('loadstart', handleLoadStart)
        video.removeEventListener('timeupdate', handleProgress)
        video.removeEventListener('progress', handleProgress)
        video.removeEventListener('volumechange', handleVolumeChange)
        video.removeEventListener('ratechange', handleRateChange)

        if (pendingResolutionCorrectionRef.current) {
          pendingResolutionCorrectionRef.current()
          pendingResolutionCorrectionRef.current = null
        }

        if (hlsRef.current) {
          hlsRef.current.destroy()
          hlsRef.current = null
        }
      }
    }, [file.id])

    // Apply muted / volume (audio routing: only active side unmuted)
    useEffect(() => {
      const video = videoRef.current
      if (!video || !isPlayerReady) return
      video.muted = muted
      video.volume = volume
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
          activeAutoResolution,
          isHlsManualSupported,
          isLoading,
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
      activeAutoResolution,
      isHlsManualSupported,
      isLoading,
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
        const video = videoRef.current
        if (!video) return

        if (pendingResolutionCorrectionRef.current) {
          pendingResolutionCorrectionRef.current()
          pendingResolutionCorrectionRef.current = null
        }

        if (isHls) {
          if (!hlsRef.current) {
            // Safari native HLS fallback does not support manual rendition switching
            return
          }
          const hls = hlsRef.current
          const wasPaused = video.paused
          const targetFrame = currentFrameRef.current

          if (resolution === 'Auto') {
            if (currentResolution === 'Auto' && hls.currentLevel === -1) {
              return
            }
            hls.currentLevel = -1
            setCurrentResolution('Auto')
          } else {
            const target = resolutions.find((r) => r.resolution === resolution)
            if (target) {
              const targetIndex = hls.levels.findIndex(
                (lvl) =>
                  lvl.height === target.height ||
                  Math.max(lvl.width, lvl.height) === Math.max(target.width, target.height),
              )
              if (targetIndex !== -1) {
                if (targetIndex === hls.currentLevel && currentResolution === resolution) {
                  return
                }
                hls.currentLevel = targetIndex
                setCurrentResolution(resolution)
                setIsCurrentHdr(target.hdr)
              }
            }
          }

          if (wasPaused) {
            let timer: ReturnType<typeof setTimeout> | null = null

            const cleanup = () => {
              if (timer) {
                clearTimeout(timer)
                timer = null
              }
              video.removeEventListener('seeked', onSeeked)
              hls.off?.(Hls.Events.ERROR, cleanup)
              if (pendingResolutionCorrectionRef.current === cleanup) {
                pendingResolutionCorrectionRef.current = null
              }
            }

            const onSeeked = () => {
              cleanup()
              const safeCenterTime = calculateFrameCenterTime(targetFrame, frameRate)
              const frameDuration = 1 / frameRate
              if (Math.abs(video.currentTime - safeCenterTime) > frameDuration / 4) {
                video.currentTime = safeCenterTime
              }
            }

            // Safety timeout (1.5s): if no seeked event fires from rendition switch, cleanly detach
            timer = setTimeout(cleanup, 1500)
            pendingResolutionCorrectionRef.current = cleanup
            video.addEventListener('seeked', onSeeked)
            hls.once?.(Hls.Events.ERROR, cleanup)
          }
          return
        }

        const target =
          hdr !== undefined
            ? resolutions.find(
                (r) => r.resolution === resolution && Boolean(r.hdr) === Boolean(hdr),
              )
            : resolutions.find((r) => r.resolution === resolution)
        if (!target) return
        const wasPlaying = !video.paused
        const currentT = video.currentTime
        setCurrentResolution(resolution)
        setIsCurrentHdr(target.hdr)
        currentSrcRef.current = target.url
        video.src = target.url || ''
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.currentTime = currentT
          if (wasPlaying) {
            const p = video.play()
            if (p !== undefined) p.catch(() => {})
          }
          video.playbackRate = playbackRate
        }
        video.addEventListener('loadedmetadata', onLoadedMetadata)
      },
      [resolutions, isHls, frameRate, playbackRate, currentResolution],
    )

    useImperativeHandle(
      ref,
      (): ComparePaneHandle => ({
        getKind: () => 'video',
        play: () => {
          if (pendingResolutionCorrectionRef.current) {
            pendingResolutionCorrectionRef.current()
            pendingResolutionCorrectionRef.current = null
          }
          const p = videoRef.current?.play()
          if (p !== undefined) p.catch(() => {})
        },
        pause: () => videoRef.current?.pause(),
        togglePlay: () => {
          const video = videoRef.current
          if (!video) return
          if (pendingResolutionCorrectionRef.current) {
            pendingResolutionCorrectionRef.current()
            pendingResolutionCorrectionRef.current = null
          }
          if (video.paused || video.ended) {
            const p = video.play()
            if (p !== undefined) p.catch(() => {})
          } else {
            video.pause()
          }
        },
        seekToFrame: (frame) => {
          if (pendingResolutionCorrectionRef.current) {
            pendingResolutionCorrectionRef.current()
            pendingResolutionCorrectionRef.current = null
          }
          setHasStartedPlaying(true)
          return seekToFrame(clampFrame(frame))
        },
        seekToSecond: (second) => {
          if (pendingResolutionCorrectionRef.current) {
            pendingResolutionCorrectionRef.current()
            pendingResolutionCorrectionRef.current = null
          }
          setHasStartedPlaying(true)
          const frame = Math.floor(second * frameRate + 0.45)
          seekToFrame(clampFrame(frame))
        },
        stepFrame: (delta) => {
          if (pendingResolutionCorrectionRef.current) {
            pendingResolutionCorrectionRef.current()
            pendingResolutionCorrectionRef.current = null
          }
          setHasStartedPlaying(true)
          return seekToFrame(clampFrame(currentFrameRef.current + delta))
        },
        setMuted: (m) => {
          if (videoRef.current) videoRef.current.muted = m
        },
        setVolume: (v) => {
          const video = videoRef.current
          if (!video) return
          video.volume = v
          if (v > 0 && video.muted) video.muted = false
          else if (v === 0 && !video.muted) video.muted = true
        },
        setPlaybackRate: (rate) => {
          if (videoRef.current) videoRef.current.playbackRate = rate
        },
        toggleLoop: () => {
          const video = videoRef.current
          if (!video) return
          const next = !video.loop
          video.loop = next
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

    const displayAnnotations = [...(annotations ?? []), ...(isActive ? draftAnnotations : [])]

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
      if (isLoading) return
      onRequestTogglePlay?.()
    }, [isActive, isLoading, onActivate, onRequestTogglePlay])

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
            <video
              ref={videoRef}
              className="w-full h-full block object-contain pointer-events-none"
              playsInline
              preload="auto"
              poster={file.preview?.thumbnailUrl || undefined}
            />
          </div>
        )}
        {isAudio && (
          <video
            ref={videoRef}
            className="absolute inset-0 pointer-events-none opacity-0"
            playsInline
            preload="auto"
          />
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

        {/* Loading Spinner Overlay */}
        {isLoading && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-opacity duration-200"
            data-testid="compare-video-loading-spinner"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm">
              <Loader2 className="h-7 w-7 text-white animate-spin" />
            </div>
          </div>
        )}

        {!isLoading && !hasStartedPlaying && !isDrawing && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-opacity duration-200"
            data-testid="compare-video-play-overlay"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm">
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            </div>
          </div>
        )}
      </div>
    )
  },
)
