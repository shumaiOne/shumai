import { FileTypeDefinition } from '../types'
import ModelViewer from './model-viewer'

import { secondToDegree } from './utils'
export { secondToDegree } from './utils'

export const modelTypeDefinition: FileTypeDefinition = {
  id: '3d',
  name: '3D Model',
  match: (file) => file.proxyType === '3d',
  viewer: ModelViewer,
  commentsConfig: {
    hasTimestamp: true,
    hasAnnotations: true,
    formatTimestamp: (second: number) => {
      const deg = secondToDegree(second)
      return `${deg}°`
    },
  },
}
