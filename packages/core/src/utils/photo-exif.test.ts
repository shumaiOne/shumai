import { ExifDateTime } from 'exiftool-vendored'
import { describe, expect, it, vi } from 'vitest'

vi.mock('exiftool-vendored', async (importOriginal) => {
  const actual = await importOriginal<typeof import('exiftool-vendored')>()
  return { ...actual, exiftool: { read: vi.fn() } }
})

import { exiftool } from 'exiftool-vendored'
import {
  cameraName,
  photoExifFromTags,
  photoExifMetadata,
  readPhotoExifFromFile,
} from './photo-exif'

describe('photoExifFromTags', () => {
  it('keeps the wall clock when the camera recorded a UTC offset', () => {
    const taken = ExifDateTime.fromEXIF('2026:09:06 11:31:43.250-04:00')
    expect(taken?.hasZone).toBe(true)
    expect(photoExifFromTags({ DateTimeOriginal: taken })?.capturedAt).toBe(
      '2026-09-06T11:31:43.250Z',
    )
    const late = ExifDateTime.fromEXIF('2026:09:06 23:30:00+02:00')
    expect(photoExifFromTags({ DateTimeOriginal: late })?.capturedAt).toBe(
      '2026-09-06T23:30:00.000Z',
    )
  })

  it('stores the wall-clock time as UTC when there is no offset', () => {
    const taken = ExifDateTime.fromEXIF('2026:09:06 11:31:43')
    expect(taken?.hasZone).toBe(false)
    expect(photoExifFromTags({ DateTimeOriginal: taken })?.capturedAt).toBe(
      '2026-09-06T11:31:43.000Z',
    )
  })

  it('reads make, model and lens, trimming blanks', () => {
    expect(photoExifFromTags({ Make: 'FUJIFILM ', Model: 'X100VI', LensModel: '  ' })).toEqual({
      make: 'FUJIFILM',
      model: 'X100VI',
    })
  })

  it('ignores a missing, string or zeroed date', () => {
    expect(photoExifFromTags({})).toBeNull()
    expect(photoExifFromTags({ DateTimeOriginal: '2026:09:06 11:31:43' })).toBeNull()
    expect(
      photoExifFromTags({ DateTimeOriginal: ExifDateTime.fromEXIF('0000:00:00 00:00:00') }),
    ).toBeNull()
  })
})

describe('cameraName', () => {
  it('joins make and model without repeating the maker', () => {
    expect(cameraName('FUJIFILM', 'X100VI')).toBe('FUJIFILM X100VI')
    expect(cameraName('SONY', 'SONY ILCE-7CM2')).toBe('SONY ILCE-7CM2')
    expect(cameraName('Canon', undefined)).toBe('Canon')
    expect(cameraName(undefined, 'X100VI')).toBe('X100VI')
    expect(cameraName()).toBeUndefined()
  })
})

describe('photoExifMetadata', () => {
  it('maps EXIF to the system metadata fields', () => {
    expect(
      photoExifMetadata({
        make: 'FUJIFILM',
        model: 'X100VI',
        lensModel: 'FUJINON 23mm',
        capturedAt: '2026-09-06T15:31:43.000Z',
      }),
    ).toEqual([
      { key: 'capture_date', value: '2026-09-06T15:31:43.000Z' },
      { key: 'camera', value: 'FUJIFILM X100VI' },
      { key: 'lens', value: 'FUJINON 23mm' },
    ])
  })

  it('writes nothing for a photo without EXIF', () => {
    expect(photoExifMetadata(null)).toEqual([])
    expect(photoExifMetadata({})).toEqual([])
  })
})

describe('readPhotoExifFromFile', () => {
  it('returns the mapped tags from ExifTool', async () => {
    vi.mocked(exiftool.read).mockResolvedValueOnce({
      Make: 'SONY',
      Model: 'ILCE-7CM2',
      DateTimeOriginal: ExifDateTime.fromEXIF('2026:09:05 08:00:00+00:00'),
    } as never)
    expect(await readPhotoExifFromFile('/tmp/a.ARW')).toEqual({
      make: 'SONY',
      model: 'ILCE-7CM2',
      capturedAt: '2026-09-05T08:00:00.000Z',
    })
  })

  it('returns null instead of throwing when ExifTool fails', async () => {
    vi.mocked(exiftool.read).mockRejectedValueOnce(new Error('boom'))
    expect(await readPhotoExifFromFile('/tmp/bad.jpg')).toBeNull()
  })
})
