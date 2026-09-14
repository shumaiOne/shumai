import sharp from 'sharp'
import { s3Service } from './s3'
import { logger } from '../logger'

const inFlightConversions = new Map<string, Promise<void>>()

/**
 * Checks if a key represents a WebP image.
 */
export function isWebpKey(key?: string | null): boolean {
  if (!key) return false
  return key.toLowerCase().endsWith('.webp')
}

/**
 * Deterministically derives the target JPEG storage key for a WebP key.
 * e.g. "shumai/files/123/image-300p.webp" -> "shumai/files/123/image-300p.jpeg"
 */
export function getJpegKeyForWebp(key: string): string {
  if (key.toLowerCase().endsWith('.webp')) {
    return `${key.slice(0, -5)}.jpeg`
  }
  return `${key}.jpeg`
}

/**
 * Ensures that a JPEG version of the given WebP object exists in S3/storage.
 * Uses an in-flight Promise map to deduplicate concurrent requests for the same image.
 */
export async function ensureJpegInStorage(
  bucket: string,
  webpKey: string,
  jpegKey: string,
): Promise<void> {
  const dedupeKey = `${bucket}:${webpKey}:${jpegKey}`
  const existing = inFlightConversions.get(dedupeKey)
  if (existing) {
    return await existing
  }

  const conversionPromise = (async () => {
    const obj = await s3Service.getObject(bucket, webpKey)
    if (!obj.buffer || obj.buffer.length === 0) {
      throw new Error(`Empty or missing buffer for WebP object at ${bucket}/${webpKey}`)
    }

    const jpegBuffer = await sharp(obj.buffer).jpeg({ quality: 85 }).toBuffer()
    await s3Service.putObject(bucket, jpegKey, jpegBuffer, jpegBuffer.length, 'image/jpeg')
    logger.debug({ bucket, webpKey, jpegKey }, 'Converted and saved JPEG preview to storage')
  })()

  inFlightConversions.set(dedupeKey, conversionPromise)
  try {
    await conversionPromise
  } catch (err) {
    logger.warn({ err, bucket, webpKey, jpegKey }, 'Failed to convert WebP preview to JPEG')
    throw err
  } finally {
    inFlightConversions.delete(dedupeKey)
  }
}
