import { FileTypeDefinition } from '../types'
import PdfViewer from './pdf-viewer'

export const pdfTypeDefinition: FileTypeDefinition = {
  id: 'pdf',
  name: 'PDF',
  match: (file) => file.proxyType === 'pdf',
  viewer: PdfViewer,
  commentsConfig: {
    hasTimestamp: true,
    hasAnnotations: true,
    formatTimestamp: (second: number) => `P${Math.round(second)}`,
  },
}
