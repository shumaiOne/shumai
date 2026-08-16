import { FileTypeDefinition } from '../types'
import ImageViewer from './image-viewer'
import { CompareImagePane } from './compare-image-pane'

export const imageTypeDefinition: FileTypeDefinition = {
  id: 'image',
  name: 'Image',
  match: (file) => file.proxyType === 'image',
  viewer: ImageViewer,
  comparePane: CompareImagePane,
  commentsConfig: {
    hasTimestamp: false,
    hasAnnotations: true,
  },
}
