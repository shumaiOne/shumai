import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { Slider } from '@/ui/components/ui/slider'
import { cn } from '@/ui/lib/utils'
import ProgressBar from '@/ui/components/viewers/progress-bar'
import { formatTime, formatTimecode } from '@/ui/components/viewers/utils'
import { useUiStore } from '@/ui/stores/ui'
import type { MediaMetadata } from '@shumai/dtos'
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
import type { PaneReportedState } from './types'

const PLAYBACK_RATES = [0.5, 1, 1.5, 2]

interface CompareControlBarProps {
  activeState: PaneReportedState | null
  previewUrl?: string
  metadata?: MediaMetadata
  startTimecode?: string | null
  isFullScreen: boolean
  onTogglePlay: () => void
  onToggleLoop: () => void
  onSeek: (frame: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onChangePlaybackRate: (rate: number) => void
  onChangeResolution: (resolution: string) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onDownload: (key?: string) => void
  onToggleFullScreen: () => void
}

export function CompareControlBar({
  activeState,
  previewUrl,
  metadata,
  startTimecode,
  isFullScreen,
  onTogglePlay,
  onToggleLoop,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onChangePlaybackRate,
  onChangeResolution,
  onZoomIn,
  onZoomOut,
  onFit,
  onDownload,
  onToggleFullScreen,
}: CompareControlBarProps) {
  const { videoTimeDisplayMode, setVideoTimeDisplayMode } = useUiStore()

  const fullscreenButton = (
    <button
      onClick={onToggleFullScreen}
      className="text-foreground transition-colors hover:text-primary"
      title="Fullscreen"
    >
      {isFullScreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
    </button>
  )

  const zoomControls = (
    <div className="mr-auto flex items-center gap-1 rounded-md bg-muted/60 p-0.5">
      <button
        onClick={onZoomOut}
        className="rounded p-1.5 text-foreground transition-colors hover:bg-muted"
        title="Zoom Out"
      >
        <Minus size={16} />
      </button>
      <span className="w-12 text-center font-mono text-xs font-medium text-foreground select-none">
        {Math.round((activeState?.zoom ?? 1) * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        className="rounded p-1.5 text-foreground transition-colors hover:bg-muted"
        title="Zoom In"
      >
        <Plus size={16} />
      </button>
      <button
        onClick={onFit}
        className="rounded px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        Fit
      </button>
    </div>
  )

  // Image (or unsupported) control bar
  if (!activeState || activeState.kind !== 'video' || !activeState.video) {
    return (
      <div className="relative z-10 flex items-center justify-end gap-2 border-t border-border bg-card px-4 py-3">
        {activeState?.kind === 'image' && zoomControls}
        {activeState?.kind === 'image' && (
          <button
            onClick={() => onDownload()}
            className="flex items-center gap-1.5 rounded bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            title="Download"
          >
            <Download size={14} />
            Download
          </button>
        )}
        {fullscreenButton}
      </div>
    )
  }

  const video = activeState.video
  const displayTotalFrames = Math.max(0, video.totalFrames - 1)
  const displayString =
    videoTimeDisplayMode === 'frames'
      ? `${video.currentFrame} / ${displayTotalFrames} fr`
      : videoTimeDisplayMode === 'standard'
        ? `${formatTimecode(video.currentFrame, video.frameRate, 'standard')} / ${formatTime(video.totalFrames / video.frameRate)}`
        : `${formatTimecode(video.currentFrame, video.frameRate, videoTimeDisplayMode, startTimecode)} / ${formatTimecode(displayTotalFrames, video.frameRate, videoTimeDisplayMode, startTimecode)}`

  const cycleTimeDisplay = () => {
    const modes: Array<'standard' | 'timecode' | 'frames'> = ['standard', 'timecode', 'frames']
    const idx = modes.indexOf(videoTimeDisplayMode as 'standard' | 'timecode' | 'frames')
    setVideoTimeDisplayMode(modes[(idx + 1) % modes.length])
  }

  const previewResolutions = video.resolutions.filter((r) => !r.isRaw)

  return (
    <div className="relative z-10 flex flex-col gap-2 border-t border-border bg-card px-4 py-2">
      <ProgressBar
        totalFrames={video.totalFrames}
        currentFrame={video.currentFrame}
        fps={video.frameRate}
        previewUrl={previewUrl}
        onSeek={onSeek}
        buffered={video.buffered}
        metadata={metadata}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          className="text-foreground transition-colors hover:text-primary"
          title={video.isPlaying ? 'Pause' : 'Play'}
        >
          {video.isPlaying ? (
            <Pause className="h-6 w-6 fill-current" />
          ) : (
            <Play className="h-6 w-6 fill-current" />
          )}
        </button>

        <button
          onClick={onToggleLoop}
          className={cn(
            'transition-colors hover:text-primary',
            video.isLooping ? 'text-primary' : 'text-foreground',
          )}
          title="Loop"
        >
          <Repeat className="h-5 w-5" />
        </button>

        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMute}
            className="text-foreground transition-colors hover:text-primary"
            title={video.isMuted ? 'Unmute' : 'Mute'}
          >
            {video.isMuted || video.volume === 0 ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          <Slider
            value={[video.isMuted ? 0 : video.volume]}
            max={1}
            step={0.05}
            onValueChange={(vals) => onVolumeChange(vals[0] ?? 0)}
            className="w-20"
          />
        </div>

        <button
          onClick={cycleTimeDisplay}
          className="font-mono text-xs font-medium text-foreground tabular-nums"
          title="Toggle time display"
        >
          {displayString}
        </button>

        <div className="ml-auto flex items-center gap-3">
          {zoomControls}

          {/* Playback rate */}
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded border border-border px-2 py-0.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
              {video.playbackRate}x
            </DropdownMenuTrigger>
            <DropdownMenuContent className="flex flex-col">
              {PLAYBACK_RATES.map((rate) => (
                <DropdownMenuItem
                  key={rate}
                  onClick={() => onChangePlaybackRate(rate)}
                  className={cn(
                    'px-2 py-1 text-xs',
                    video.playbackRate === rate
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground',
                  )}
                >
                  {rate}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Resolution */}
          {previewResolutions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                <Settings className="h-3.5 w-3.5" />
                <span>{video.currentResolution}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Quality</DropdownMenuLabel>
                {previewResolutions.map((res) => (
                  <DropdownMenuItem
                    key={res.resolution}
                    onClick={() => onChangeResolution(res.resolution)}
                    className={cn(
                      'flex w-full items-center justify-between',
                      video.currentResolution === res.resolution
                        ? 'font-medium text-primary'
                        : 'text-foreground',
                    )}
                  >
                    <span>{res.resolution}</span>
                    <span className="pl-5 text-xs text-muted-foreground">
                      {res.width}x{res.height}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Download */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="text-foreground transition-colors hover:text-primary"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Download</DropdownMenuLabel>
              {video.resolutions.map((res) => (
                <DropdownMenuItem
                  key={res.resolution}
                  onClick={() => onDownload(res.key)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm text-foreground"
                >
                  <span>{res.resolution}</span>
                  <span className="text-xs text-muted-foreground">{res.isRaw ? 'RAW' : 'MP4'}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {fullscreenButton}
        </div>
      </div>
    </div>
  )
}
