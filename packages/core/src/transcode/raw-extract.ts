import { exiftool } from 'exiftool-vendored'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import sharp from 'sharp'
import { logger } from '@shumai/core/src/logger'
import { createExecFileAsync, getThreadLimitEnv } from './resource-limits'

const execFileAsync = createExecFileAsync()

export interface RawExtractResult {
  previewPath: string
  cleanup: () => void
  /** EXIF orientation from the RAW container (1–8), or undefined if absent or already applied. */
  orientation?: number
  /** Original unoriented or oriented image dimensions from EXIF if available */
  rawWidth?: number
  rawHeight?: number
}

export interface RawPreviewResult {
  previewPath: string
  cleanup: () => void
  width: number
  height: number
  orientation?: number
  /**
   * True when the file is already upright (dcraw_emu output), so downstream sharp must not
   * auto-orient it even though `orientation` is undefined.
   */
  orientationApplied?: boolean
  rawWidth?: number
  rawHeight?: number
}

export interface DecodeRawOptions {
  timeoutMs?: number
  signal?: AbortSignal
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

const DEFAULT_EXIFTOOL_TIMEOUT_MS = 15_000

function getExifToolTimeoutMs(): number {
  const envVal = process.env.EXIFTOOL_TIMEOUT_MS
  if (envVal) {
    const parsed = parseInt(envVal, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return DEFAULT_EXIFTOOL_TIMEOUT_MS
}

/**
 * Wraps a promise with a timeout. If the timeout triggers first,
 * the returned promise rejects with a timeout error and attaches a no-op handler
 * to the underlying promise to prevent unhandled rejections.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'Operation',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })
  promise.catch(() => {})
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer)
  })
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

  const exiftoolTimeoutMs = getExifToolTimeoutMs()

  for (const tag of tags) {
    const candidatePath = path.join(workDir, `preview-${tag}-${Date.now()}.jpg`)
    try {
      await withTimeout(
        exiftool.extractBinaryTag(tag, rawFilePath, candidatePath),
        exiftoolTimeoutMs,
        `exiftool.extractBinaryTag(${tag})`,
      )
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).size > 0) {
        logger.debug({ tag, rawFilePath, candidatePath }, 'Extracted embedded JPEG from RAW')

        // Read orientation and container dimensions from the RAW container's EXIF metadata.
        let orientation: number | undefined
        let rawWidth: number | undefined
        let rawHeight: number | undefined
        try {
          const exif = await withTimeout(
            exiftool.read(rawFilePath),
            exiftoolTimeoutMs,
            'exiftool.read',
          )
          const rawOrientation = exif.Orientation
          if (typeof rawOrientation === 'number' && rawOrientation >= 1 && rawOrientation <= 8) {
            orientation = rawOrientation
          }
          const w =
            typeof exif.ImageWidth === 'number'
              ? exif.ImageWidth
              : typeof exif.ExifImageWidth === 'number'
                ? exif.ExifImageWidth
                : undefined
          const h =
            typeof exif.ImageHeight === 'number'
              ? exif.ImageHeight
              : typeof exif.ExifImageHeight === 'number'
                ? exif.ExifImageHeight
                : undefined
          if (w && h && w > 0 && h > 0) {
            rawWidth = w
            rawHeight = h
          }
        } catch {
          logger.debug({ rawFilePath }, 'Could not read EXIF orientation from RAW container')
        }

        return { previewPath: candidatePath, cleanup, orientation, rawWidth, rawHeight }
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.includes('timed out')
      logger.debug({ tag, rawFilePath, err, isTimeout }, `Could not extract ${tag} from RAW file`)
      try {
        if (fs.existsSync(candidatePath)) {
          fs.rmSync(candidatePath, { force: true })
        }
      } catch {
        // ignore
      }
      if (isTimeout) {
        logger.warn(
          { rawFilePath, tag, timeoutMs: exiftoolTimeoutMs },
          'ExifTool extraction timed out; skipping remaining tags to avoid further delays',
        )
        break
      }
    }
  }

  cleanup()
  logger.info({ rawFilePath }, 'No usable embedded JPEG found in RAW file')
  return null
}

/**
 * Fallback RAW decoder using dcraw_emu (from LibRaw).
 *
 * Used when no usable embedded JPEG preview exists in the RAW file.
 *
 * Decoding options:
 * - Camera white balance and sRGB output (-w -o 1)
 * - Output temporary TIFF (-T -Z <tempPath>)
 * - Half-size processing (-h) enabled only when longest dimension > 8192px
 *
 * LibRaw auto-rotates the output image to upright orientation based on camera EXIF,
 * so the returned orientation is undefined to avoid double-rotation in downstream Sharp.
 */
export async function decodeRawWithDcraw(
  rawFilePath: string,
  targetDir?: string,
  options?: DecodeRawOptions,
): Promise<RawExtractResult | null> {
  const ownTempDir = !targetDir
  const workDir = targetDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'raw-decode-'))
  const tempTiffPath = path.join(
    workDir,
    `decoded-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tiff`,
  )

  const cleanup = () => {
    try {
      if (ownTempDir && fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true })
      } else if (fs.existsSync(tempTiffPath)) {
        fs.rmSync(tempTiffPath, { force: true })
      }
    } catch (err) {
      logger.warn({ workDir, tempTiffPath, err }, 'Failed to clean up dcraw temporary files')
    }
  }

  // 1. Probe RAW dimensions and orientation via ExifTool to check for 8192px threshold
  let useHalfSize = false
  let rawWidth: number | undefined
  let rawHeight: number | undefined
  try {
    const exiftoolTimeoutMs = getExifToolTimeoutMs()
    const exif = await withTimeout(exiftool.read(rawFilePath), exiftoolTimeoutMs, 'exiftool.read')
    const w =
      typeof exif.ImageWidth === 'number'
        ? exif.ImageWidth
        : typeof exif.ExifImageWidth === 'number'
          ? exif.ExifImageWidth
          : undefined
    const h =
      typeof exif.ImageHeight === 'number'
        ? exif.ImageHeight
        : typeof exif.ExifImageHeight === 'number'
          ? exif.ExifImageHeight
          : undefined

    if (w && h && w > 0 && h > 0) {
      const longest = Math.max(w, h)
      if (longest > 8192) {
        useHalfSize = true
      }

      // Compute upright raw dimensions matching dcraw_emu's auto-rotation
      const rawOrientation = exif.Orientation
      const isSwapped =
        typeof rawOrientation === 'number' && rawOrientation >= 5 && rawOrientation <= 8
      rawWidth = isSwapped ? h : w
      rawHeight = isSwapped ? w : h
    }
  } catch (err) {
    logger.debug({ rawFilePath, err }, 'Could not read EXIF metadata for RAW dimension check')
  }

  // 2. Build dcraw_emu arguments
  const args = ['-w', '-o', '1']
  if (useHalfSize) {
    args.push('-h')
  }
  args.push('-T', '-Z', tempTiffPath, rawFilePath)

  const dcrawBin = process.env.DCRAW_EMU_PATH || 'dcraw_emu'
  const envTimeout = process.env.DCRAW_EMU_TIMEOUT_MS
    ? parseInt(process.env.DCRAW_EMU_TIMEOUT_MS, 10)
    : undefined
  const timeoutMs = options?.timeoutMs ?? (envTimeout && !isNaN(envTimeout) ? envTimeout : 60_000)

  try {
    logger.debug({ dcrawBin, args, rawFilePath }, 'Executing dcraw_emu fallback')
    const threadEnv = getThreadLimitEnv()
    await execFileAsync(dcrawBin, args, {
      timeout: timeoutMs,
      signal: options?.signal,
      ...(threadEnv ? { env: { ...process.env, ...threadEnv } } : {}),
    })

    if (!fs.existsSync(tempTiffPath) || fs.statSync(tempTiffPath).size === 0) {
      logger.warn({ rawFilePath, tempTiffPath }, 'dcraw_emu did not produce a valid output TIFF')
      cleanup()
      return null
    }

    return {
      previewPath: tempTiffPath,
      cleanup,
      orientation: undefined, // dcraw_emu already auto-rotates upright based on camera EXIF
      rawWidth,
      rawHeight,
    }
  } catch (err) {
    logger.warn({ rawFilePath, err }, 'dcraw_emu failed to decode RAW file')
    cleanup()
    return null
  }
}

