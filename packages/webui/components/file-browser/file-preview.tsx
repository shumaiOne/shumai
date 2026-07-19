import { File, Folder, AudioLines } from 'lucide-react'
import { SpriteScrubber } from '../sprite-scrubber'
import { formatTime } from '../viewers/video/utils'

type FilePreviewItem = {
  type?: string | null
  proxyType?: 'image' | 'video' | 'audio' | 'pdf' | null
  preview?: {
    mediaType?: string | null
    proxyType?: 'image' | 'video' | 'audio' | 'pdf' | null
    spriteUrl?: string
    thumbnailUrl?: string
    originalWidth?: number
    originalHeight?: number
    duration?: number
    pageCount?: number
  } | null
}

interface FilePreviewProps {
  item: FilePreviewItem
  showDuration?: boolean
}

export const FilePreview = ({ item, showDuration = false }: FilePreviewProps) => {
  const proxyType = item.preview?.proxyType || item.proxyType
  const isVideo = proxyType === 'video'
  const isAudio = proxyType === 'audio'
  const isPdf = proxyType === 'pdf'
  const hasDuration = isVideo || isAudio
  const duration = item.preview?.duration
  const pageCount = item.preview?.pageCount

  const overlay =
    showDuration && hasDuration && typeof duration === 'number' && duration > 0 ? (
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs font-medium tabular-nums text-white">
        {formatTime(duration)}
      </span>
    ) : showDuration && isPdf && typeof pageCount === 'number' && pageCount > 0 ? (
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-xs font-medium tabular-nums text-white">
        {pageCount} P
      </span>
    ) : null

  const isMediaWithSprite =
    (isVideo || isPdf) &&
    item.preview?.spriteUrl &&
    item.preview.thumbnailUrl &&
    item.preview.originalWidth &&
    item.preview.originalHeight

  if (isMediaWithSprite && item.preview) {
    return (
      <>
        <SpriteScrubber
          spriteUrl={item.preview.spriteUrl!}
          thumbnailUrl={item.preview.thumbnailUrl!}
          videoWidth={item.preview.originalWidth!}
          videoHeight={item.preview.originalHeight!}
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
    <div className="w-full h-full flex items-center justify-center">
      <File className="w-8 h-8 fill-primary/60 stroke-0" />
    </div>
  )
}
