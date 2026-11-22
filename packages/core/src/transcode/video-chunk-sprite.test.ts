import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { composeVideoChunkSprite } from './video-chunk-sprite'

describe('composeVideoChunkSprite', () => {
  it('fills tiles in frame order and counts only the tiles with frames', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chunk-sprite-test-'))
    try {
      const colors = ['red', 'red', 'red', 'red', 'red', 'blue']
      const frames = await Promise.all(
        colors.map(async (background, index) => {
          const frame = join(directory, `frame-${index}.png`)
          await sharp({ create: { width: 48, height: 32, channels: 3, background } }).toFile(frame)
          return frame
        }),
      )

      const sprite = await composeVideoChunkSprite(frames)
      expect(sprite).toMatchObject({ columns: 5, rows: 2, frameCount: 6 })
      const { data, info } = await sharp(sprite!.image).raw().toBuffer({ resolveWithObject: true })
      expect(info).toMatchObject({ width: 240, height: 64, channels: 3 })
      const pixel = (x: number, y: number) => (y * info.width + x) * info.channels
      expect(data[pixel(24, 16)]).toBeGreaterThan(200)
      expect(data[pixel(24, 48) + 2]).toBeGreaterThan(200)
      expect(data[pixel(72, 48) + 2]).toBeLessThan(10)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('omits preview metadata when the chunk contains no frames', async () => {
    await expect(composeVideoChunkSprite([])).resolves.toBeUndefined()
  })
})
