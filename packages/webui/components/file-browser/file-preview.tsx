import { File, Folder, AudioLines } from 'lucide-react'
import type { ChunkPreview, PreviewInfo } from '@shumai/dtos'
import { SpriteScrubber } from '../sprite-scrubber'
import { formatTime } from '../viewers/video/utils'

type FilePreviewItem = {
  type?: string | null
  proxyType?: 'image' | 'video' | 'audio' | 'pdf' | '3d' | null
  preview?: PreviewInfo | null
  chunkPreview?: ChunkPreview
}

interface FilePreviewProps {
  item: FilePreviewItem
  showDuration?: boolean
  focused?: boolean
  matchDuration?: {
    startTime?: number | null
    endTime?: number | null
  } | null
}

export const FilePreview = ({
  item,
  showDuration = false,
  matchDuration,
  focused,
}: FilePreviewProps) => {
  const proxyType = item.preview?.proxyType || item.proxyType
  const isVideo = proxyType === 'video'
  const isAudio = proxyType === 'audio'
  const isPdf = proxyType === 'pdf'
  const is3D = proxyType === '3d'
  const hasDuration = isVideo || isAudio
  const duration = item.preview?.duration
  const pageCount = item.preview?.pageCount

  const hasMatchedChunk =
    matchDuration != null && matchDuration.startTime != null && matchDuration.endTime != null

  const overlay = hasMatchedChunk ? (
    <span
      data-testid="file-preview-matched-duration"
      className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs font-medium tabular-nums text-white"
    >
      {formatTime(matchDuration.startTime!)} - {formatTime(matchDuration.endTime!)}
    </span>
  ) : showDuration && hasDuration && typeof duration === 'number' && duration > 0 ? (
    <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs font-medium tabular-nums text-white">
      {formatTime(duration)}
    </span>
  ) : showDuration && isPdf && typeof pageCount === 'number' && pageCount > 0 ? (
    <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs font-medium tabular-nums text-white">
      {pageCount} P
    </span>
  ) : null

  if (item.chunkPreview && hasMatchedChunk) {
    const { posterUrl, spriteUrl, frameWidth, frameHeight, columns, rows, timestamps } =
      item.chunkPreview
    const startTime = matchDuration.startTime!
    const duration = matchDuration.endTime! - startTime
    return (
      <>
        <SpriteScrubber
          active={focused || undefined}
          spriteUrl={spriteUrl}
          thumbnailUrl={posterUrl}
          videoWidth={frameWidth}
          videoHeight={frameHeight}
          columns={columns}
          rows={rows}
          frames={timestamps.map((timestamp, index) => ({
            index,
            position: (timestamp - startTime) / duration,
          }))}
        />
        {overlay}
      </>
    )
  }

  const isMediaWithSprite =
    (isVideo || isPdf || is3D) &&
    item.preview?.spriteUrl &&
    ((isVideo && hasMatchedChunk) ||
      (item.preview.thumbnailUrl && item.preview.originalWidth && item.preview.originalHeight))

  if (isMediaWithSprite && item.preview) {
    return (
      <>
        <SpriteScrubber
          active={focused || undefined}
          spriteUrl={item.preview.spriteUrl!}
          thumbnailUrl={item.preview.thumbnailUrl}
          videoWidth={item.preview.originalWidth ?? 16}
          videoHeight={item.preview.originalHeight ?? 9}
          reverse={is3D}
        />
        {overlay}
      </>
    )
  }

  if (item.preview?.thumbnailUrl) {
    return (
      <>
        <img
          src={item.preview.thumbnailUrl}
          alt="Preview"
          className="w-full h-full object-contain bg-black"
        />
        {overlay}
      </>
    )
  }

  if (isAudio) {
    return (
      <>
        <div className="w-full h-full flex items-center justify-center bg-zinc-950">
          <AudioLines className="w-8 h-8 text-zinc-500" />
        </div>
        {overlay}
      </>
    )
  }

  // Assumption: folders in latestChildren have no media type.
  if (!item.type) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-linear-to-t from-black/5 to-black/0">
        <Folder className="w-8 h-8 fill-primary/60 stroke-0" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <File className="w-8 h-8 fill-primary/60 stroke-0" />
      {overlay}
    </div>
  )
}
