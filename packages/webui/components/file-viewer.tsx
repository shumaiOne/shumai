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
    <ViewerComponent
      key={viewerDef.id}
      ref={mediaControllerRef}
      file={file}
      onPlay={onPlay}
      onPause={onPause}
      onTimeUpdate={onTimeUpdate}
      annotations={annotations}
      startTime={startTime}
      shareId={shareId}
      allowDownload={allowDownload}
    >
      {children}
    </ViewerComponent>
  )
}