/**
 * Validate that an extracted or decoded image file (JPEG, TIFF, etc.) is decodable.
 * Returns dimensions if valid, null if corrupt/unusable.
 */
export async function validateExtractedImage(
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

/** Backward compatibility alias */
export const validateExtractedJpeg = validateExtractedImage

/**
 * Extract and validate a preview from a RAW file to a temporary file.
 *
 * 1. Attempts ExifTool embedded JPEG extraction first.
 * 2. If no embedded preview is available or extraction fails, falls back to dcraw_emu decoding.
 *
 * Returns a validated file path + dimensions + orientation + cleanup function, or null.
 */
export async function extractAndValidateRawPreview(
  rawFilePath: string,
  targetDir?: string,
): Promise<RawPreviewResult | null> {
  // 1. Try ExifTool embedded JPEG extraction first
  const extracted = await extractEmbeddedJpeg(rawFilePath, targetDir)
  if (extracted) {
    const dims = await validateExtractedImage(extracted.previewPath)
    if (dims) {
      return {
        previewPath: extracted.previewPath,
        cleanup: extracted.cleanup,
        orientation: extracted.orientation,
        rawWidth: extracted.rawWidth,
        rawHeight: extracted.rawHeight,
        ...dims,
      }
    }
    logger.warn(
      { rawFilePath },
      'Extracted JPEG from RAW is not decodable, falling back to dcraw_emu',
    )
    extracted.cleanup()
  } else {
    logger.info(
      { rawFilePath },
      'No usable embedded JPEG found in RAW file, falling back to dcraw_emu',
    )
  }

  // 2. Fallback to dcraw_emu
  const decoded = await decodeRawWithDcraw(rawFilePath, targetDir)
  if (!decoded) {
    return null
  }

  const dims = await validateExtractedImage(decoded.previewPath)
  if (!dims) {
    logger.warn({ rawFilePath }, 'Decoded TIFF from dcraw_emu is not decodable, skipping preview')
    decoded.cleanup()
    return null
  }

  return {
    previewPath: decoded.previewPath,
    cleanup: decoded.cleanup,
    orientation: decoded.orientation,
    orientationApplied: true,
    rawWidth: decoded.rawWidth,
    rawHeight: decoded.rawHeight,
    ...dims,
  }
}
