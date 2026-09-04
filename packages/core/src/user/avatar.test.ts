import { describe, expect, it, vi } from 'vitest'
import { getAvatarUrl } from './avatar'
import { s3Service } from '@shumai/core/src/s3/s3'

describe('getAvatarUrl', () => {
  it('returns undefined when imageKeyOrUrl is falsy', async () => {
    expect(await getAvatarUrl(null)).toBeUndefined()
    expect(await getAvatarUrl(undefined)).toBeUndefined()
    expect(await getAvatarUrl('')).toBeUndefined()
  })

  it('returns http/https URLs directly', async () => {
    expect(await getAvatarUrl('http://example.com/avatar.png')).toBe(
      'http://example.com/avatar.png',
    )
    expect(await getAvatarUrl('https://example.com/avatar.png')).toBe(
      'https://example.com/avatar.png',
    )
  })

  it('presigns S3 keys', async () => {
    const presignSpy = vi
      .spyOn(s3Service, 'presign')
      .mockResolvedValue('http://s3.local/presigned-url')
    const url = await getAvatarUrl('files/01JXYZ1234567890ABCDEFGHJK.webp')
    expect(url).toBe('http://s3.local/presigned-url')
    expect(presignSpy).toHaveBeenCalledWith(
      expect.any(String),
      'files/01JXYZ1234567890ABCDEFGHJK.webp',
      'GET',
    )
    presignSpy.mockRestore()
  })
})
