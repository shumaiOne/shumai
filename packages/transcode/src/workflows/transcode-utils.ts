import '@shumai/db/src/prisma-json-types'

export function isMimePsd(mimeType: string): boolean {
  switch (mimeType) {
    case 'image/vnd.adobe.photoshop':
    case 'image/x-photoshop':
    case 'application/x-photoshop':
    case 'image/psd':
      return true
  }
  return false
}

const RESOLUTION_LONG_SIDES: Record<string, number> = {
  '2160p': 3840,
  '1440p': 2560,
  '1080p': 1920,
  '720p': 1280,
  '540p': 960,
  '480p': 854,
  '360p': 640,
  '180p': 320,
}

export const HLS_LADDER_ORDER: PrismaJson.HlsResolutionLadder[] = [
  '2160p',
  '1440p',
  '1080p',
  '720p',
  '480p',
]

export const VIDEO_LADDER_ORDER: PrismaJson.VideoResolutionLadder[] = [
  '2160p',
  '1440p',
  '1080p',
  '720p',
  '480p',
]

export function matchResolutionsByLongSide<T extends string>(
  selectedLadders: T[],
  ladderOrder: T[],
  rawLongSide: number,
): T[] {
  const orderedSelected = ladderOrder.filter((ladder) => selectedLadders.includes(ladder))
  if (orderedSelected.length === 0) return []

  const matched = orderedSelected.filter((ladder) => {
    const targetLongSide = RESOLUTION_LONG_SIDES[ladder]
    return targetLongSide !== undefined && targetLongSide <= rawLongSide
  })

  if (matched.length === 0) {
    // Falls back to the lowest resolution selected if nothing matched
    return [orderedSelected[orderedSelected.length - 1]]
  }

  return matched
}

export function getTargetHlsResolutions(
  configuredLadders: PrismaJson.HlsResolutionLadder[] | undefined,
  originalWidth: number,
  originalHeight: number,
): PrismaJson.HlsResolutionLadder[] {
  const selectedLadders =
    configuredLadders && configuredLadders.length > 0
      ? configuredLadders
      : (['480p', '720p', '1080p'] as PrismaJson.HlsResolutionLadder[])

  const rawLongSide = Math.max(originalWidth, originalHeight)

  return matchResolutionsByLongSide(selectedLadders, HLS_LADDER_ORDER, rawLongSide)
}

export function resolutionToDimensions(
  resolution: string,
  originalWidth: number,
  originalHeight: number,
): [number, number] {
  const targetLongSide = RESOLUTION_LONG_SIDES[resolution]
  if (!targetLongSide) return [0, 0]

  let width: number
  let height: number

  if (originalWidth >= originalHeight) {
    width = targetLongSide
    height = Math.round(width * (originalHeight / originalWidth))
  } else {
    height = targetLongSide
    width = Math.round(height * (originalWidth / originalHeight))
  }

  if (width % 2 !== 0) width++
  if (height % 2 !== 0) height++

  return [width, height]
}

export function getTargetVideoResolutions(
  strategy: PrismaJson.VideoTranscodeStrategy,
  originalWidth: number,
  originalHeight: number,
  configuredResolutions?: PrismaJson.VideoResolutionLadder[],
): string[] {
  const resolutions = ['180p']

  let normalizedStrategy: string = strategy
  const stratStr = strategy as string
  if (stratStr === 'single' || stratStr === 'disable') {
    normalizedStrategy = 'best_match'
  } else if (stratStr === 'full' || stratStr === 'all' || stratStr === 'multi') {
    normalizedStrategy = 'multi'
  }

  const selectedLadders =
    configuredResolutions && configuredResolutions.length > 0
      ? configuredResolutions
      : (['480p', '720p', '1080p', '1440p', '2160p'] as PrismaJson.VideoResolutionLadder[])

  const rawLongSide = Math.max(originalWidth, originalHeight)

  if (normalizedStrategy === 'best_match') {
    const matched = matchResolutionsByLongSide(
      ['480p', '720p', '1080p', '1440p', '2160p'] as PrismaJson.VideoResolutionLadder[],
      VIDEO_LADDER_ORDER,
      rawLongSide,
    )
    resolutions.push(matched[0])
  } else if (normalizedStrategy === 'multi') {
    const matched = matchResolutionsByLongSide(selectedLadders, VIDEO_LADDER_ORDER, rawLongSide)
    resolutions.push(...matched)
  }

  return resolutions
}
