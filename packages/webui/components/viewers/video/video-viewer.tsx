import { client } from '@/ui/api/client'
import { cn } from '@/ui/lib/utils'
import { Play, AudioLines } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState, useImperativeHandle } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import { useFramePlayer } from './use-frame-player'
import { resolveTotalFrames } from './utils'
import { VideoControlBar, type PlayerState, type DisplayTranscode } from './video-control-bar'
import { MobileVideoControlBar } from './mobile-video-control-bar'
import { useIsMobile } from '@/ui/hooks/use-mobile'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
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
    },
    ref,
  ) => {
    const localPlayerRef = useRef<Player | null>(null)
    const playerRef = localPlayerRef
    const resolutions: DisplayTranscode[] = (data.media?.videoTranscodes ?? []).map((t) => {
      const longSide = Math.max(t.width, t.height)
      let resolution = `${t.height}p`
      if (longSide >= 3840) resolution = '2160p'
      else if (longSide >= 1920) resolution = '1080p'
      else if (longSide >= 1280) resolution = '720p'
      else if (longSide >= 960) resolution = '540p'
      else if (longSide >= 640) resolution = '360p'
      else if (longSide >= 320) resolution = '180p'

      return {
        ...t,
        resolution,
      }
    })
    // Only transcoded proxy versions are ever displayed; the raw original file
    // is never used as a playback source.
    const hasMedia = resolutions.length > 0 && !!data.media?.metadata
    // We use a container ref to manually append the video element
    const videoContainerRef = useRef<HTMLDivElement>(null)

    // Logic to select best resolution based on screen size
    const getInitialResolution = (): DisplayTranscode | null => {
      if (resolutions.length === 0) return null

      if (typeof window === 'undefined') return resolutions[0]

      // Use device pixel ratio for high DPI screens
      const screenWidth = window.innerWidth * (window.devicePixelRatio || 1)

      // 1. Sort by width ascending
      const sortedResolutions = [...resolutions].sort((a, b) => {
        const wA = a.width ?? 0
        const wB = b.width ?? 0
        return wA - wB
      })

      // 2. Find first one >= screenWidth
      const bestFit = sortedResolutions.find((r) => (r.width ?? 0) >= screenWidth)

      // 3. If found, return it. If not (all are smaller), return the last one (largest).
      return bestFit || sortedResolutions[sortedResolutions.length - 1]
    }

    const initialRes = getInitialResolution()

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
      currentResolution: initialRes?.resolution ?? '',
      currentSrc: initialRes?.url ?? '',
    })
    const containerRef = useRef<HTMLDivElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useImperativeHandle(ref, () => ({
      play: () => {
        if (localPlayerRef.current) {
          localPlayerRef.current.play()
        }
      },
      pause: () => {
        if (localPlayerRef.current) {
          localPlayerRef.current.pause()
        }
      },
      seekTo: (second: number) => {
        if (localPlayerRef.current) {
          localPlayerRef.current.currentTime(second)
        }
      },
      getCurrentTime: () => {
        return (localPlayerRef.current ? localPlayerRef.current.currentTime() : 0) ?? 0
      },
      getDuration: () => {
        return (localPlayerRef.current ? localPlayerRef.current.duration() : 0) ?? 0
      },
    }))
    const isOverControlsRef = useRef(false)

    const [videoHtmlEl, setVideoHtmlEl] = useState<HTMLVideoElement | undefined>(undefined)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [hasManuallyZoomed, setHasManuallyZoomed] = useState(false)
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

    useEffect(() => {
      const res = getInitialResolution()
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
        duration: data.media?.metadata?.duration || 0,
        currentResolution: res?.resolution ?? '',
        currentSrc: res?.url ?? '',
      }))
      setHasManuallyZoomed(false)
      setIsPlayerReady(false)
      setBuffered(0)
      lastProcessedStartTimeRef.current = null
    }, [data.id])

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
    const lastProcessedStartTimeRef = useRef<number | null>(null)

    // Frame-accurate hook and derived state
    const metadata = data.media?.metadata
    const frameRate = metadata?.frameRate || 30
    const dbTotalFrames = metadata?.totalFrames || 0
    const containerDuration = metadata?.duration || 0

    const isAudio = data.proxyType === 'audio'
    const totalFrames = resolveTotalFrames({ dbTotalFrames, containerDuration, frameRate })
    const { currentFrame, seekToFrame } = useFramePlayer(videoRef, frameRate, totalFrames, isAudio)

    const currentTime = currentFrame / frameRate
    const duration = totalFrames / frameRate
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    const controlBarState: PlayerState = {
      ...state,
      currentTime,
      duration,
      progress,
    }

    // Trigger time update event reactively
    useEffect(() => {
      if (onTimeUpdate) {
        onTimeUpdate(currentFrame / frameRate)
      }
    }, [currentFrame, frameRate, onTimeUpdate])

    // Initialize Video.js
    useEffect(() => {
      if (!videoContainerRef.current) return

      const initialRes = getInitialResolution()
      const targetSrc = initialRes?.url ?? ''
      if (!targetSrc) return

      // Clean up previous player if exists
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
        videoRef.current = null
      }

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
            src: targetSrc,
            type: 'video/mp4',
          },
        ],
      }))

      // Extract video element for Konva
      const htmlVid = videoElement.querySelector('video')
      if (htmlVid) {
        setVideoHtmlEl(htmlVid)
        videoRef.current = htmlVid
      } else {
        // Fallback: try player.tech().el()
        // Wait for ready?
        player.ready(() => {
          const techEl = player.tech({ iWillNotUseThisInPlugins: true })?.el() as HTMLVideoElement
          if (techEl) {
            setVideoHtmlEl(techEl)
            videoRef.current = techEl
          }
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
      player.on('loadedmetadata', () => {
        setIsPlayerReady(true)
      })
      player.on('loadstart', () => {
        setIsPlayerReady(false)
      })

      player.on('timeupdate', () => {
        const playerDuration = player.duration() || data.media?.metadata?.duration || 0

        const bufferedEnd = player.bufferedEnd()
        if (playerDuration > 0) {
          setBuffered((bufferedEnd / playerDuration) * 100)
        }
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
          videoRef.current = null
        }
      }
    }, [data.id])

    // Handle changes to startTime (e.g., clicking different chunks in search results)
    useEffect(() => {
      if (!isPlayerReady) return

      if (startTime !== undefined && startTime !== null && startTime > 0) {
        if (startTime !== lastProcessedStartTimeRef.current) {
          lastProcessedStartTimeRef.current = startTime
          const targetFrame = Math.floor(startTime * frameRate + 0.45)
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
      const player = playerRef.current
      if (!player) return
      const newLoop = !state.isLooping
      player.loop(newLoop)
      setState((prev) => ({ ...prev, isLooping: newLoop }))
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
      const currentT = player.currentTime()

      setState((prev) => ({
        ...prev,
        currentResolution: res.resolution,
        currentSrc: res.url,
      }))

      player.src({ type: 'video/mp4', src: res.url })

      player.one('loadedmetadata', () => {
        player.currentTime(currentT)
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
      if (!rootRef.current) return
      if (!document.fullscreenElement) {
        rootRef.current.requestFullscreen()
        setState((prev) => ({ ...prev, isFullScreen: true }))
      } else {
        document.exitFullscreen()
        setState((prev) => ({ ...prev, isFullScreen: false }))
      }
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

    // Center pan is owned by `pan` state (set by auto-fit / gestures).
    const scale = zoom

    const isMobile = useIsMobile()

    if (!hasMedia) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-muted-foreground">Media is not available.</p>
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
            data-vjs-player
            data-testid="video-area"
          >
            {/* Hidden VideoJS container */}
            <div ref={videoContainerRef} className="absolute inset-0 z-[-1]" />

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
              /* Drawing Canvas (Visible) */
              videoHtmlEl &&
              containerSize.width > 0 && (
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

            {/* Big Play Button Overlay (when paused) */}
            {!state.isPlaying && !isDrawing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
                <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30 animate-pulse">
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
            seekToFrame={seekToFrame}
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
            allowDownload={allowDownload}
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
            seekToFrame={seekToFrame}
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
            allowDownload={allowDownload}
          />
        )}
      </div>
    )
  },
)

export default VideoViewer
