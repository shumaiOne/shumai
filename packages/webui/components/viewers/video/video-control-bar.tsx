import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { useUiStore } from '@/ui/stores/ui'
import type { AssetInfo, VideoTranscode } from '@shumai/dtos'
import {
  Check,
  ChevronDown,
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
import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { Slider } from '../../ui/slider'
import ProgressBar from './progress-bar'
import { formatTime, formatTimecode } from './utils'

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

export type DisplayTranscode = VideoTranscode & { resolution: string }

export interface ControlBarProps {
  state: PlayerState
  zoom: number
  isControlsVisible: boolean
  buffered: number
  data: AssetInfo
  resolutions: DisplayTranscode[]
  togglePlay: () => void
  toggleLoop: () => void
  toggleMute: () => void
  handleVolumeChange: (newVolume: number) => void
  changePlaybackRate: (rate: number) => void
  changeResolution: (res: DisplayTranscode) => void
  handleDownload: (key: string) => void
  toggleFullScreen: () => void
  onZoomChange: (zoom: number) => void
  onZoomReset: () => void
  // Frame-accurate props
  frameRate: number
  totalFrames: number
  currentFrame: number
  seekToFrame: (frame: number) => Promise<void> | void
  /**
   * Whether the bar floats as an absolute overlay over the media while
   * fullscreen (single-file player). Compare mode sets this false so the bar
   * stays in-flow. Colors are always theme-aware regardless of this flag.
   */
  floatOverlayInFullScreen?: boolean
  /** Fired when the cursor enters/leaves the bar (used to pin it visible). */
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export const VideoControlBar: React.FC<ControlBarProps> = ({
  state,
  zoom,
  isControlsVisible,
  buffered,
  data,
  resolutions,
  togglePlay,
  toggleLoop,
  toggleMute,
  handleVolumeChange,
  changePlaybackRate,
  changeResolution,
  handleDownload,
  toggleFullScreen,
  onZoomChange,
  onZoomReset,
  frameRate,
  totalFrames,
  currentFrame,
  seekToFrame,
  floatOverlayInFullScreen = true,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { videoTimeDisplayMode, setVideoTimeDisplayMode } = useUiStore()

  if (!data.media?.metadata) {
    return null
  }

  // Whether to render the bar as a floating overlay over the media (single-file
  // fullscreen). Compare keeps it in-flow. Colors stay theme-aware either way.
  const overlay = state.isFullScreen && floatOverlayInFullScreen

  const isAudio = data.mediaType?.startsWith('audio/')
  const previewResolutions = resolutions.filter((r) => !r.isRaw)

  const startTimecode = data.media?.metadata?.startTimecode
  const displayTotalFrames = Math.max(0, totalFrames - 1)
  const displayString =
    videoTimeDisplayMode === 'frames'
      ? `${currentFrame} / ${displayTotalFrames} fr`
      : videoTimeDisplayMode === 'standard'
        ? `${formatTimecode(currentFrame, frameRate, 'standard')} / ${formatTime(totalFrames / frameRate)}`
        : `${formatTimecode(currentFrame, frameRate, videoTimeDisplayMode, startTimecode)} / ${formatTimecode(displayTotalFrames, frameRate, videoTimeDisplayMode, startTimecode)}`

  return (
    <div
      className={cn(
        'transition-all duration-300 ease-in-out z-20 text-foreground',
        overlay
          ? 'absolute bottom-0 left-0 right-0 px-4 py-4 bg-card/90 backdrop-blur-md border-t border-border'
          : 'relative w-full bg-card border-t border-border px-4 py-3 z-10 transition-colors duration-200',
        isControlsVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Progress Bar */}
      <div className="mb-4 px-1">
        <ProgressBar
          totalFrames={totalFrames}
          currentFrame={currentFrame}
          fps={frameRate}
          buffered={buffered}
          previewUrl={data.media.videoPreview?.url}
          onSeek={seekToFrame}
          metadata={{
            ...data.media.metadata,
            frameRate: frameRate,
          }}
        />
      </div>

      {/* Lower Controls Row */}
      <div className="flex items-center justify-between text-foreground">
        {/* Left Side: Play, Vol, Time */}
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="hover:text-primary transition-colors"
            data-testid="play-toggle"
            data-playing={state.isPlaying}
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current" />
            )}
          </button>

          <button
            onClick={toggleLoop}
            className={cn(
              'transition-colors',
              state.isLooping ? 'text-primary' : 'text-muted-foreground',
            )}
            title="Loop"
          >
            <Repeat className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 group/vol">
            <button onClick={toggleMute} className="hover:text-primary">
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
                  onValueChange={(v: number[]) => handleVolumeChange(v[0])}
                  max={1}
                  step={0.05}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm font-medium tabular-nums select-none min-w-[100px]">
            <span className="text-muted-foreground font-mono" data-testid="time-readout">
              {displayString}
            </span>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 z-30">
                <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Format
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setVideoTimeDisplayMode('standard')}
                  className="flex items-center justify-between cursor-pointer text-xs"
                >
                  <span>Standard Time</span>
                  {videoTimeDisplayMode === 'standard' && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setVideoTimeDisplayMode('frames')}
                  className="flex items-center justify-between cursor-pointer text-xs"
                >
                  <span>Frames</span>
                  {videoTimeDisplayMode === 'frames' && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setVideoTimeDisplayMode('timecode')}
                  className="flex items-center justify-between cursor-pointer text-xs"
                >
                  <span>Timecode</span>
                  {videoTimeDisplayMode === 'timecode' && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Right Side: Zoom, Speed, Res, Download, Fullscreen */}
        <div className="relative flex items-center gap-3">
          {/* Zoom Controls */}
          {!isAudio && (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
                <button
                  onClick={() => onZoomChange(zoom * 0.8)}
                  className="p-1 hover:text-primary rounded"
                  title={m.zoom_out()}
                >
                  <Minus size={14} />
                </button>
                <span className="text-xs w-8 text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => onZoomChange(zoom * 1.2)}
                  className="p-1 hover:text-primary rounded"
                  title={m.zoom_in()}
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={onZoomReset}
                className="text-xs font-medium px-2 py-1 rounded bg-muted hover:text-primary transition-colors"
              >
                {m.fit()}
              </button>
            </div>
          )}

          {/* Playback Rate */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 text-sm font-bold hover:text-primary">
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
                      ? 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground'
                      : 'text-foreground',
                  )}
                >
                  {rate}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings / Resolution */}
          {!isAudio && previewResolutions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-sm font-semibold hover:bg-muted transition-colors">
                  <Settings className="h-3.5 w-3.5" />
                  <span>
                    {state.currentResolution === 'Original'
                      ? m.original()
                      : state.currentResolution}
                  </span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuLabel>{m.quality()}</DropdownMenuLabel>
                {previewResolutions.map((res) => (
                  <DropdownMenuItem
                    key={res.resolution}
                    onClick={() => changeResolution(res)}
                    className={cn(
                      'flex w-full items-center justify-between',
                      state.currentResolution === res.resolution
                        ? 'text-primary font-medium'
                        : 'text-foreground',
                    )}
                  >
                    <span>{res.resolution === 'Original' ? m.original() : res.resolution}</span>
                    <span className="pl-5 text-xs text-muted-foreground">
                      {res.width}x{res.height}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Download */}
          {isAudio ? (
            <button
              onClick={() => handleDownload(data.media?.original?.key || '')}
              className="transition-colors hover:text-primary"
              title={m.download()}
              disabled={!data.media?.original?.key}
            >
              <Download className="h-5 w-5" />
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="transition-colors hover:text-primary" title={m.download()}>
                  <Download className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{m.download()}</DropdownMenuLabel>
                {resolutions.map((res) => (
                  <DropdownMenuItem
                    key={res.resolution}
                    onClick={() => handleDownload(res.key ?? '')}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground"
                  >
                    <span>{res.resolution === 'Original' ? m.original() : res.resolution}</span>
                    <span className="text-xs text-muted-foreground">
                      {res.isRaw ? data.name?.split('.').pop()?.toUpperCase() || 'RAW' : 'MP4'}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Fullscreen */}
          <button
            onClick={toggleFullScreen}
            className="transition-colors hover:text-primary"
            title={m.fullscreen()}
          >
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
