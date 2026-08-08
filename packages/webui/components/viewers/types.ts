import type { AssetInfo } from '@shumai/dtos'
import type { Annotation } from '@/ui/types'
import type { ComparePaneHandle, PaneReportedState } from '@/ui/components/compare/types'
import type React from 'react'

export interface MediaController {
  play: () => void
  pause: () => void
  seekTo: (second: number) => void
  getCurrentTime?: () => number
  getDuration?: () => number
}

export interface FileViewerProps {
  file: AssetInfo
  annotations?: Annotation[]
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (time: number) => void
  startTime?: number
  shareId?: string
  /** When false, the viewer hides its download affordances. Defaults to true. */
  allowDownload?: boolean
  children?: React.ReactNode
}

export interface ComparePaneProps {
  file: AssetInfo
  isActive: boolean
  annotations: Annotation[]
  onStateChange: (state: PaneReportedState) => void
  onActivate: () => void
  onUserPan?: (dx: number, dy: number) => void
  shareId?: string
  muted?: boolean
  volume?: number
  onPlay?: () => void
  onTimeUpdate?: (second: number) => void
  onRequestTogglePlay?: () => void
}

export interface FileTypeDefinition {
  id: string
  name: string
  match: (file: AssetInfo) => boolean
  viewer: React.ForwardRefExoticComponent<FileViewerProps & React.RefAttributes<MediaController>>
  comparePane?: React.ForwardRefExoticComponent<
    ComparePaneProps & React.RefAttributes<ComparePaneHandle>
  >
  commentsConfig?: {
    hasTimestamp?: boolean
    hasAnnotations?: boolean
    hasAiBots?: boolean
    formatTimestamp?: (second: number) => string
  }
}
