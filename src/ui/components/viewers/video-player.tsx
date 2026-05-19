import type { AssetInfo, VideoTranscode } from '@/dtos/asset'
import { cn } from '@/ui/lib/utils'
import {
  Download,
  Maximize,
  Minimize,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Slider } from '../ui/slider'
import ProgressBar from './progress-bar'
import { formatFrame, formatTime } from './utils'

import type { Annotation } from '@/ui/types'
import DrawingCanvas from '../drawing-canvas'
import { useAnnotationStore } from '@/ui/stores/annotation-store'

export interface PlayerState {
  isPlaying: boolean
  progress: number // 0 to 100
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isLooping: boolean
  playbackRate: number
  isFullScreen: boolean
  showFrames: boolean // Toggle between time (02:30) and frames (1234)
  currentResolution: string // 'Original' or '720p', '480p' etc.
  currentSrc?: string
}

interface VideoPlayerProps {
  data: AssetInfo
  playerRef?: React.RefObject<Player | null>
  onPlay?: () => void
  onPause?: () => void
  annotations?: Annotation[]
}

type DisplayTranscode = VideoTranscode & { resolution: string }

interface ControlBarProps {
  state: PlayerState
  zoom: number
  isControlsVisible: boolean
  buffered: number
  data: AssetInfo
  resolutions: DisplayTranscode[]
  togglePlay: () => void
  toggleLoop: () => void
  handleSeek: (time: number) => void
  toggleMute: () => void
  handleVolumeChange: (newVolume: number) => void
  setState: React.Dispatch<React.SetStateAction<PlayerState>>
  changePlaybackRate: (rate: number) => void
  changeResolution: (res: DisplayTranscode) => void
  handleDownload: (url: string, resolution: string) => void
  toggleFullScreen: () => void
  onZoomChange: (zoom: number) => void
}

