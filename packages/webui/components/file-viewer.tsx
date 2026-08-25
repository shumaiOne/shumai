import { getViewerForFile } from './viewers/registry'
import type { FileViewerProps, MediaController } from './viewers/types'
import React, { RefObject } from 'react'

interface OuterFileViewerProps extends FileViewerProps {
  mediaControllerRef?: RefObject<MediaController | null>
}

export function FileViewer({
  file,
  mediaControllerRef,
  onPlay,
  onPause,
  onTimeUpdate,
  annotations,
  startTime,
  shareId,
  allowDownload,
  children,
}: OuterFileViewerProps) {
  const viewerDef = getViewerForFile(file)
  const ViewerComponent = viewerDef.viewer

  return (
    <div className="flex flex-col-reverse md:flex-row flex-1 h-full min-h-0 relative">
      {children}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <ViewerComponent
          key={file.id}
          ref={mediaControllerRef}
          file={file}
          onPlay={onPlay}
          onPause={onPause}
          onTimeUpdate={onTimeUpdate}
          annotations={annotations}
          startTime={startTime}
          shareId={shareId}
          allowDownload={allowDownload}
        />
      </div>
    </div>
  )
}
