import { s3Service } from '@shumai/core/src/s3/s3'

/**
 * Returns the signed avatar URL if the image is an S3 key,
 * or returns it directly if it's already an external URL (e.g. OAuth avatar).
 */
export async function getAvatarUrl(
  imageKeyOrUrl: string | null | undefined,
): Promise<string | undefined> {
  if (!imageKeyOrUrl) return undefined
  if (
    imageKeyOrUrl.startsWith('data:') ||
    imageKeyOrUrl.startsWith('http://') ||
    imageKeyOrUrl.startsWith('https://')
  ) {
    return imageKeyOrUrl
  }
  try {
    const bucket = process.env.S3_BUCKET || 'shumai'
    return await s3Service.presign(bucket, imageKeyOrUrl, 'GET')
  } catch (e) {
    console.error(`Failed to presign avatar URL for key ${imageKeyOrUrl}:`, e)
    return undefined
  }
}
