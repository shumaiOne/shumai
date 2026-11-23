import { execFile } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { SpriteLayout } from '@shumai/dtos'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)
const MAX_TILE_SIDE = 240
const MAX_COLUMNS = 5
const MAX_SAMPLED_FRAMES = 15

export async function composeVideoChunkSprite(
  frames: string[],
): Promise<(SpriteLayout & { image: Buffer }) | undefined> {
  if (!frames.length) return

  const { width, height } = await sharp(frames[0]).metadata()
  const scale = Math.min(1, MAX_TILE_SIDE / Math.max(width, height))
  const tileWidth = Math.max(1, Math.round(width * scale))
  const tileHeight = Math.max(1, Math.round(height * scale))
  const frameCount = frames.length
  const columns = Math.min(MAX_COLUMNS, frameCount)
  const rows = Math.ceil(frameCount / columns)
  const tiles = await Promise.all(
    frames.map(async (frame, index) => ({
      input: await sharp(frame)
        .resize(tileWidth, tileHeight, { fit: 'contain', background: 'black' })
        .png()
        .toBuffer(),
      left: (index % columns) * tileWidth,
      top: Math.floor(index / columns) * tileHeight,
    })),
  )
  const image = await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: 'black',
    },
  })
    .composite(tiles)
    .webp()
    .toBuffer()
  return { image, columns, rows, frameCount }
}

export async function sampleVideoChunkSprite(
  clip: string,
  duration: number,
  signal?: AbortSignal,
): ReturnType<typeof composeVideoChunkSprite> {
  const dir = await mkdtemp(join(tmpdir(), 'video-chunk-sprite-'))
  try {
    const fps = Math.min(1, MAX_SAMPLED_FRAMES / duration)
    await execFileAsync(
      'ffmpeg',
      [
        '-loglevel',
        'error',
        '-i',
        clip,
        '-vf',
        `fps=${fps}:round=up,scale=w='min(iw,240)':h='min(ih,240)':force_original_aspect_ratio=decrease`,
        '-frames:v',
        String(MAX_SAMPLED_FRAMES),
        join(dir, 'frame_%04d.jpg'),
      ],
      { signal },
    )
    const files = (await readdir(dir)).sort()
    return await composeVideoChunkSprite(files.map((file) => join(dir, file)))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
