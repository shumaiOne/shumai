import { WorkflowTaskType } from '@shumai/db'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import type { AssetReader } from '../types'

/** Images (including PSD): the web proxy, or a copy with the annotation drawn on top. */
export const imageReader: AssetReader<'image'> = {
  kind: 'image',
  label: 'image',
  configHint: "Pass 'imageConfig: {}' or no config",

  matches: (asset) =>
    asset.media?.proxyType === 'image' ||
    asset.mediaTypeLower.startsWith('image/') ||
    asset.filenameLower.endsWith('.psd'),

  validate() {},

  async plan(asset, _options, { annotation }) {
    const key = asset.media?.imageTranscodes?.[0]?.key || asset.storageKey
    if (!key) {
      throw new Error('No media content found for this asset.')
    }

    if (annotation?.annotations && annotation.annotations.length > 0) {
      return {
        status: 'render',
        task: {
          type: WorkflowTaskType.transcode_image_annotation,
          spec: { imageAnnotation: { annotations: annotation.annotations } },
        },
      }
    }

    return {
      status: 'ready',
      result: {
        summary: `Image asset "${asset.name}" (ID: ${asset.id}):`,
        details: [],
        images: [
          {
            key,
            label: 'Image',
            mimeType: getFileMimeType(null, key, asset.mediaType || 'image/png'),
          },
        ],
      },
    }
  },

  collect(asset, _options, output) {
    const key = typeof output.key === 'string' ? output.key : null
    if (!key) {
      throw new Error('Image annotation transcode workflow failed to output S3 key.')
    }
    return {
      summary: `Image asset "${asset.name}" (ID: ${asset.id}) with visual markups overlaid:`,
      details: [],
      images: [{ key, label: 'Image with markups', mimeType: 'image/webp' }],
    }
  },
}
