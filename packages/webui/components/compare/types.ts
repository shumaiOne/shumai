import type { VideoTranscode } from '@shumai/dtos'

export type PaneKind = 'image' | 'video' | 'unsupported'

export type CompareSide = 'left' | 'right'

export type DisplayTranscode = VideoTranscode & { resolution: string }

/**
 * Reactive state a pane reports upward so the shared control bar can render.
 * `video` is populated only for video panes.
 */
export interface PaneReportedState {
  kind: PaneKind
  zoom: number
  video?: {
    frameRate: number
    totalFrames: number
    currentFrame: number
    isPlaying: boolean
    volume: number
    isMuted: boolean
    playbackRate: number
    isLooping: boolean
    currentResolution: string
    resolutions: DisplayTranscode[]
    buffered: number
  }
}

/**
 * Imperative command surface exposed by each pane via ref. The shared control
 * bar dispatches to the active pane (and, when media types match, to both).
 */
export interface ComparePaneHandle {
  getKind: () => PaneKind
  // Playback (video only; no-ops for images)
  play: () => void
  pause: () => void
  togglePlay: () => void
  seekToFrame: (frame: number) => void
  seekToSecond: (second: number) => void
  stepFrame: (delta: number) => void
  setMuted: (muted: boolean) => void
  setVolume: (volume: number) => void
  setPlaybackRate: (rate: number) => void
  toggleLoop: () => void
  changeResolution: (resolution: string) => void
  // Zoom / pan (image + video)
  zoomBy: (factor: number) => void
  fit: () => void
  panBy: (dx: number, dy: number) => void
  // Download active side's original/selected media
  download: (key?: string) => void
}
