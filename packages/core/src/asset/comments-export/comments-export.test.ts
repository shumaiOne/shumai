import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import type { ExportAssetMetadata, ExportCommentItem } from './types'
import { exportCommentsToFormat } from './index'

interface RawFrameioUser {
  id?: string
  name?: string
  profileImage?: { image128?: string }
  avatarColor?: string
}

interface RawFrameioComment {
  id: string
  text: string
  timestampMicroseconds: number | null
  insertedAt: string
  completed: boolean
  owner?: RawFrameioUser
  annotation?: unknown
  replies?: RawFrameioComment[]
}

interface RawFrameioResponse {
  data: {
    asset: {
      comments: {
        result: RawFrameioComment[]
      }
    }
  }
}

describe('Comments Export against Frame.io Golden Test Data', () => {
  const testDataDir = fs.existsSync(
    path.resolve(process.cwd(), 'frameio-comments-export-test-data'),
  )
    ? path.resolve(process.cwd(), 'frameio-comments-export-test-data')
    : path.resolve(__dirname, '../../../../frameio-comments-export-test-data')

  const apiData = JSON.parse(
    fs.readFileSync(path.join(testDataDir, 'api.json'), 'utf8'),
  ) as RawFrameioResponse

  const rawComments = apiData.data.asset.comments.result

  const comments: ExportCommentItem[] = rawComments.map((c) => ({
    id: c.id,
    message: c.text,
    second: c.timestampMicroseconds != null ? c.timestampMicroseconds / 1_000_000 : null,
    createdAt: c.insertedAt,
    isCompleted: c.completed,
    creator: {
      id: c.owner?.id || 'u1',
      name: c.owner?.name || 'Anonymous',
      image: c.owner?.profileImage?.image128 || null,
      avatarColor: c.owner?.avatarColor || 'aqua',
    },
    annotations: c.annotation,
    replies: (c.replies || []).map((r) => ({
      id: r.id,
      message: r.text,
      second: r.timestampMicroseconds != null ? r.timestampMicroseconds / 1_000_000 : null,
      createdAt: r.insertedAt,
      isCompleted: r.completed,
      creator: {
        id: r.owner?.id || 'u2',
        name: r.owner?.name || 'Anonymous',
        image: r.owner?.profileImage?.image128 || null,
        avatarColor: r.owner?.avatarColor || 'orange',
      },
    })),
  }))

  const metadata: ExportAssetMetadata = {
    id: '2e7ffdba-8fcf-40b6-a93c-026dc1f5dca3',
    name: 'YTDown_YouTube_Ed-Sheeran-Pokemon-Celestial-Official-Vi_Media_23g5HBOg3Ic_002_720p.mp4',
    fps: 24000 / 1001,
    duration: 262.269388,
    totalFrames: 6287,
  }

  it('exports DaVinci Resolve EDL matching golden test data byte-for-byte', () => {
    const golden = fs.readFileSync(path.join(testDataDir, 'resolve.edl'), 'utf8')
    const result = exportCommentsToFormat(metadata, comments, 'resolve-edl', {
      exportDate: new Date('2026-09-13T03:26:00Z'),
    })

    expect(result.filename).toBe(
      'YTDown_YouTube_Ed-Sheeran-Pokemon-Celestial-Official-Vi_Media_23g5HBOg3Ic_002_720p_resolve.edl',
    )
    expect(result.mimeType).toBe('text/plain; charset=utf-8')
    expect(result.content).toBe(golden)
  })

  it('exports Avid Media Composer XML matching golden test data byte-for-byte', () => {
    const golden = fs.readFileSync(path.join(testDataDir, 'media-composer.xml'), 'utf8')
    const result = exportCommentsToFormat(metadata, comments, 'media-composer-xml')

    expect(result.filename).toBe(
      'YTDown_YouTube_Ed-Sheeran-Pokemon-Celestial-Official-Vi_Media_23g5HBOg3Ic_002_720p_media-composer.xml',
    )
    expect(result.mimeType).toBe('application/xml; charset=utf-8')
    expect(result.content).toBe(golden)
  })

  it('exports Adobe Premiere Pro XML matching golden test data byte-for-byte', () => {
    const golden = fs.readFileSync(path.join(testDataDir, 'premierepro.xml'), 'utf8')
    const result = exportCommentsToFormat(metadata, comments, 'premiere-xml', {
      exportDate: new Date('2026-09-13T03:26:31Z'),
    })

    expect(result.filename).toBe(
      'YTDown_YouTube_Ed-Sheeran-Pokemon-Celestial-Official-Vi_Media_23g5HBOg3Ic_002_720p_premiere.xml',
    )
    expect(result.mimeType).toBe('application/xml; charset=utf-8')
    expect(result.content).toBe(golden)
  })

  it('exports Final Cut Pro FIOJSON matching golden comments and metadata', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const golden: any = JSON.parse(fs.readFileSync(path.join(testDataDir, 'fcp.fiojson'), 'utf8'))
    const result = exportCommentsToFormat(metadata, comments, 'fcp-fiojson')

    expect(result.filename).toBe(
      'YTDown_YouTube_Ed-Sheeran-Pokemon-Celestial-Official-Vi_Media_23g5HBOg3Ic_002_720p.fiojson',
    )
    expect(result.mimeType).toBe('application/json; charset=utf-8')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = JSON.parse(result.content)

    expect(parsed.asset.id).toBe(metadata.id)
    expect(parsed.asset.name).toBe(metadata.name)
    expect(parsed.asset.fps).toBe(metadata.fps)
    expect(parsed.asset.duration).toBe(metadata.duration)
    expect(parsed.asset.frames).toBe(metadata.totalFrames)
    expect(parsed.comments.length).toBe(golden.comments.length)

    for (let i = 0; i < parsed.comments.length; i++) {
      const gen = parsed.comments[i]
      const gold = golden.comments[i]

      expect(gen.text).toBe(gold.text)
      expect(gen.frame).toBe(gold.frame)
      expect(gen.timestamp).toBe(gold.timestamp)
      expect(gen.completed).toBe(gold.completed)
      expect(gen.parent_id).toBe(gold.parent_id)
      if (gold.annotation) {
        expect(gen.annotation).toBe(gold.annotation)
      } else {
        expect(gen.annotation).toBeNull()
      }
    }
  })
})
