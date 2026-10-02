import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { cn } from '@/ui/lib/utils'
import { Play, AudioLines, Loader2, AlertCircle } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState, useImperativeHandle } from 'react'
import Hls from 'hls.js'
import { useFramePlayer } from './use-frame-player'
import { calculateFrameCenterTime, resolveTotalFrames } from './utils'
import { VideoControlBar, type PlayerState, type DisplayTranscode } from './video-control-bar'
import { MobileVideoControlBar } from './mobile-video-control-bar'
import { useIsMobile } from '@/ui/hooks/use-mobile'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import { getVideoResolutionLabel } from '@/ui/lib/media'
import { FileViewerProps, MediaController } from '../types'
import { centeredPan, fitScale, zoomAtPoint } from '../pan-zoom'
import { usePanZoomGestures } from '../use-pan-zoom'

const VideoViewer = React.forwardRef<MediaController, FileViewerProps>(
  (
    {
      file: data,
      onPlay,
      onPause,
      onTimeUpdate,
      annotations,
      startTime,
      shareId,
      children,
      allowDownload,
      autoPlay,
    },
    ref,
  ) => {
    const hlsRef = useRef<Hls | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const [activeAutoResolution, setActiveAutoResolution] = useState<string | undefined>(undefined)
    const [isHlsManualSupported, setIsHlsManualSupported] = useState<boolean>(true)
    const isHls = Boolean(data.media?.isHls && data.media.hls?.url)
    const baseTranscodes = isHls
      ? (data.media?.hls?.resolutions ?? [])
      : (data.media?.videoTranscodes ?? [])

    const resolutions: DisplayTranscode[] = baseTranscodes.map((t) => ({
      ...t,
      resolution: getVideoResolutionLabel(t),
    }))
    // Only transcoded proxy versions are ever displayed; the raw original file
    // is never used as a playback source.
    const hasMedia = (isHls || resolutions.length > 0) && !!data.media?.metadata

    // Logic to select best resolution based on screen size and dynamic range
    const getInitialResolution = (): DisplayTranscode | null => {
      if (resolutions.length === 0) return null

      if (typeof window === 'undefined') return resolutions[0]

      const prefersHdr =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(dynamic-range: high)').matches
      const hasHdr = resolutions.some((r) => r.hdr)
      const hasSdr = resolutions.some((r) => !r.hdr)

      let candidateResolutions = resolutions
      if (prefersHdr && hasHdr) {
        candidateResolutions = resolutions.filter((r) => r.hdr)
      } else if (!prefersHdr && hasSdr) {
        candidateResolutions = resolutions.filter((r) => !r.hdr)
      }

      // Use device pixel ratio for high DPI screens
      const screenWidth = window.innerWidth * (window.devicePixelRatio || 1)

      // 1. Sort by width ascending
      const sortedResolutions = [...candidateResolutions].sort((a, b) => {
        const wA = a.width ?? 0
        const wB = b.width ?? 0
        return wA - wB
      })

      // 2. Find first one >= screenWidth
      const bestFit = sortedResolutions.find((r) => (r.width ?? 0) >= screenWidth)

      // 3. If found, return it. If not (all are smaller), return the last one (largest).
      return bestFit || sortedResolutions[sortedResolutions.length - 1]
    }

    const initialRes = isHls ? null : getInitialResolution()

    // State
    const [state, setState] = useState<PlayerState>({
      isPlaying: false,
      progress: 0,
      currentTime: 0,
      duration: data.media?.metadata?.duration || 0,
      volume: 1,
      isMuted: false,
      isLooping: false,
      playbackRate: 1,
      isFullScreen: false,
      showFrames: false,
      currentResolution: isHls ? 'Auto' : (initialRes?.resolution ?? ''),
      currentSrc: isHls ? data.media!.hls!.url : (initialRes?.url ?? ''),
      isCurrentHdr: initialRes?.hdr ?? false,
    })
    const [hasStartedPlaying, setHasStartedPlaying] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingResolutionCorrectionRef = useRef<(() => void) | null>(null)

    useImperativeHandle(ref, () => ({
      play: () => {
        if (pendingResolutionCorrectionRef.current) {
          pendingResolutionCorrectionRef.current()
          pendingResolutionCorrectionRef.current = null
        }
        videoRef.current?.play().catch(() => {})
      },
      pause: () => {
        videoRef.current?.pause()
      },
      seekTo: (second: number) => {
        if (pendingResolutionCorrectionRef.current) {
          pendingResolutionCorrectionRef.current()
          pendingResolutionCorrectionRef.current = null
        }
        setHasStartedPlaying(true)
        if (videoRef.current) {
          videoRef.current.currentTime = second
        }
      },
      getCurrentTime: () => {
        return (videoRef.current ? videoRef.current.currentTime : 0) ?? 0
      },
      getDuration: () => {
        return (videoRef.current ? videoRef.current.duration : 0) ?? 0
      },
    }))
    const isOverControlsRef = useRef(false)

    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [hasManuallyZoomed, setHasManuallyZoomed] = useState(false)
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

    useEffect(() => {
      const res = isHls ? null : getInitialResolution()
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        duration: data.media?.metadata?.duration || 0,
        currentResolution: isHls ? 'Auto' : (res?.resolution ?? ''),
        currentSrc: isHls ? (data.media?.hls?.url ?? '') : (res?.url ?? ''),
        isCurrentHdr: res?.hdr ?? false,
      }))
      setActiveAutoResolution(undefined)
      setHasManuallyZoomed(false)
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current)
        waitingTimeoutRef.current = null
      }
      setIsPlayerReady(false)
      setIsLoading(true)
      setBuffered(0)
      lastProcessedStartTimeRef.current = null
      setHasStartedPlaying(false)
    }, [data.id, Boolean(isHls ? data.media?.hls?.url : initialRes?.url)])

    const vidW = data.media?.metadata?.originalWidth || 1920
    const vidH = data.media?.metadata?.originalHeight || 1080
    const baseScale = fitScale(containerSize.width, containerSize.height, vidW, vidH)

    const handleZoomChange = (newZoom: number) => {
      setHasManuallyZoomed(true)
      const next = zoomAtPoint(
        zoom,
        pan,
        newZoom / zoom,
        containerSize.width / 2,
        containerSize.height / 2,
      )
      setZoom(next.zoom)
      setPan(next.pan)
    }

    const handleZoomReset = () => {
      setHasManuallyZoomed(false)
      if (containerSize.width > 0 && containerSize.height > 0) {
        const scale = fitScale(containerSize.width, containerSize.height, vidW, vidH)
        setZoom(scale)
        setPan(centeredPan(containerSize.width, containerSize.height, vidW, vidH, scale))
      }
    }

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

    // Fit to screen initial / responsive resize (preserves manual zoom)
    useEffect(() => {
      if (containerSize.width <= 0 || containerSize.height <= 0) return
      if (hasManuallyZoomed) return
      const scale = fitScale(containerSize.width, containerSize.height, vidW, vidH)
      setZoom(scale)
      setPan(centeredPan(containerSize.width, containerSize.height, vidW, vidH, scale))
    }, [containerSize.width, containerSize.height, vidW, vidH, hasManuallyZoomed])

    usePanZoomGestures({
      containerRef,
      zoom,
      pan,
      baseScale,
      onZoomChange: (next) => {
        setHasManuallyZoomed(true)
        setZoom(next.zoom)
        setPan(next.pan)
      },
      onPanChange: setPan,
    })

    // Cleanup ref when player is disposed
    useEffect(() => {
      return () => {
        videoRef.current = null
      }
    }, [])

    // Initial resolution setup
    const [buffered, setBuffered] = useState(0)
    const [isControlsVisible, setIsControlsVisible] = useState(true)
    const [isPlayerReady, setIsPlayerReady] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastProcessedStartTimeRef = useRef<number | null>(null)

    // Frame-accurate hook and derived state
    const metadata = data.media?.metadata
    const frameRate = metadata?.frameRate || 30
    const dbTotalFrames = metadata?.totalFrames || 0
    const containerDuration = metadata?.duration || 0

    const isAudio = data.proxyType === 'audio'
    const totalFrames = resolveTotalFrames({ dbTotalFrames, containerDuration, frameRate })
    const { currentFrame, seekToFrame } = useFramePlayer(videoRef, frameRate, totalFrames, isAudio)

    const handleSeekToFrame = useCallback(
      (frame: number) => {
        if (pendingResolutionCorrectionRef.current) {
          pendingResolutionCorrectionRef.current()
          pendingResolutionCorrectionRef.current = null
        }
        setHasStartedPlaying(true)
        return seekToFrame(frame)
      },
      [seekToFrame],
    )

    const currentTime = currentFrame / frameRate
    const duration = totalFrames / frameRate
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    const controlBarState: PlayerState = {
      ...state,
      currentTime,
      duration,
      progress,
      activeAutoResolution,
      isHlsManualSupported,
      isLoading,
    }

    // Trigger time update event reactively
    useEffect(() => {
      if (onTimeUpdate) {
        onTimeUpdate(currentFrame / frameRate)
      }
    }, [currentFrame, frameRate, onTimeUpdate])

    // Initialize player (Hls.js or native HTML5 video)
    const targetSrc = isHls ? (data.media?.hls?.url ?? '') : (getInitialResolution()?.url ?? '')

    useEffect(() => {
      const video = videoRef.current
      if (!video) return

      if (!targetSrc) return

      // Clean up previous HLS instance if exists
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
      setActiveAutoResolution(undefined)

      const startAutoPlay = () => {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            video.muted = true
            setState((prev) => ({ ...prev, isMuted: true }))
            video.play()?.catch(() => {})
          })
        }
      }

      let hls: Hls | null = null

      if (isHls) {
        if (Hls.isSupported()) {
          setIsHlsManualSupported(true)
          hls = new Hls({
            autoStartLoad: true,
            startLevel: -1,
            capLevelToPlayerSize: false,
            enableWorker: true,
          })
          hlsRef.current = hls
          hls.attachMedia(video)
          hls.loadSource(targetSrc)

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (autoPlay) {
              if (video.readyState >= 2) {
                startAutoPlay()
              } else {
                video.addEventListener('canplay', startAutoPlay, { once: true })
              }
            }
          })

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
          // Native Safari HLS fallback
          setIsHlsManualSupported(false)
          video.src = targetSrc
          if (autoPlay) {
            if (video.readyState >= 2) {
              startAutoPlay()
            } else {
              video.addEventListener('canplay', startAutoPlay, { once: true })
            }
          }
        }
      } else {
        // Native MP4
        video.src = targetSrc
        if (autoPlay) {
          if (video.readyState >= 2) {
            startAutoPlay()
          } else {
            video.addEventListener('canplay', startAutoPlay, { once: true })
          }
        }
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
        setState((p) => ({ ...p, isPlaying: true }))
        setHasStartedPlaying(true)
        onPlay?.()
      }
      const handlePause = () => {
        setState((p) => ({ ...p, isPlaying: false }))
        onPause?.()
      }
      const handleEnded = () => {
        clearWaitingTimeout()
        setIsLoading(false)
        setState((p) => ({ ...p, isPlaying: false }))
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
        const vidDuration = video.duration || data.media?.metadata?.duration || 0
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
        setState((prev) => ({
          ...prev,
          volume: video.volume,
          isMuted: video.muted,
        }))
      }
      const handleRateChange = () => {
        setState((prev) => ({
          ...prev,
          playbackRate: video.playbackRate,
        }))
      }
      const handleError = () => {
        clearWaitingTimeout()
        setIsLoading(false)
        console.error('Video Error:', video.error)
      }

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
      video.addEventListener('error', handleError)

      // Set initial state
      video.volume = state.volume

      // Cleanup
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
        video.removeEventListener('error', handleError)

        if (hlsRef.current) {
          hlsRef.current.destroy()
          hlsRef.current = null
        }
      }
    }, [data.id, targetSrc, isHls, autoPlay])

    // Handle changes to startTime (e.g., clicking different chunks in search results)
    useEffect(() => {
      if (!isPlayerReady) return

      if (startTime !== undefined && startTime !== null && startTime > 0) {
        if (startTime !== lastProcessedStartTimeRef.current) {
          lastProcessedStartTimeRef.current = startTime
          const targetFrame = Math.floor(startTime * frameRate + 0.45)
          setHasStartedPlaying(true)
          seekToFrame(targetFrame)
        }
      }
    }, [startTime, frameRate, seekToFrame, isPlayerReady])

    const scheduleHide = useCallback(() => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      // Never hide while the cursor rests over the control bar itself.
      if (state.isFullScreen && !isOverControlsRef.current) {
        controlsTimeoutRef.current = setTimeout(() => {
          setIsControlsVisible(false)
        }, 1200)
      }
    }, [state.isFullScreen])

    const handleMouseMove = useCallback(() => {
      // Always show controls on movement, then (re)start the idle hide timer.
      setIsControlsVisible(true)
      scheduleHide()
    }, [scheduleHide])

    const handleControlsMouseEnter = useCallback(() => {
      isOverControlsRef.current = true
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      setIsControlsVisible(true)
    }, [])

    const handleControlsMouseLeave = useCallback(() => {
      isOverControlsRef.current = false
      scheduleHide()
    }, [scheduleHide])

    const handleMouseLeave = useCallback(() => {
      // If the cursor leaves the player while fullscreen, hide the controls.
      if (state.isFullScreen) {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
        setIsControlsVisible(false)
      }
    }, [state.isFullScreen])

    // Clean up timeout on unmount or state change
    useEffect(() => {
      return () => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      }
    }, [])

    // Windowed mode: controls are always visible. Fullscreen: show now and let
    // the idle timer hide them (re-runs on play/pause so pausing re-reveals them).
    useEffect(() => {
      if (!state.isFullScreen) {
        setIsControlsVisible(true)
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      } else {
        handleMouseMove()
      }
    }, [state.isPlaying, state.isFullScreen, handleMouseMove])

    // -- Event Handlers --

    const togglePlay = useCallback(() => {
      if (isLoading) return
      // Disable click-to-play if drawing
      if (useAnnotationStore.getState().isDrawing) return

      if (pendingResolutionCorrectionRef.current) {
        pendingResolutionCorrectionRef.current()
        pendingResolutionCorrectionRef.current = null
      }

      const video = videoRef.current
      if (!video) return

      if (video.paused || video.ended) {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            // Ignore AbortError which happens when pausing rapidly after playing
            if (error.name === 'AbortError') return
            console.error('Play failed:', error)
          })
        }
      } else {
        video.pause()
      }
    }, [isLoading])

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
          togglePlay()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }, [togglePlay])

    const toggleLoop = () => {
      const video = videoRef.current
      if (!video) return
      const newLoop = !state.isLooping
      video.loop = newLoop
      setState((prev) => ({ ...prev, isLooping: newLoop }))
    }

    const handleVolumeChange = (newVolume: number) => {
      // Optimistic update to prevent slider jumping and ensure immediate UI feedback
      setState((prev) => ({
        ...prev,
        volume: newVolume,
        isMuted: newVolume === 0, // If dragging to 0, consider it muted
      }))

      const video = videoRef.current
      if (!video) return

      // Set volume first so if we unmute, it is at the correct level
      video.volume = newVolume

      // Manage mute state based on volume
      if (newVolume > 0 && video.muted) {
        video.muted = false
      } else if (newVolume === 0 && !video.muted) {
        video.muted = true
      }
    }

    const toggleMute = () => {
      const video = videoRef.current
      if (!video) return

      const isMuted = video.muted
      if (isMuted) {
        video.muted = false
        // If volume was 0 (e.g. user dragged to 0), restore to default 0.5 so they hear something
        if (video.volume === 0) {
          video.volume = 0.5
        }
      } else {
        video.muted = true
      }
    }

    const changePlaybackRate = (rate: number) => {
      const video = videoRef.current
      if (!video) return
      video.playbackRate = rate
      setState((prev) => ({ ...prev, playbackRate: rate }))
    }

    const changeResolution = (res: DisplayTranscode) => {
      const video = videoRef.current
      if (!video) return

      if (pendingResolutionCorrectionRef.current) {
        pendingResolutionCorrectionRef.current()
        pendingResolutionCorrectionRef.current = null
      }

      if (isHls && hlsRef.current) {
        const hls = hlsRef.current
        const wasPaused = video.paused
        const targetFrame = currentFrame

        if (res.resolution === 'Auto') {
          if (state.currentResolution === 'Auto' && hls.currentLevel === -1) {
            return
          }
          hls.currentLevel = -1
          setState((prev) => ({
            ...prev,
            currentResolution: 'Auto',
          }))
        } else {
          const targetIndex = hls.levels.findIndex(
            (lvl) =>
              lvl.height === res.height ||
              Math.max(lvl.width, lvl.height) === Math.max(res.width, res.height),
          )
          if (targetIndex !== -1) {
            if (targetIndex === hls.currentLevel && state.currentResolution === res.resolution) {
              return
            }
            hls.currentLevel = targetIndex
            setState((prev) => ({
              ...prev,
              currentResolution: res.resolution,
              isCurrentHdr: res.hdr ?? false,
            }))
          }
        }

        // Guarantee frame accuracy if paused: re-nudge to safe center time once fragment is decoded
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

      const wasPlaying = !video.paused
      const currentT = video.currentTime

      setState((prev) => ({
        ...prev,
        currentResolution: res.resolution,
        currentSrc: res.url,
        isCurrentHdr: res.hdr ?? false,
      }))

      video.src = res.url || ''

      const onLoadedMetadata = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.currentTime = currentT
        if (wasPlaying) {
          const playPromise = video.play()
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              if (error.name !== 'AbortError') console.error('Play after seek failed:', error)
            })
          }
        }
        video.playbackRate = state.playbackRate
      }
      video.addEventListener('loadedmetadata', onLoadedMetadata)
    }

    const toggleFullScreen = () => {
      const rootEl = rootRef.current
      const videoEl = videoRef.current

      // 1. Standard W3C Fullscreen API (Desktop Chrome/Firefox/Safari, Android, iPadOS)
      if (rootEl && typeof rootEl.requestFullscreen === 'function') {
        if (!document.fullscreenElement) {
          rootEl.requestFullscreen().catch(() => {})
          setState((prev) => ({ ...prev, isFullScreen: true }))
        } else if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {})
          setState((prev) => ({ ...prev, isFullScreen: false }))
        }
        return
      }

      // 2. iOS WebKit native video fullscreen (iPhone Safari & Chrome)
      const webkitVideo = videoEl as
        | (HTMLVideoElement & {
            webkitEnterFullscreen?: () => void
            webkitExitFullscreen?: () => void
            webkitDisplayingFullscreen?: boolean
          })
        | null

      if (webkitVideo && typeof webkitVideo.webkitEnterFullscreen === 'function') {
        if (!webkitVideo.webkitDisplayingFullscreen) {
          try {
            webkitVideo.webkitEnterFullscreen()
          } catch (err) {
            console.error('Failed to enter iOS fullscreen:', err)
          }
        } else if (typeof webkitVideo.webkitExitFullscreen === 'function') {
          try {
            webkitVideo.webkitExitFullscreen()
          } catch (err) {
            console.error('Failed to exit iOS fullscreen:', err)
          }
        }
        return
      }

      // 3. Fallback: pseudo-fullscreen
      setState((prev) => ({ ...prev, isFullScreen: !prev.isFullScreen }))
    }

    const handleDownload = async (key: string) => {
      try {
        const res = shareId
          ? await client.api.shares[':shareId'].files[':fileId']['download-url'].$post({
              param: { shareId, fileId: data.id! },
              json: { key },
            })
          : await client.api.files['download-url'].$post({
              json: { key, assetId: data.id! },
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
    }

    // Listen for fullscreen change events (ESC key, iOS Done button)
    useEffect(() => {
      const onFsChange = () => {
        setState((prev) => ({
          ...prev,
          isFullScreen: !!document.fullscreenElement,
        }))
      }
      document.addEventListener('fullscreenchange', onFsChange)

      // iOS WebKit fullscreen events on <video>
      const videoEl = videoRef.current
      const onWebkitBeginFs = () => {
        setState((prev) => ({ ...prev, isFullScreen: true }))
      }
      const onWebkitEndFs = () => {
        setState((prev) => ({ ...prev, isFullScreen: false }))
      }
      if (videoEl) {
        videoEl.addEventListener('webkitbeginfullscreen', onWebkitBeginFs)
        videoEl.addEventListener('webkitendfullscreen', onWebkitEndFs)
      }

      return () => {
        document.removeEventListener('fullscreenchange', onFsChange)
        if (videoEl) {
          videoEl.removeEventListener('webkitbeginfullscreen', onWebkitBeginFs)
          videoEl.removeEventListener('webkitendfullscreen', onWebkitEndFs)
        }
      }
    }, [])

    // Center pan is owned by `pan` state (set by auto-fit / gestures).
    const scale = zoom

    const isMobile = useIsMobile()

    if (!hasMedia) {
      if (data.status === 'failed') {
        const errorMessage = data.media?.error
        return (
          <div
            data-testid="video-viewer-failed-state"
            className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <AlertCircle className="h-12 w-12 text-destructive/80" />
            <div className="space-y-1 max-w-md">
              <h3 className="text-base font-semibold text-foreground">
                {m.media_processing_failed()}
              </h3>
              <p className="text-sm text-muted-foreground">{m.media_processing_failed_desc()}</p>
              {errorMessage && (
                <div
                  title={errorMessage}
                  className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive text-left line-clamp-3 break-words"
                >
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        )
      }
      return (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-muted-foreground">{m.media_not_available()}</p>
        </div>
      )
    }

    return (
      <div
        ref={rootRef}
        className={cn(
          'group shadow-2xl font-sans select-none flex flex-col mx-auto relative',
          state.isFullScreen ? 'h-full w-full rounded-none bg-black' : 'w-full h-full',
          !isControlsVisible && state.isFullScreen ? 'cursor-none' : '',
        )}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex-1 flex flex-col-reverse md:flex-row min-h-0 relative">
          {/* Render Carousel/Sidebar here if not fullscreen */}
          {!state.isFullScreen && children}

          {/* Video Area */}
          <div
            ref={containerRef}
            className={cn(
              'flex-1 bg-black cursor-pointer relative flex items-center justify-center overflow-hidden min-h-0 touch-none',
            )}
            onClick={togglePlay}
            data-testid="video-area"
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
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                  transformOrigin: '0 0',
                }}
              >
                <video
                  ref={videoRef}
                  className="w-full h-full block object-contain pointer-events-none"
                  playsInline
                  preload="auto"
                  poster={data.preview?.thumbnailUrl || undefined}
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
                    state.isPlaying ? 'animate-pulse scale-110 text-primary' : '',
                  )}
                />
              </div>
            ) : (
              /* Drawing Canvas (Transparent Overlay for annotations) */
              containerSize.width > 0 && (
                <DrawingCanvas
                  width={containerSize.width}
                  height={containerSize.height}
                  mediaDimensions={{
                    width: vidW,
                    height: vidH,
                  }}
                  annotations={displayAnnotations}
                  scale={scale}
                  offset={pan}
                  className="absolute inset-0"
                  // Play/pause is handled by the video-area div's onClick; a
                  // Konva-level onClick would double-toggle once the overlay
                  // becomes interactive (zoomed).
                  // Drawing Props
                  isDrawing={isDrawing}
                  currentTool={currentTool}
                  currentColor={currentColor}
                  onAddAnnotation={addAnnotation}
                />
              )
            )}

            {/* Loading Spinner Overlay */}
            {isLoading && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10 transition-opacity duration-200"
                data-testid="video-loading-spinner"
              >
                <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>
            )}

            {/* Initial Big Play Button Overlay (shown only before playback starts) */}
            {!isLoading && !hasStartedPlaying && !isDrawing && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10 transition-opacity duration-200"
                data-testid="video-play-overlay"
              >
                <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                  <Play className="w-10 h-10 text-white ml-1 fill-white" />
                </div>
              </div>
            )}
          </div>
        </div>

        {isMobile ? (
          <MobileVideoControlBar
            state={controlBarState}
            zoom={zoom}
            isControlsVisible={isControlsVisible}
            buffered={buffered}
            data={data}
            resolutions={resolutions}
            togglePlay={togglePlay}
            toggleLoop={toggleLoop}
            toggleMute={toggleMute}
            handleVolumeChange={handleVolumeChange}
            changePlaybackRate={changePlaybackRate}
            changeResolution={changeResolution}
            handleDownload={handleDownload}
            toggleFullScreen={toggleFullScreen}
            onZoomChange={handleZoomChange}
            onZoomReset={handleZoomReset}
            frameRate={frameRate}
            totalFrames={totalFrames}
            currentFrame={currentFrame}
            seekToFrame={handleSeekToFrame}
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
            allowDownload={allowDownload}
            isLoading={isLoading}
          />
        ) : (
          <VideoControlBar
            state={controlBarState}
            zoom={zoom}
            isControlsVisible={isControlsVisible}
            buffered={buffered}
            data={data}
            resolutions={resolutions}
            togglePlay={togglePlay}
            toggleLoop={toggleLoop}
            toggleMute={toggleMute}
            handleVolumeChange={handleVolumeChange}
            changePlaybackRate={changePlaybackRate}
            changeResolution={changeResolution}
            handleDownload={handleDownload}
            toggleFullScreen={toggleFullScreen}
            onZoomChange={handleZoomChange}
            onZoomReset={handleZoomReset}
            frameRate={frameRate}
            totalFrames={totalFrames}
            currentFrame={currentFrame}
            seekToFrame={handleSeekToFrame}
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
            allowDownload={allowDownload}
            isLoading={isLoading}
          />
        )}
      </div>
    )
  },
)

export default VideoViewer
