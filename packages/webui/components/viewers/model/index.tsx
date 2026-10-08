import { FileTypeDefinition } from '../types'
import ModelViewer from './model-viewer'

export function secondToDegree(second: number): number {
  const frameIndex = Math.min(Math.max(0, Math.floor(second * 6)), 23)
  return frameIndex * 15
}

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
