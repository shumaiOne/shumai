import { WorkflowTaskType } from '@shumai/db'
import { is3dModel } from '@shumai/core/src/utils/mime'
import {
  degreeToSecond,
  isValidTurntableDegree,
  secondToDegree,
} from '@shumai/core/src/utils/model3d'
import { badRequest, type AssetReader, type ReadResult } from '../types'

const QUADRANT_LEGEND = [
  'Orthogonal 4-view composite image (2x2 grid across 360° rotation):',
  '- Top-Left quadrant: Front view (0°)',
  '- Top-Right quadrant: Right side view (90°)',
  '- Bottom-Left quadrant: Back view (180°)',
  '- Bottom-Right quadrant: Left side view (270°)',
]

function angleSummary(name: string, id: string, degree: number, hasMarkup: boolean): string {
  return hasMarkup
    ? `3D asset "${name}" (ID: ${id}) view at ${degree}° with visual markups overlaid:`
    : `3D asset "${name}" (ID: ${id}) view at ${degree}°:`
}

/** 3D models: the 4-view composite, or one turntable angle rendered from the turntable video. */
export const model3dReader: AssetReader<'model3d'> = {
  kind: 'model3d',
  label: '3D model',
  configHint: "To inspect specific angles pass 'config3d: { degree: ... }'",

  matches: (asset) =>
    asset.media?.proxyType === '3d' || is3dModel(asset.mediaTypeLower, asset.filenameLower),

  validate(_asset, options) {
    const degree = options?.degree
    if (degree !== undefined && degree !== null && !isValidTurntableDegree(degree)) {
      throw badRequest(
        `Invalid turntable degree: ${degree}. Degree must be an integer multiple of 15 between 0 and 345 (e.g. 0, 15, 30, 45, ..., 345).`,
      )
    }
  },

  async plan(asset, options, { annotation }) {
    const requestedDegree = options?.degree ?? null
    const annotations = annotation?.annotations ?? null
    const commentTimestamp = annotation?.timestamp ?? null

    if (annotation && commentTimestamp !== null) {
      const commentDegree = secondToDegree(commentTimestamp)
      if (requestedDegree !== null && requestedDegree !== commentDegree) {
        throw badRequest(
          `Annotation "${annotation.annotationId}" was drawn at ${commentDegree}°, but degree ${requestedDegree}° was specified. Do not pass a conflicting degree with annotationId.`,
        )
      }
    }

    if (requestedDegree !== null || annotation) {
      if (!asset.media?.videoTranscodes || asset.media.videoTranscodes.length === 0) {
        throw new Error(
          `Asset ${asset.id} is a 3D model, but its turntable video (turntable.mp4) is missing.`,
        )
      }
      const second =
        requestedDegree !== null ? degreeToSecond(requestedDegree) : (commentTimestamp ?? 0)
      const degree = requestedDegree ?? secondToDegree(second)
      return {
        status: 'render',
        task: {
          type: WorkflowTaskType.transcode_screenshot,
          spec: {
            screenshot: {
              start: second,
              end: second,
              count: 1,
              commentTimestamp: second,
              annotations: annotations ?? undefined,
            },
          },
        },
        context: { degree, hasMarkup: Boolean(annotations && annotations.length > 0) },
      }
    }

    const key = asset.media?.imageTranscodes?.[0]?.key
    if (!asset.media?.imageTranscodes || asset.media.imageTranscodes.length === 0) {
      throw new Error(
        `Asset ${asset.id} is a 3D model, but its 4-views image (views.webp) is missing.`,
      )
    }
    if (!key) {
      throw new Error(`Asset ${asset.id} is a 3D model, but its 4-views image key is missing.`)
    }
    const result: ReadResult = {
      summary: `3D asset "${asset.name}" (ID: ${asset.id}):`,
      details: QUADRANT_LEGEND,
      images: [{ key, label: '4-view composite', mimeType: 'image/webp' }],
    }
    return { status: 'ready', result }
  },

  collect(asset, _options, output, context) {
    const degree = Number(context.degree)
    const screenshots = output.screenshots as Array<{ key: string }> | undefined
    if (!screenshots || screenshots.length === 0) {
      throw new Error(`Failed to extract 3D turntable frame for asset ${asset.id} at ${degree}°.`)
    }
    return {
      summary: angleSummary(asset.name, asset.id, degree, context.hasMarkup === true),
      details: [],
      images: [{ key: screenshots[0].key, label: `View at ${degree}°`, mimeType: 'image/webp' }],
    }
  },
}
