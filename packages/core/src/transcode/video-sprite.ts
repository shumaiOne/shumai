import { s3Service } from '@shumai/core/src/s3/s3'

export function isFullVideoRange(
  startTime: number | null,
  endTime: number | null,
  duration: unknown,
): boolean {
  return (
    startTime === 0 &&
    typeof duration === 'number' &&
    Number.isFinite(duration) &&
    duration > 0 &&
    endTime === duration
  )
}

export async function hasStoredVideoSprite(bucket: string, key: string): Promise<boolean> {
  const size = await s3Service.getObjectSize(bucket, key).catch(() => 0)
  return size > 0
}
