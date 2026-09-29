import { exiftool } from 'exiftool-vendored'
import sharp from 'sharp'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { logger } from '@shumai/core/src/logger'

export interface RawExtractResult {
  previewPath: string
  cleanup: () => void
  /** EXIF orientation from the RAW container (1–8), or undefined if absent. */
  orientation?: number
}

/**
 * Maps EXIF orientation values (1–8) to Sharp rotation operations.
 * Follows the same mapping as Immich's ORIENTATION_TO_SHARP_ROTATION.
 */
export const EXIF_ORIENTATION_TO_ROTATION: Record<
  number,
  { angle?: number; flip?: boolean; flop?: boolean }
> = {
  1: {}, // Horizontal (normal)
  2: { flop: true }, // Mirror horizontal
  3: { angle: 180 }, // Rotate 180°
  4: { angle: 180, flop: true }, // Mirror vertical
  5: { angle: 270, flip: true }, // Mirror horizontal + rotate 270° CW
  6: { angle: 90 }, // Rotate 90° CW
  7: { angle: 90, flip: true }, // Mirror horizontal + rotate 90° CW
  8: { angle: 270 }, // Rotate 270° CW
}

/**
 * Attempt to extract an embedded JPEG preview from a camera RAW file to a temporary file.
 *
 * Tries tags in priority order (matching Immich, skipping PreviewJXL):
 *   1. JpgFromRaw2  — secondary full-resolution JPEG (newer Sony/Canon/Nikon)
 *   2. JpgFromRaw   — primary full-size embedded JPEG
 *   3. PreviewImage — smaller embedded preview fallback
 *
 * Also reads the EXIF orientation from the RAW container so callers can
 * apply it to the extracted buffer/file (which often lacks its own orientation tag).
 *
 * Returns null if no usable embedded JPEG exists.
 */
export async function extractEmbeddedJpeg(
  rawFilePath: string,
  targetDir?: string,
): Promise<RawExtractResult | null> {
  const tags = ['JpgFromRaw2', 'JpgFromRaw', 'PreviewImage'] as const

  const ownTempDir = !targetDir
  const workDir = targetDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'raw-extract-'))
  const cleanup = () => {
    try {
      if (ownTempDir && fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true })
      }
    } catch (err) {
      logger.warn({ workDir, err }, 'Failed to clean up raw extraction temporary directory')
    }
  }

  for (const tag of tags) {
    const candidatePath = path.join(workDir, `preview-${tag}-${Date.now()}.jpg`)
    try {
      await exiftool.extractBinaryTag(tag, rawFilePath, candidatePath)
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).size > 0) {
        logger.debug({ tag, rawFilePath, candidatePath }, 'Extracted embedded JPEG from RAW')

        // Read orientation from the RAW container's EXIF metadata.
        // The extracted JPEG binary stream often does NOT carry its own
        // orientation tag, so we must read it from the parent RAW file
        // to avoid incorrectly-rotated previews.
        let orientation: number | undefined
        try {
          const exif = await exiftool.read(rawFilePath)
          const rawOrientation = exif.Orientation
          if (typeof rawOrientation === 'number' && rawOrientation >= 1 && rawOrientation <= 8) {
            orientation = rawOrientation
          }
        } catch {
          logger.debug({ rawFilePath }, 'Could not read EXIF orientation from RAW container')
        }

        return { previewPath: candidatePath, cleanup, orientation }
      }
    } catch {
      logger.debug({ tag, rawFilePath }, `Could not extract ${tag} from RAW file`)
      try {
        if (fs.existsSync(candidatePath)) {
          fs.rmSync(candidatePath, { force: true })
        }
      } catch {
        // ignore
      }
    }
  }

  cleanup()
  logger.info({ rawFilePath }, 'No usable embedded JPEG found in RAW file')
  return null
}

/**
 * Validate that an extracted JPEG file is decodable.
 * Returns dimensions if valid, null if corrupt/unusable.
 */
export async function validateExtractedJpeg(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(filePath).metadata()
    if (metadata.width && metadata.height && metadata.width > 0 && metadata.height > 0) {
      return { width: metadata.width, height: metadata.height }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Extract and validate an embedded JPEG from a RAW file to a temporary file.
 * Returns a validated file path + dimensions + orientation + cleanup function, or null.
 */
export async function extractAndValidateRawPreview(
  rawFilePath: string,
  targetDir?: string,
): Promise<{
  previewPath: string
  cleanup: () => void
  width: number
  height: number
  orientation?: number
} | null> {
  const extracted = await extractEmbeddedJpeg(rawFilePath, targetDir)
  if (!extracted) return null

  const dims = await validateExtractedJpeg(extracted.previewPath)
  if (!dims) {
    logger.warn({ rawFilePath }, 'Extracted JPEG from RAW is not decodable, skipping preview')
    extracted.cleanup()
    return null
  }

  return {
    previewPath: extracted.previewPath,
    cleanup: extracted.cleanup,
    orientation: extracted.orientation,
    ...dims,
  }
}
