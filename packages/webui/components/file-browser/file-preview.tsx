import { File, Folder } from 'lucide-react'
import { SpriteScrubber } from '../sprite-scrubber'

type FilePreviewItem = {
  type?: string | null
  preview?: {
    mediaType?: string | null
    spriteUrl?: string
    thumbnailUrl?: string
    originalWidth?: number
    originalHeight?: number
  } | null
}

interface FilePreviewProps {
  item: FilePreviewItem
}

export const FilePreview = ({ item }: FilePreviewProps) => {
  const isVideoWithSprite =
    item.preview?.mediaType?.startsWith('video/') &&
    item.preview.spriteUrl &&
    item.preview.thumbnailUrl &&
    item.preview.originalWidth &&
    item.preview.originalHeight

  if (isVideoWithSprite && item.preview) {
    return (
      <SpriteScrubber
        spriteUrl={item.preview.spriteUrl!}
        thumbnailUrl={item.preview.thumbnailUrl!}
        videoWidth={item.preview.originalWidth!}
        videoHeight={item.preview.originalHeight!}
      />
    )
  }

  if (item.preview?.thumbnailUrl) {
    return (
      <img
        src={item.preview.thumbnailUrl}
        alt="Preview"
        className="w-full h-full object-contain bg-black"
      />
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
