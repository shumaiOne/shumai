import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { useUiStore } from '@/ui/stores/ui'
import {
  Check,
  ChevronDown,
  Maximize,
  Minimize,
  Pause,
  Play,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import ProgressBar from './progress-bar'
import { formatTime, formatTimecode } from './utils'
import type { ControlBarProps } from './video-control-bar'

export const MobileVideoControlBar: React.FC<ControlBarProps> = ({
  state,
  isControlsVisible,
  buffered,
  data,
  resolutions,
  togglePlay,
  toggleLoop,
  toggleMute,
  changePlaybackRate,
  changeResolution,
  toggleFullScreen,
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

  const overlay = state.isFullScreen && floatOverlayInFullScreen
  const isAudio = data.proxyType === 'audio'

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
          ? 'absolute bottom-0 left-0 right-0 px-3 py-3 bg-card/90 backdrop-blur-md border-t border-border'
          : 'relative w-full bg-card border-t border-border px-3 py-2.5 z-10 transition-colors duration-200',
        isControlsVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Progress Bar */}
      <div className="mb-2 px-0.5">
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

      {/* Control Row */}
      <div className="flex items-center justify-between text-foreground gap-1 select-none">
        {/* Left Side: Play, Mute, Time */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={togglePlay}
            className="p-1 hover:text-primary transition-colors cursor-pointer shrink-0"
            data-testid="play-toggle"
            data-playing={state.isPlaying}
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
          </button>

          <button
            onClick={toggleMute}
            className="p-1 hover:text-primary transition-colors cursor-pointer shrink-0"
            aria-label={state.isMuted ? 'Unmute' : 'Mute'}
          >
            {state.isMuted || state.volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          <div className="flex items-center gap-0.5 text-xs font-medium tabular-nums min-w-0">
            <span
              className="text-muted-foreground font-mono truncate text-[11px] sm:text-xs"
              data-testid="time-readout"
            >
              {displayString}
            </span>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none shrink-0"
                  aria-label="Change time format"
                >
                  <ChevronDown className="h-3 w-3" />
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

        {/* Right Side: Settings (Quality + Speed) & Fullscreen */}
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 rounded border border-border px-1.5 py-1 text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="text-[11px]">
                  {!isAudio && state.currentResolution
                    ? state.currentResolution
                    : `${state.playbackRate}x`}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 z-30">
              {!isAudio && resolutions.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {m.quality()}
                  </DropdownMenuLabel>
                  {resolutions.map((res) => (
                    <DropdownMenuItem
                      key={res.resolution}
                      onClick={() => changeResolution(res)}
                      className={cn(
                        'flex w-full items-center justify-between text-xs cursor-pointer',
                        state.currentResolution === res.resolution
                          ? 'text-primary font-medium'
                          : 'text-foreground',
                      )}
                    >
                      <span>{res.resolution === 'Original' ? m.original() : res.resolution}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {res.width}x{res.height}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Playback Speed
              </DropdownMenuLabel>
              {[0.5, 1, 1.5, 2].map((rate) => (
                <DropdownMenuItem
                  key={rate}
                  onClick={() => changePlaybackRate(rate)}
                  className={cn(
                    'flex items-center justify-between text-xs cursor-pointer',
                    state.playbackRate === rate ? 'text-primary font-medium' : 'text-foreground',
                  )}
                >
                  <span>{rate}x</span>
                  {state.playbackRate === rate && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={toggleLoop}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  <span>Loop</span>
                </span>
                {state.isLooping && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fullscreen */}
          <button
            onClick={toggleFullScreen}
            className="p-1 hover:text-primary transition-colors cursor-pointer shrink-0"
            title={m.fullscreen()}
            aria-label={m.fullscreen()}
          >
            {state.isFullScreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
