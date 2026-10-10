/**
 * Read when a photo was taken and with what camera and lens, from its EXIF, through the same
 * ExifTool the RAW preview extraction uses. Works for JPEG, HEIC and camera RAW files alike.
 */
import { exiftool, ExifDateTime, type Tags } from 'exiftool-vendored'
import { logger } from '../logger'
import { withTimeout } from '../transcode/raw-extract'
import { wallClockToIso } from './capture-time'

export interface PhotoExif {
  make?: string
  model?: string
  lensModel?: string
  /**
   * When the photo was taken, as the camera's wall-clock time written as if it were UTC (see
   * `capture-time.ts`). An EXIF UTC offset (OffsetTimeOriginal) is deliberately not applied, so
   * a 23:30 shot stays 23:30 whatever zone it was taken in or is viewed from.
   */
  capturedAt?: string
}

const DEFAULT_EXIFTOOL_TIMEOUT_MS = 15_000

function nonBlank(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function dateToIso(value: unknown): string | undefined {
  if (value instanceof ExifDateTime) {
    if (!value.isValid || value.year < 1970) return undefined
    // The fields are the wall clock as written, with or without an offset; keep the digits.
    return wallClockToIso(
      value.year,
      value.month,
      value.day,
      value.hour,
      value.minute,
      value.second,
      value.millisecond ?? 0,
    )
  }
  return undefined
}

/** The camera, lens and date taken from ExifTool's tags. Pure, so it is easy to test. */
export function photoExifFromTags(
  tags: Pick<Tags, 'Make' | 'Model' | 'LensModel' | 'DateTimeOriginal'>,
): PhotoExif | null {
  const out: PhotoExif = {
    make: nonBlank(tags.Make),
    model: nonBlank(tags.Model),
    lensModel: nonBlank(tags.LensModel),
    capturedAt: dateToIso(tags.DateTimeOriginal),
  }
  for (const k of Object.keys(out) as (keyof PhotoExif)[]) {
    if (out[k] === undefined) delete out[k]
  }
  return Object.keys(out).length > 0 ? out : null
}

/** The photo's camera and date taken, or null when it has none or cannot be read. Never throws. */
export async function readPhotoExifFromFile(filePath: string): Promise<PhotoExif | null> {
  try {
    const timeoutMs = Number(process.env.EXIFTOOL_TIMEOUT_MS) || DEFAULT_EXIFTOOL_TIMEOUT_MS
    const tags = await withTimeout(exiftool.read(filePath), timeoutMs, 'exiftool.read')
    return photoExifFromTags(tags)
  } catch (err) {
    logger.warn({ filePath, err }, 'Failed to read photo EXIF')
    return null
  }
}

/** "FUJIFILM" + "X100VI" -> "FUJIFILM X100VI"; a model that already names its maker is kept. */
export function cameraName(make?: string, model?: string): string | undefined {
  if (!model) return make
  if (!make) return model
  const brand = make.split(/\s+/)[0].toLowerCase()
  return model.toLowerCase().startsWith(brand) ? model : `${make} ${model}`
}

/** The metadata-field updates for a photo's EXIF (keys from `system_fields.ts`). */
export function photoExifMetadata(
  exif: PhotoExif | null,
): { key: string; value: string | number }[] {
  if (!exif) return []
  const updates: { key: string; value: string | number }[] = []
  const camera = cameraName(exif.make, exif.model)
  if (exif.capturedAt) updates.push({ key: 'capture_date', value: exif.capturedAt })
  if (camera) updates.push({ key: 'camera', value: camera })
  if (exif.lensModel) updates.push({ key: 'lens', value: exif.lensModel })
  return updates
}
