import { FileTypeDefinition } from '../types'
import DefaultViewer from './default-viewer'

export const defaultTypeDefinition: FileTypeDefinition = {
  id: 'default',
  name: 'Default',
  match: () => true,
  viewer: DefaultViewer,
  commentsConfig: {
    hasTimestamp: false,
    hasAnnotations: false,
  },
}
