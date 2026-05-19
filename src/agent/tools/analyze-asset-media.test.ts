import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeAssetMediaTool } from './analyze-asset-media'
import { s3Service } from '@/services/s3/s3'

vi.mock('@/services/s3/s3')

describe('analyzeAssetMediaTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should analyze media by S3 key and return image content', async () => {
    // Mock S3 with WEBP magic bytes
    const buffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ])
    vi.mocked(s3Service.getObject).mockResolvedValue({ buffer, contentType: 'image/webp' })

    const result = await analyzeAssetMediaTool.execute(
      '1',
      { key: 'assets/test.webp' },
      undefined,
      undefined,
      {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    )

    expect(result.content[0].type).toBe('image')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).mimeType).toBe('image/webp')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.details as any).sourceKey).toBe('assets/test.webp')
  })

  it('should infer mimeType from content if S3 response has generic mimeType', async () => {
    // Mock S3 with MP4 magic bytes
    const buffer = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ])
    vi.mocked(s3Service.getObject).mockResolvedValue({ buffer, contentType: 'application/octet-stream' })

    const result = await analyzeAssetMediaTool.execute(
      '1',
      { key: 'assets/no-extension-but-mp4' },
      undefined,
      undefined,
      {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    )

    expect(result.content[0].type).toBe('image') // Wrapped as image type for base64
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).mimeType).toBe('video/mp4')
  })

  it('should return error if S3 getObject fails', async () => {
    // Mock S3 failure
    vi.mocked(s3Service.getObject).mockRejectedValue(new Error('S3 error'))

    const result = await analyzeAssetMediaTool.execute(
      '1',
      { key: 'assets/non-existent' },
      undefined,
      undefined,
      {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textContent = (result.content[0] as any).text
    expect(textContent).toContain('Error analyzing media: S3 error')
  })
})
