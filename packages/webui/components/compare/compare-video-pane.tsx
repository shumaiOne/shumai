import { client } from '@/ui/api/client'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { cn } from '@/ui/lib/utils'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import type { Annotation } from '@/ui/types'
import type { AssetInfo } from '@shumai/dtos'
import { Play } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import { useFramePlayer } from '@/ui/components/viewers/use-frame-player'
import { clampFrame as clampFrameUtil } from './compare-utils'
import type { ComparePaneHandle, DisplayTranscode, PaneReportedState } from './types'

interface CompareVideoPaneProps {
  file: AssetInfo
  shareId?: string
  isActive: boolean
  /** Whether this pane's audio should be muted (only the active side plays audio). */
  muted: boolean
  volume: number
  annotations: Annotation[]
  onStateChange: (state: PaneReportedState) => void
  onActivate?: () => void
  onRequestTogglePlay?: () => void
  /** Called with the current playhead time in seconds (used only for the active pane). */
  onTimeUpdate?: (second: number) => void
  onPlay?: () => void
}

function computeResolutions(file: AssetInfo): DisplayTranscode[] {
  const original: DisplayTranscode | null = file.media?.original?.downloadUrl
    ? {
        id: 'original',
        url: file.media.original.downloadUrl,
        key: file.media.original.key ?? '',
        width: file.media?.metadata?.originalWidth ?? 0,
        height: file.media?.metadata?.originalHeight ?? 0,
        size: 0,
        isRaw: true,
        resolution: 'Original',
      }
    : null

  const transcodes: DisplayTranscode[] = (file.media?.videoTranscodes ?? []).map((t) => {
    const longSide = Math.max(t.width, t.height)
    let resolution = `${t.height}p`
    if (longSide >= 3840) resolution = '2160p'
    else if (longSide >= 1920) resolution = '1080p'
    else if (longSide >= 1280) resolution = '720p'
    else if (longSide >= 960) resolution = '540p'
    else if (longSide >= 640) resolution = '360p'
    else if (longSide >= 320) resolution = '180p'
    return { ...t, resolution: t.isRaw ? 'Original' : resolution }
  })

  const hasOriginalTranscode = transcodes.some((t) => t.isRaw)
  if (!hasOriginalTranscode && original) {
    return [...transcodes, original]
  }
  return transcodes
}

export const CompareVideoPane = forwardRef<ComparePaneHandle, CompareVideoPaneProps>(
  function CompareVideoPane(
    {
      file,
      shareId,
      isActive,
      muted,
      volume,
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
    const [videoHtmlEl, setVideoHtmlEl] = useState<HTMLVideoElement | undefined>(undefined)

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
    const videoDuration = dbTotalFrames / frameRate
    const frameDuration = 1 / frameRate
    const totalFrames =
      containerDuration - videoDuration > 0.5 * frameDuration
        ? Math.round(containerDuration * frameRate)
        : dbTotalFrames

    const resolutions = computeResolutions(file)
    const previewResolutions = resolutions.filter((r) => !r.isRaw)
    const initialRes = previewResolutions[0] ?? resolutions[0]
    const [currentResolution, setCurrentResolution] = useState(initialRes?.resolution ?? 'Original')
    const currentSrcRef = useRef(initialRes?.url)

    const { currentFrame, seekToFrame } = useFramePlayer(videoRef, frameRate, totalFrames)

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

    const vidW = metadata?.originalWidth ?? 1920
    const vidH = metadata?.originalHeight ?? 1080

    // Auto-fit zoom
    useEffect(() => {
      if (containerSize.width > 0 && containerSize.height > 0 && !hasManuallyZoomed) {
        const scale = Math.min(containerSize.width / vidW, containerSize.height / vidH)
        setZoom(scale)
      }
    }, [containerSize.width, containerSize.height, vidW, vidH, hasManuallyZoomed])

    // Initialize video.js
    useEffect(() => {
      if (!videoContainerRef.current) return
      const videoElement = document.createElement('video-js')
      videoElement.classList.add('vjs-big-play-centered', '!h-full', '!w-full')
      videoElement.style.opacity = '0'
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
        setVideoHtmlEl(htmlVid)
        videoRef.current = htmlVid
      } else {
        player.ready(() => {
          const techEl = player.tech({ iWillNotUseThisInPlugins: true })?.el() as HTMLVideoElement
          if (techEl) {
            setVideoHtmlEl(techEl)
            videoRef.current = techEl
          }
        })
      }

      player.on('play', () => {
        setIsPlaying(true)
        onPlay?.()
      })
      player.on('pause', () => setIsPlaying(false))
      player.on('ended', () => setIsPlaying(false))
      player.on('loadedmetadata', () => setIsPlayerReady(true))
      player.on('loadstart', () => setIsPlayerReady(false))
      player.on('timeupdate', () => {
        const playerDuration = player.duration() || containerDuration || 0
        const bufferedEnd = player.bufferedEnd()
        if (playerDuration > 0) setBuffered((bufferedEnd / playerDuration) * 100)
      })
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
      (resolution: string) => {
        const player = playerRef.current
        if (!player) return
        const target = resolutions.find((r) => r.resolution === resolution)
        if (!target) return
        const wasPlaying = !player.paused()
        const currentT = player.currentTime()
        setCurrentResolution(resolution)
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
        seekToFrame: (frame) => seekToFrame(clampFrame(frame)),
        seekToSecond: (second) => {
          const frame = Math.floor(second * frameRate + 0.45)
          seekToFrame(clampFrame(frame))
        },
        stepFrame: (delta) => seekToFrame(clampFrame(currentFrameRef.current + delta)),
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
      onActivate?.()
      onRequestTogglePlay?.()
    }, [onActivate, onRequestTogglePlay])

    if (!file.media?.original?.downloadUrl || !metadata) {
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
        <div ref={videoContainerRef} className="absolute inset-0 z-[-1]" />

        {videoHtmlEl && containerSize.width > 0 && (
          <DrawingCanvas
            width={containerSize.width}
            height={containerSize.height}
            mediaDimensions={{ width: vidW, height: vidH }}
            videoElement={videoHtmlEl}
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
        )}

        {!isPlaying && !isDrawing && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm">
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            </div>
          </div>
        )}
      </div>
    )
  },
)
