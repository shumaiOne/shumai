import { ImageControlBar } from '@/ui/components/viewers/image/image-control-bar'
import {
  VideoControlBar,
  type DisplayTranscode,
  type PlayerState,
} from '@/ui/components/viewers/video/video-control-bar'
import type { AssetInfo } from '@shumai/dtos'
import { Maximize, Minimize } from 'lucide-react'
import type { PaneReportedState } from './types'

interface CompareControlBarProps {
  activeState: PaneReportedState | null
  activeAsset: AssetInfo | null
  previewUrl?: string
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
  activeAsset,
  previewUrl,
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
  // Active side is a video: reuse the shared VideoControlBar.
  if (activeState?.kind === 'video' && activeState.video && activeAsset) {
    const v = activeState.video
    const duration = v.totalFrames / v.frameRate
    const currentTime = v.currentFrame / v.frameRate
    const state: PlayerState = {
      isPlaying: v.isPlaying,
      progress: duration > 0 ? (currentTime / duration) * 100 : 0,
      currentTime,
      duration,
      volume: v.volume,
      isMuted: v.isMuted,
      isLooping: v.isLooping,
      playbackRate: v.playbackRate,
      isFullScreen,
      showFrames: false,
      currentResolution: v.currentResolution,
    }

    // The active-side asset carries the metadata used for timecode display and
    // preview scrubbing; ensure the preview url is present for the shared bar.
    const data =
      previewUrl && !activeAsset.media?.videoPreview
        ? { ...activeAsset, media: { ...activeAsset.media, videoPreview: { url: previewUrl } } }
        : activeAsset

    return (
      <VideoControlBar
        state={state}
        zoom={activeState.zoom}
        isControlsVisible
        floatOverlayInFullScreen={false}
        buffered={v.buffered}
        data={data}
        resolutions={v.resolutions as DisplayTranscode[]}
        togglePlay={onTogglePlay}
        toggleLoop={onToggleLoop}
        toggleMute={onToggleMute}
        handleVolumeChange={onVolumeChange}
        changePlaybackRate={onChangePlaybackRate}
        changeResolution={(res: DisplayTranscode) => onChangeResolution(res.resolution)}
        handleDownload={(key?: string) => onDownload(key)}
        toggleFullScreen={onToggleFullScreen}
        onZoomChange={(nz: number) => (nz >= activeState.zoom ? onZoomIn() : onZoomOut())}
        onZoomReset={onFit}
        frameRate={v.frameRate}
        totalFrames={v.totalFrames}
        currentFrame={v.currentFrame}
        seekToFrame={onSeek}
      />
    )
  }

  // Active side is an image: reuse the shared ImageControlBar.
  if (activeState?.kind === 'image') {
    return (
      <ImageControlBar
        zoom={activeState.zoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFit={onFit}
        onDownload={() => onDownload()}
        canDownload={!!activeAsset?.media?.original?.key}
        fullscreen={{ isFullScreen, onToggle: onToggleFullScreen }}
      />
    )
  }

  // Unsupported / not yet loaded: only expose fullscreen.
  return (
    <div className="relative z-10 flex items-center justify-end gap-2 border-t border-border bg-card px-4 py-3">
      <button
        onClick={onToggleFullScreen}
        className="text-foreground transition-colors hover:text-primary"
        title="Fullscreen"
      >
        {isFullScreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  )
}
