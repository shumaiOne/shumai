import { FileTypeDefinition } from '../types'
import PdfViewer from './pdf-viewer'

export const pdfTypeDefinition: FileTypeDefinition = {
  id: 'pdf',
  name: 'PDF',
  match: (file) => file.mediaType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
  viewer: PdfViewer,
  commentsConfig: {
    hasTimestamp: false,
    hasAnnotations: true,
    hasAiBots: true,
  },
}
