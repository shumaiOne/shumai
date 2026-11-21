import { execFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)
const MAX_FRAMES = 10
const TILE_SIZE = 320

export interface VideoRange {
  startTime: number
  endTime: number
}

export interface PreviewFrame {
  file: string
  timestamp: number
}

export function isPartialVideoRange(range: VideoRange, duration?: number | null): boolean {
  const { startTime, endTime } = range
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime < 0 ||
    endTime <= startTime
  ) {
    return false
  }
  return !duration || startTime > 0 || endTime < duration - 0.001
}

/** Seek once, then extract evenly spaced frames from the requested range. */
export async function samplePreviewFrames(
  input: string,
  outputDir: string,
  range: VideoRange,
): Promise<PreviewFrame[]> {
  const duration = range.endTime - range.startTime
  const fps = MAX_FRAMES / duration
  await execFileAsync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-ss',
    String(range.startTime),
    '-t',
    String(duration),
    '-i',
    input,
    '-map',
    '0:V:0',
    '-vf',
    `trim=duration=${duration},fps=${fps},scale=${TILE_SIZE}:${TILE_SIZE}:force_original_aspect_ratio=decrease`,
    '-frames:v',
    String(MAX_FRAMES),
    path.join(outputDir, 'preview-%03d.png'),
  ])

  return (await readdir(outputDir))
    .filter((name) => /^preview-\d+\.png$/.test(name))
    .sort()
    .map((name, index) => ({
      file: path.join(outputDir, name),
      timestamp: range.startTime + index / fps,
    }))
    .filter(({ timestamp }) => timestamp < range.endTime)
}

export async function renderVideoChunkPreview(frames: PreviewFrame[], range: VideoRange) {
  const inRange = frames.filter(
    ({ timestamp }) => timestamp >= range.startTime && timestamp < range.endTime,
  )
  if (!inRange.length) throw new Error('The video range has no preview frames')

  const selected =
    inRange.length <= MAX_FRAMES
      ? inRange
      : Array.from(
          { length: MAX_FRAMES },
          (_, index) => inRange[Math.round((index * (inRange.length - 1)) / (MAX_FRAMES - 1))],
        )

  const first = await sharp(await readFile(selected[0].file))
    .resize(TILE_SIZE, TILE_SIZE, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true })
  const { width: frameWidth, height: frameHeight } = first.info
  const tiles = await Promise.all(
    selected.map(async ({ file }, index) =>
      index === 0
        ? first.data
        : sharp(await readFile(file))
            .resize(frameWidth, frameHeight, { fit: 'contain', background: '#000' })
            .png()
            .toBuffer(),
    ),
  )
  const columns = Math.min(5, tiles.length)
  const rows = Math.ceil(tiles.length / columns)
  const timestamps = selected.map(({ timestamp }) => timestamp)
  const midpoint = (range.startTime + range.endTime) / 2
  const posterIndex = timestamps.reduce(
    (best, timestamp, index) =>
      Math.abs(timestamp - midpoint) < Math.abs(timestamps[best] - midpoint) ? index : best,
    0,
  )
  const [sprite, poster] = await Promise.all([
    sharp({
      create: {
        width: frameWidth * columns,
        height: frameHeight * rows,
        channels: 3,
        background: '#000',
      },
    })
      .composite(
        tiles.map((input, index) => ({
          input,
          left: (index % columns) * frameWidth,
          top: Math.floor(index / columns) * frameHeight,
        })),
      )
      .webp({ quality: 75 })
      .toBuffer(),
    sharp(tiles[posterIndex]).webp({ quality: 80 }).toBuffer(),
  ])

  return { sprite, poster, columns, rows, frameWidth, frameHeight, timestamps }
}
