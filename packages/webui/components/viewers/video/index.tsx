import { FileTypeDefinition } from '../types'
import VideoViewer from './video-viewer'
import { CompareVideoPane } from './compare-video-pane'

export const videoTypeDefinition: FileTypeDefinition = {
  id: 'video',
  name: 'Video',
  match: (file) => file.proxyType === 'video' || file.proxyType === 'audio',
  viewer: VideoViewer,
  comparePane: CompareVideoPane,
  commentsConfig: {
    hasTimestamp: true,
    hasAnnotations: true,
  },
}
