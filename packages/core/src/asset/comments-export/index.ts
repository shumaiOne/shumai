import type { CommentExportFormat } from '@shumai/dtos'
import type { ExportAssetMetadata, ExportCommentItem, ExportOptions, ExportResult } from './types'
import { exportToFcpFioJson } from './exporters/fcp-fiojson'
import { exportToMediaComposerXml } from './exporters/media-composer-xml'
import { exportToPremiereXml } from './exporters/premiere-xml'
import { exportToResolveEdl } from './exporters/resolve-edl'

export * from './types'
export * from './timecode'
export * from './exporters/fcp-fiojson'
export * from './exporters/media-composer-xml'
export * from './exporters/premiere-xml'
export * from './exporters/resolve-edl'

export const exportCommentsToFormat = (
  metadata: ExportAssetMetadata,
  comments: ExportCommentItem[],
  format: CommentExportFormat,
  options?: ExportOptions,
): ExportResult => {
  switch (format) {
    case 'fcp-fiojson':
      return exportToFcpFioJson(metadata, comments, options)
    case 'media-composer-xml':
      return exportToMediaComposerXml(metadata, comments, options)
    case 'premiere-xml':
      return exportToPremiereXml(metadata, comments, options)
    case 'resolve-edl':
      return exportToResolveEdl(metadata, comments, options)
    default: {
      const _exhaustive: never = format
      throw new Error(`Unsupported comment export format: ${_exhaustive}`)
    }
  }
}
