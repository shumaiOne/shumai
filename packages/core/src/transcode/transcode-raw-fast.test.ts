import { describe, it, expect, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import sharp from 'sharp'
import { transcodeService } from './transcode'
import { fakeRaf } from '../utils/raw-preview.test-helpers'

// The fallback chain would start a real exiftool process (which keeps vitest from exiting), so
// the extractor is stubbed: the fast path never reaches it, and the unreadable case gets "no
// preview", which is what exiftool answers for a file full of zeros.
vi.mock('./raw-extract', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./raw-extract')>()),
  extractAndValidateRawPreview: vi.fn().mockResolvedValue(null),
}))

// Real sharp and a real (synthetic) RAF: exercises the embedded-preview fast path end to end
// for a local path, a Buffer and a URL, none of which needs exiftool or dcraw_emu.

const created: string[] = []

async function makeRaf(orientation: number): Promise<Buffer> {
  const jpeg = await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 3,
      background: { r: 120, g: 60, b: 30 },
      noise: { type: 'gaussian', mean: 128, sigma: 40 },
    },
  })
    .withMetadata({ orientation })
    .jpeg({ quality: 90 })
    .toBuffer()
  return fakeRaf(jpeg)
}

function tempFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-fast-'))
  created.push(dir)
  return path.join(dir, name)
}

afterEach(() => {
  vi.unstubAllGlobals()
  for (const d of created.splice(0)) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 })
})

describe('RAW fast preview path', () => {
  it('transcodes a RAW from a local path and applies the container orientation', async () => {
    const raf = tempFile('DSCF0001.RAF')
    fs.writeFileSync(raf, await makeRaf(6))
    const out = tempFile('out.webp')
    await transcodeService.transcodeImage(raf, out, 1000, 80, 1000)
    const meta = await sharp(fs.readFileSync(out)).metadata()
    expect([meta.width, meta.height]).toEqual([400, 600])
  })

  it('transcodes a RAF passed as a Buffer (recognised by its magic bytes)', async () => {
    const out = tempFile('out.webp')
    await transcodeService.transcodeImage(await makeRaf(1), out, 1000, 80, 1000)
    const meta = await sharp(fs.readFileSync(out)).metadata()
    expect([meta.width, meta.height]).toEqual([600, 400])
  })

  it('transcodes a RAW downloaded from a URL, judging it by the URL path', async () => {
    const body = await makeRaf(6)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
      }),
    )
    const out = tempFile('out.webp')
    await transcodeService.transcodeImage(
      'https://storage.example.com/bucket/DSCF0001.RAF?X-Amz-Signature=abc',
      out,
      1000,
      80,
      1000,
    )
    const meta = await sharp(fs.readFileSync(out)).metadata()
    expect([meta.width, meta.height]).toEqual([400, 600])
  })

  it('reports the oriented size from getImageInfo for a path and for a URL', async () => {
    const body = await makeRaf(6)
    const raf = tempFile('DSCF0002.RAF')
    fs.writeFileSync(raf, body)
    const fromPath = await transcodeService.getImageInfo(raf)
    expect([fromPath.originalWidth, fromPath.originalHeight]).toEqual([400, 600])

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
      }),
    )
    const fromUrl = await transcodeService.getImageInfo('https://example.com/a/DSCF0002.RAF')
    expect([fromUrl.originalWidth, fromUrl.originalHeight]).toEqual([400, 600])
  })

  it('still returns 0x0 for an unreadable RAW (no preview, no exiftool result)', async () => {
    const bad = tempFile('broken.arw')
    fs.writeFileSync(bad, Buffer.alloc(4096))
    const info = await transcodeService.getImageInfo(bad)
    expect([info.originalWidth, info.originalHeight]).toEqual([0, 0])
  })
})
