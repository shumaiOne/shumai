import { MAX_RENDER_ITEMS } from '@shumai/operations'
import { WorkflowTaskType } from '@shumai/db'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import { badRequest, type AssetReader } from '../types'

/** Videos: evenly spaced frames between `start` and `end`, rendered by the screenshot workflow. */
export const videoReader: AssetReader<'video'> = {
  kind: 'video',
  label: 'video',
  configHint: "Pass 'videoConfig: { start, end, count }'",

  matches: (asset) =>
    asset.media?.proxyType === 'video' || asset.mediaTypeLower.startsWith('video/'),

  validate(_asset, options) {
    if (!options) {
      throw badRequest(
        'videoConfig with start, end, and count is required when inspecting video assets.',
      )
    }
    const { start, end, count } = options
    if (start < 0 || end < 0) {
      throw badRequest('Invalid video time range: start and end must be non-negative numbers.')
    }
    if (start > end) {
      throw badRequest(
        `Invalid video time range: start (${start}) must be less than or equal to end (${end}).`,
      )
    }
    if (count < 1) {
      throw badRequest(`Invalid frame count: count (${count}) must be at least 1.`)
    }
    if (count > MAX_RENDER_ITEMS) {
      throw badRequest(
        `Invalid frame count: count (${count}) exceeds the maximum of ${MAX_RENDER_ITEMS} frames per request. Read a shorter range or fewer frames per call.`,
      )
    }
  },

  async plan(_asset, options, { annotation }) {
    // validate() guarantees options are present
    const { start, end, count } = options!
    return {
      status: 'render',
      task: {
        type: WorkflowTaskType.transcode_screenshot,
        spec: {
          screenshot: {
            start,
            end,
            count,
            commentTimestamp: annotation?.timestamp ?? null,
            annotations: annotation?.annotations ?? null,
          },
        },
      },
    }
  },

  collect(asset, options, output) {
    const screenshots = output.screenshots as Array<{ key: string; timestamp: number }> | undefined
    if (!screenshots || screenshots.length === 0) {
      throw new Error('No screenshots were generated.')
    }
    return {
      summary: `Extracted ${screenshots.length} frame(s) from "${asset.name}" (${options!.start}s - ${options!.end}s):`,
      details: [],
      images: screenshots.map((shot) => ({
        key: shot.key,
        // Evenly spaced timestamps can be long fractions (2.6666666666666665)
        label: `Frame at ${Number(shot.timestamp.toFixed(3))}s`,
        mimeType: getFileMimeType(null, shot.key, 'image/webp'),
      })),
    }
  },
}
