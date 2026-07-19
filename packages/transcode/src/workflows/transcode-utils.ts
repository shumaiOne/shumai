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
  '1080p': 1920,
  '720p': 1280,
  '540p': 960,
  '360p': 640,
  '180p': 320,
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

const TARGET_RESOLUTIONS = [
  { name: '2160p', longSide: 3840 },
  { name: '1080p', longSide: 1920 },
  { name: '720p', longSide: 1280 },
  { name: '540p', longSide: 960 },
  { name: '360p', longSide: 640 },
]

function getBestMatchResolution(
  originalWidth: number,
  originalHeight: number,
): { name: string; longSide: number } {
  const rawLongSide = Math.max(originalWidth, originalHeight)
  const lower = TARGET_RESOLUTIONS.filter((r) => r.longSide <= rawLongSide)
  if (lower.length > 0) {
    lower.sort((a, b) => b.longSide - a.longSide)
    return lower[0]
  }
  return TARGET_RESOLUTIONS[TARGET_RESOLUTIONS.length - 1]
}

export function getTargetVideoResolutions(
  strategy: PrismaJson.VideoTranscodeStrategy,
  originalWidth: number,
  originalHeight: number,
): string[] {
  const resolutions = ['180p']

  let normalizedStrategy: string = strategy
  const stratStr = strategy as string
  if (stratStr === 'single' || stratStr === 'disable') {
    normalizedStrategy = 'best_match'
  } else if (stratStr === 'full') {
    normalizedStrategy = 'all'
  }

  const bestMatch = getBestMatchResolution(originalWidth, originalHeight)

  if (normalizedStrategy === 'best_match') {
    resolutions.push(bestMatch.name)
  } else if (normalizedStrategy === 'all') {
    const bestMatchIndex = TARGET_RESOLUTIONS.findIndex((r) => r.name === bestMatch.name)
    if (bestMatchIndex !== -1) {
      for (let i = bestMatchIndex; i < TARGET_RESOLUTIONS.length; i++) {
        resolutions.push(TARGET_RESOLUTIONS[i].name)
      }
    }
  }

  return resolutions
}
