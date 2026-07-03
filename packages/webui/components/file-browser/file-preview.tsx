import { File, Folder } from 'lucide-react'
import { SpriteScrubber } from '../sprite-scrubber'
import { formatTime } from '../viewers/utils'

type FilePreviewItem = {
  type?: string | null
  preview?: {
    mediaType?: string | null
    spriteUrl?: string
    thumbnailUrl?: string
    originalWidth?: number
    originalHeight?: number
    duration?: number
  } | null
}

interface FilePreviewProps {
  item: FilePreviewItem
  showDuration?: boolean
}

export const FilePreview = ({ item, showDuration = false }: FilePreviewProps) => {
  const isVideo = item.preview?.mediaType?.startsWith('video/')
  const duration = item.preview?.duration
  const durationOverlay =
    showDuration && isVideo && typeof duration === 'number' && duration > 0 ? (
      <span className="pointer-events-none absolute bottom-1 right-1 text-xs font-medium tabular-nums text-white">
        {formatTime(duration)}
      </span>
    ) : null

  const isVideoWithSprite =
    isVideo &&
    item.preview?.spriteUrl &&
    item.preview.thumbnailUrl &&
    item.preview.originalWidth &&
    item.preview.originalHeight

  if (isVideoWithSprite && item.preview) {
    return (
      <>
        <SpriteScrubber
          spriteUrl={item.preview.spriteUrl!}
          thumbnailUrl={item.preview.thumbnailUrl!}
          videoWidth={item.preview.originalWidth!}
          videoHeight={item.preview.originalHeight!}
        />
        {durationOverlay}
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
        {durationOverlay}
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