const ControlBar: React.FC<ControlBarProps> = ({
  state,
  zoom,
  isControlsVisible,
  buffered,
  data,
  resolutions,
  togglePlay,
  toggleLoop,
  handleSeek,
  toggleMute,
  handleVolumeChange,
  setState,
  changePlaybackRate,
  changeResolution,
  handleDownload,
  toggleFullScreen,
  onZoomChange,
}) => {
  if (!data.media?.metadata) {
    return null
  }
  return (
    <div
      className={cn(
        'transition-all duration-300 ease-in-out z-20',
        state.isFullScreen
          ? 'absolute bottom-0 left-0 right-0 px-4 py-4 bg-black/60 backdrop-blur-md text-white'
          : 'relative w-full bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 z-10 transition-colors duration-200',
        isControlsVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none',
      )}
    >
      {/* Progress Bar */}
      <div className="mb-4 px-1">
        <ProgressBar
          duration={state.duration}
          currentTime={state.currentTime}
          buffered={buffered}
          previewUrl={data.media.videoPreview?.url}
          onSeek={handleSeek}
          metadata={{
            ...data.media.metadata,
            frameRate: data.media.metadata.frameRate || 30,
          }}
        />
      </div>

      {/* Lower Controls Row */}
      <div
        className={cn(
          'flex items-center justify-between',
          state.isFullScreen ? 'text-white/90' : 'text-gray-700 dark:text-white/90',
        )}
      >
        {/* Left Side: Play, Vol, Time */}
        <div className="flex items-center gap-4">
          <button onClick={togglePlay} className="hover:text-blue-500 transition-colors">
            {state.isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current" />
            )}
          </button>

          <button
            onClick={toggleLoop}
            className={cn('transition-colors', state.isLooping ? 'text-blue-500' : 'text-gray-400')}
            title="Loop"
          >
            <Repeat className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 group/vol">
            <button onClick={toggleMute} className="hover:text-blue-500">
              {state.isMuted || state.volume === 0 ? (
                <VolumeX className="w-6 h-6" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
            </button>

            <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300 ease-in-out">
              <div className="w-24 px-1">
                <Slider
                  value={state.isMuted ? [0] : [state.volume]}
                  onValueChange={(v) => handleVolumeChange(v[0])}
                  max={1}
                  step={0.05}
                />
              </div>
            </div>
          </div>

          <div
            className="min-w-[100px] cursor-pointer text-sm font-medium tabular-nums hover:text-blue-500"
            onClick={() => setState((p) => ({ ...p, showFrames: !p.showFrames }))}
            title="Click to toggle Time/Frames"
          >
            {state.showFrames
              ? `${formatFrame(state.currentTime, data.media.metadata.frameRate ?? 30)} / ${formatFrame(state.duration, data.media.metadata.frameRate ?? 30)}`
              : `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`}
            <span className="ml-1 text-xs text-gray-400">{state.showFrames ? 'fr' : ''}</span>
          </div>
        </div>

        {/* Right Side: Zoom, Speed, Res, Download, Fullscreen */}
        <div className="relative flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-gray-200/50 dark:bg-white/10 rounded-md p-0.5">
            <button
              onClick={() => onZoomChange(zoom * 0.8)}
              className="p-1 hover:text-blue-500 rounded"
            >
              <Minus size={14} />
            </button>
            <span className="text-xs w-8 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => onZoomChange(zoom * 1.2)}
              className="p-1 hover:text-blue-500 rounded"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Playback Rate */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 text-sm font-bold hover:text-blue-500">
                {state.playbackRate}x
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[0.5, 1, 1.5, 2].map((rate) => (
                <DropdownMenuItem
                  key={rate}
                  onClick={() => changePlaybackRate(rate)}
                  className={cn(
                    'rounded py-1 px-2 text-left text-xs',
                    state.playbackRate === rate
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                  )}
                >
                  {rate}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Resolution Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-sm font-semibold hover:bg-gray-200 dark:border-white/20 dark:hover:bg-white/10">
                <Settings className="h-3.5 w-3.5" />
                <span>{state.currentResolution}</span>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
              <DropdownMenuLabel>Quality</DropdownMenuLabel>
              {resolutions.map((res) => (
                <DropdownMenuItem
                  key={res.resolution}
                  onClick={() => changeResolution(res)}
                  className={cn(
                    'flex w-full items-center justify-between',
                    state.currentResolution === res.resolution
                      ? 'text-blue-500'
                      : 'text-gray-700 dark:text-gray-300',
                  )}
                >
                  <span>{res.resolution}</span>
                  <span className="pl-5 text-xs text-gray-400 dark:text-gray-500">
                    {res.width}x{res.height}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Download */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="transition-colors hover:text-blue-500" title="Download">
                <Download className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Download</DropdownMenuLabel>
              {resolutions.map((res) => (
                <DropdownMenuItem
                  key={res.resolution}
                  onClick={() => handleDownload(res.url ?? '', res.resolution)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <span>{res.resolution}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">MP4</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fullscreen */}
          <button onClick={toggleFullScreen} className="transition-colors hover:text-blue-500">
            {state.isFullScreen ? (
              <Minimize className="h-6 w-6" />
            ) : (
              <Maximize className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  data,
  playerRef: passedPlayerRef,
  onPlay,
  onPause,
  annotations,
}) => {
  const localPlayerRef = useRef<Player | null>(null)
  const playerRef = passedPlayerRef || localPlayerRef
  // We use a container ref to manually append the video element
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [videoHtmlEl, setVideoHtmlEl] = useState<HTMLVideoElement | undefined>(undefined)
  const [zoom, setZoom] = useState(1)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Store
  const {
    isDrawing,
    currentTool,
    currentColor,
    addAnnotation,
    annotations: draftAnnotations,
  } = useAnnotationStore()

  // Combine annotations
  const displayAnnotations = [...(annotations || []), ...draftAnnotations]

  // Resize Observer for container
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Fit to screen initial
  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      // Only if not already set or reset?
      // Actually, we want to start fit.
      const vidW = data.media?.metadata?.originalWidth ?? 1920
      const vidH = data.media?.metadata?.originalHeight ?? 1080
      const scale = Math.min(containerSize.width / vidW, containerSize.height / vidH)
      // Only set if zoom is 1 (initial).
      if (zoom === 1) {
        setZoom(scale)
      }
    }
  }, [containerSize.width, containerSize.height, data.media?.metadata])

  if (!data.media?.original?.downloadUrl || !data.media.metadata) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Media is not available.</p>
      </div>
    )
  }

  // Initial resolution setup
  const originalRes = {
    url: data.media.original.downloadUrl,
    width: data.media.metadata.originalWidth ?? 0,
    height: data.media.metadata.originalHeight ?? 0,
    resolution: 'Original',
  } as DisplayTranscode

  const resolutions: DisplayTranscode[] = (data.media.videoTranscodes ?? []).map((t) => ({
    ...t,
    resolution: t.isRaw ? 'Original' : `${t.height}p`,
  }))

  // Logic to select best resolution based on screen size
  const getInitialResolution = (): DisplayTranscode => {
    if (typeof window === 'undefined') return originalRes

    // Use device pixel ratio for high DPI screens
    const screenWidth = window.innerWidth * (window.devicePixelRatio || 1)

    // Strategy: Find smallest resolution that is >= screenWidth.
    // Filter out raw versions unless they are the only option.

    const nonRaw = resolutions.filter((r) => !r.isRaw)
    const candidates = nonRaw.length > 0 ? nonRaw : resolutions

    // 1. Sort by width ascending
    const sortedResolutions = [...candidates].sort((a, b) => {
      const wA = a.width ?? 0
      const wB = b.width ?? 0
      if (wA !== wB) return wA - wB
      // If equal width, prefer non-raw (optimized)
      return (a.isRaw ? 1 : 0) - (b.isRaw ? 1 : 0)
    })

    // 2. Find first one >= screenWidth
    const bestFit = sortedResolutions.find((r) => (r.width ?? 0) >= screenWidth)

    // 3. If found, return it. If not (all are smaller), return the last one (largest).
    return bestFit || sortedResolutions[sortedResolutions.length - 1] || originalRes
  }

  const initialRes = getInitialResolution()

  // State
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: data.media.metadata.duration || 0,
    volume: 1,
    isMuted: false,
    isLooping: false,
    playbackRate: 1,
    isFullScreen: false,
    showFrames: false,
    currentResolution: initialRes.resolution,
    currentSrc: initialRes.url,
  })

  const [buffered, setBuffered] = useState(0)
  const [isControlsVisible, setIsControlsVisible] = useState(true)

  // Initialize Video.js
  useEffect(() => {
    if (!videoContainerRef.current) return

    // 1. Create the video element manually
    // This avoids conflicts with React Strict Mode where the DOM might not match React's virtual DOM expectations after Video.js modifies it.
    const videoElement = document.createElement('video-js')
    videoElement.classList.add('vjs-big-play-centered', '!h-full', '!w-full')

    // Hide it, but keep it in DOM
    videoElement.style.opacity = '0'
    videoElement.style.pointerEvents = 'none'

    // Append to our container
    videoContainerRef.current.appendChild(videoElement)

    // 2. Initialize the player
    const player = (playerRef.current = videojs(videoElement, {
      controls: false,
      autoplay: false,
      preload: 'auto',
      playsinline: true,
      sources: [
        {
          src: state.currentSrc,
          type: data.media?.mimeType || 'video/mp4',
        },
      ],
    }))

    // Extract video element for Konva
    const htmlVid = videoElement.querySelector('video')
    if (htmlVid) {
      setVideoHtmlEl(htmlVid)
    } else {
      // Fallback: try player.tech().el()
      // Wait for ready?
      player.ready(() => {
        const techEl = player.tech({ iWillNotUseThisInPlugins: true })?.el() as HTMLVideoElement
        if (techEl) setVideoHtmlEl(techEl)
      })
    }

    player.on('play', () => {
      setState((p) => ({ ...p, isPlaying: true }))
      onPlay?.()
    })
    player.on('pause', () => {
      setState((p) => ({ ...p, isPlaying: false }))
      onPause?.()
    })
    player.on('ended', () => setState((p) => ({ ...p, isPlaying: false })))

    player.on('timeupdate', () => {
      const current = player.currentTime() || 0
      const duration = player.duration() || data.media?.metadata?.duration || 0

      const bufferedEnd = player.bufferedEnd()
      if (duration > 0) {
        setBuffered((bufferedEnd / duration) * 100)
      }

      setState((prev) => ({
        ...prev,
        currentTime: current,
        duration: duration || prev.duration,
        progress: duration > 0 ? (current / duration) * 100 : 0,
      }))
    })

    player.on('volumechange', () => {
      const vol = player.volume()
      const muted = player.muted()
      setState((prev) => ({
        ...prev,
        volume: vol || 0,
        isMuted: muted || false,
      }))
    })

    player.on('ratechange', () => {
      setState((prev) => ({
        ...prev,
        playbackRate: player.playbackRate() || 1,
      }))
    })

    player.on('error', () => {
      console.error('VideoJS Error:', player.error())
    })

    // Set initial state
    player.volume(state.volume)

    // 4. Cleanup
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
    }
  }, [data])

  const handleMouseMove = useCallback(() => {
    // Always show controls on movement
    setIsControlsVisible(true)

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }

    // Only set auto-hide timer if we are in fullscreen and playing
    // If paused, controls should remain visible so user can see what to do
    if (state.isFullScreen && state.isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setIsControlsVisible(false)
      }, 2000)
    }
  }, [state.isFullScreen, state.isPlaying])

  const handleMouseLeave = useCallback(() => {
    // If we leave the player area in fullscreen, hide controls (optional preference, usually good)
    if (state.isFullScreen && state.isPlaying) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      setIsControlsVisible(false)
    }
  }, [state.isFullScreen, state.isPlaying])

  // Clean up timeout on unmount or state change
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [])

  // Ensure controls are visible when pausing or entering fullscreen initially
  useEffect(() => {
    if (!state.isPlaying) {
      setIsControlsVisible(true)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    } else {
      // If we just started playing (or re-entered playing state), trigger the timer logic
      handleMouseMove()
    }
  }, [state.isPlaying, state.isFullScreen, handleMouseMove])

  // -- Event Handlers --

  const togglePlay = useCallback(() => {
    // Disable click-to-play if drawing
    if (useAnnotationStore.getState().isDrawing) return

    const player = playerRef.current
    if (!player) return

    if (player.paused() || player.ended()) {
      const playPromise = player.play()
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // Ignore AbortError which happens when pausing rapidly after playing
          if (error.name === 'AbortError') return
          console.error('Play failed:', error)
        })
      }
    } else {
      player.pause()
    }
  }, [])

  const toggleLoop = () => {
    const player = playerRef.current
    if (!player) return
    const newLoop = !state.isLooping
    player.loop(newLoop)
    setState((prev) => ({ ...prev, isLooping: newLoop }))
  }

  const handleSeek = (time: number) => {
    const player = playerRef.current
    if (!player) return
    player.currentTime(time)
    setState((prev) => ({ ...prev, currentTime: time }))
  }

  const handleVolumeChange = (newVolume: number) => {
    // Optimistic update to prevent slider jumping and ensure immediate UI feedback
    setState((prev) => ({
      ...prev,
      volume: newVolume,
      isMuted: newVolume === 0, // If dragging to 0, consider it muted
    }))

    const player = playerRef.current
    if (!player) return

    // Set volume first so if we unmute, it is at the correct level
    player.volume(newVolume)

    // Manage mute state based on volume
    if (newVolume > 0 && player.muted()) {
      player.muted(false)
    } else if (newVolume === 0 && !player.muted()) {
      player.muted(true)
    }
  }

  const toggleMute = () => {
    const player = playerRef.current
    if (!player) return

    const isMuted = player.muted()
    if (isMuted) {
      player.muted(false)
      // If volume was 0 (e.g. user dragged to 0), restore to default 0.5 so they hear something
      if (player.volume() === 0) {
        player.volume(0.5)
      }
    } else {
      player.muted(true)
    }
  }

  const changePlaybackRate = (rate: number) => {
    const player = playerRef.current
    if (!player) return
    player.playbackRate(rate)
  }

  const changeResolution = (res: DisplayTranscode) => {
    const player = playerRef.current
    if (!player) return

    const wasPlaying = !player.paused()
    const currentTime = player.currentTime()

    setState((prev) => ({
      ...prev,
      currentResolution: res.resolution,
      currentSrc: res.url,
    }))

    player.src({ type: data.media?.mimeType || 'video/mp4', src: res.url })

    player.one('loadedmetadata', () => {
      player.currentTime(currentTime)
      if (wasPlaying) {
        const playPromise = player.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            if (error.name === 'AbortError') return
            console.error('Play after seek failed:', error)
          })
        }
      }
      player.playbackRate(state.playbackRate)
    })
  }

  const toggleFullScreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setState((prev) => ({ ...prev, isFullScreen: true }))
    } else {
      document.exitFullscreen()
      setState((prev) => ({ ...prev, isFullScreen: false }))
    }
  }

  const handleDownload = (url: string, resolution: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `${data.name}-${resolution}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Listen for fullscreen change events (ESC key)
  useEffect(() => {
    const onFsChange = () => {
      setState((prev) => ({
        ...prev,
        isFullScreen: !!document.fullscreenElement,
      }))
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Calculate center pan
  const vidW = data.media?.metadata?.originalWidth ?? 1920
  const vidH = data.media?.metadata?.originalHeight ?? 1080

  const scale = zoom
  const panX = (containerSize.width - vidW * scale) / 2
  const panY = (containerSize.height - vidH * scale) / 2

  return (
    <div
      className={cn(
        'group shadow-2xl font-sans select-none flex flex-col mx-auto transition-all duration-300 relative',
        state.isFullScreen ? 'h-full w-full rounded-none bg-black' : 'w-full h-full',
        !isControlsVisible && state.isFullScreen ? 'cursor-none' : '',
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Area */}
      <div
        ref={containerRef}
        className={cn(
          'w-full bg-black cursor-pointer relative flex items-center justify-center overflow-hidden flex-1 min-h-0',
        )}
        onClick={togglePlay}
        data-vjs-player
      >
        {/* Hidden VideoJS container */}
        <div ref={videoContainerRef} className="absolute inset-0 z-[-1]" />

        {/* Drawing Canvas (Visible) */}
        {videoHtmlEl && containerSize.width > 0 && (
          <DrawingCanvas
            width={containerSize.width}
            height={containerSize.height}
            mediaDimensions={{
              width: vidW,
              height: vidH,
            }}
            videoElement={videoHtmlEl}
            annotations={displayAnnotations}
            scale={scale}
            offset={{ x: panX, y: panY }}
            className="absolute inset-0"
            onClick={togglePlay}
            // Drawing Props
            isDrawing={isDrawing}
            currentTool={currentTool}
            currentColor={currentColor}
            onAddAnnotation={addAnnotation}
          />
        )}

        {/* Big Play Button Overlay (when paused) */}
        {!state.isPlaying && !isDrawing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30 animate-pulse">
              <Play className="w-10 h-10 text-white ml-1 fill-white" />
            </div>
          </div>
        )}
      </div>

      <ControlBar
        state={state}
        zoom={zoom}
        isControlsVisible={isControlsVisible}
        buffered={buffered}
        data={data}
        resolutions={resolutions}
        togglePlay={togglePlay}
        toggleLoop={toggleLoop}
        handleSeek={handleSeek}
        toggleMute={toggleMute}
        handleVolumeChange={handleVolumeChange}
        setState={setState}
        changePlaybackRate={changePlaybackRate}
        changeResolution={changeResolution}
        handleDownload={handleDownload}
        toggleFullScreen={toggleFullScreen}
        onZoomChange={setZoom}
      />
    </div>
  )
}

export default VideoPlayer
