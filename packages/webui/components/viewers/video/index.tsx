import { FileTypeDefinition } from '../types'
import VideoViewer from './video-viewer'
import { CompareVideoPane } from './compare-video-pane'

export const videoTypeDefinition: FileTypeDefinition = {
  id: 'video',
  name: 'Video',
  match: (file) => !!file.mediaType?.startsWith('video/'),
  viewer: VideoViewer,
  comparePane: CompareVideoPane,
  commentsConfig: {
    hasTimestamp: true,
    hasAnnotations: true,
    hasAiBots: true,
  },
}
