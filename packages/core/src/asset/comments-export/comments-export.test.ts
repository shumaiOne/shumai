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
  const testDataDir = path.resolve(__dirname, 'fixtures')

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

    const parsed = JSON.parse(result.content) as typeof golden

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

describe('Edge Cases and CJK Character Support', () => {
  it('escapes special XML characters in asset name for Premiere XML', () => {
    const specialMetadata: ExportAssetMetadata = {
      id: 'special-1',
      name: 'Tom & Jerry <Summer Special> & Co.mp4',
      fps: 24,
      duration: 10,
      totalFrames: 240,
    }

    const result = exportCommentsToFormat(specialMetadata, [], 'premiere-xml', {
      exportDate: new Date('2026-09-13T03:26:31Z'),
    })

    expect(result.filename).toBe('Tom & Jerry <Summer Special> & Co_premiere.xml')
    expect(result.content).toContain(
      '<name>Tom &amp; Jerry &lt;Summer Special&gt; &amp; Co.mp4 2026-9-13 03-26-31</name>',
    )
    expect(result.content).not.toContain('<name>Tom & Jerry <Summer Special>')
  })

  it('keeps Resolve EDL FCM consistent with startTimecode separator', () => {
    const ndfMetadata: ExportAssetMetadata = {
      id: 'ndf-1',
      name: 'video_ndf.mp4',
      fps: 29.97,
      duration: 10,
      totalFrames: 300,
      startTimecode: '01:00:00:00', // Colon denotes NDF
    }

    const comment: ExportCommentItem = {
      id: 'c1',
      message: 'test comment',
      second: 1.0,
      createdAt: new Date('2026-09-13T00:00:00Z'),
      isCompleted: false,
      creator: { id: 'u1', name: 'User' },
    }

    const edlNdf = exportCommentsToFormat(ndfMetadata, [comment], 'resolve-edl')
    expect(edlNdf.content).toContain('FCM: NON DROP FRAME')
    // Emitted timecode must use colon (NDF), matching FCM
    expect(edlNdf.content).toContain('01:00:00:29')
    expect(edlNdf.content).not.toContain('01:00:00;29')

    const dfMetadata: ExportAssetMetadata = {
      ...ndfMetadata,
      startTimecode: '01:00:00;00', // Semicolon denotes DF
    }

    const edlDf = exportCommentsToFormat(dfMetadata, [comment], 'resolve-edl')
    expect(edlDf.content).toContain('FCM: DROP FRAME')
    // Emitted timecode must use semicolon (DF), matching FCM
    expect(edlDf.content).toContain('01:00:00;29')
  })

  it('exports CJK filenames, author names, and comments across all formats without corruption', () => {
    const cjkMetadata: ExportAssetMetadata = {
      id: 'cjk-asset',
      name: '宣传片_最终版 (2026).mp4',
      fps: 24,
      duration: 120,
      totalFrames: 2880,
    }

    const cjkComments: ExportCommentItem[] = [
      {
        id: 'cjk-1',
        message: '这个镜头的色调太暗了，建议提高曝光度。',
        second: 5.5,
        createdAt: '2026-09-13T03:26:00Z',
        isCompleted: false,
        creator: { id: 'u1', name: '张三 (Zhang San)' },
        replies: [
          {
            id: 'cjk-1-reply',
            message: '同意！コントラストも少し下げた方が良いと思います。',
            second: null,
            createdAt: '2026-09-13T03:27:00Z',
            isCompleted: false,
            creator: { id: 'u2', name: '佐藤健 (Satō Ken)' },
          },
        ],
      },
      {
        id: 'cjk-2',
        message: '전체적인 템포가 아주 좋습니다.',
        second: null,
        createdAt: '2026-09-13T03:28:00Z',
        isCompleted: true,
        creator: { id: 'u3', name: '김민수 (Kim Min-soo)' },
      },
    ]

    // 1. Resolve EDL
    const edl = exportCommentsToFormat(cjkMetadata, cjkComments, 'resolve-edl')
    expect(edl.filename).toBe('宣传片_最终版 (2026)_resolve.edl')
    expect(edl.content).toContain('TITLE: 宣传片_最终版 (2026).mp4')
    expect(edl.content).toContain('这个镜头的色调太暗了，建议提高曝光度。')
    expect(edl.content).toContain('佐藤健 (Satō Ken)')
    expect(edl.content).toContain('同意！コントラストも少し下げた方が良いと思います。')
    expect(edl.content).toContain('전체적인 템포가 아주 좋습니다.')

    // 2. Media Composer XML
    const mc = exportCommentsToFormat(cjkMetadata, cjkComments, 'media-composer-xml')
    expect(mc.filename).toBe('宣传片_最终版 (2026)_media-composer.xml')
    expect(mc.content).toContain('张三 (Zhang San)')
    expect(mc.content).toContain('这个镜头的色调太暗了，建议提高曝光度。')
    expect(mc.content).toContain('佐藤健 (Satō Ken)')
    expect(mc.content).toContain('同意！コントラストも少し下げた方が良いと思います。')
    expect(mc.content).toContain('전체적인 템포가 아주 좋습니다.')

    // 3. Premiere XML
    const ppro = exportCommentsToFormat(cjkMetadata, cjkComments, 'premiere-xml', {
      exportDate: new Date('2026-09-13T03:26:31Z'),
    })
    expect(ppro.filename).toBe('宣传片_最终版 (2026)_premiere.xml')
    expect(ppro.content).toContain('<name>宣传片_最终版 (2026).mp4 2026-9-13 03-26-31</name>')
    expect(ppro.content).toContain('这个镜头的色调太暗了，建议提高曝光度。')
    expect(ppro.content).toContain('同意！コントラストも少し下げた方が良いと思います。')

    // 4. FCP FIOJSON
    const fcp = exportCommentsToFormat(cjkMetadata, cjkComments, 'fcp-fiojson')
    expect(fcp.filename).toBe('宣传片_最终版 (2026).fiojson')
    const parsedFcp = JSON.parse(fcp.content)
    expect(parsedFcp.asset.name).toBe('宣传片_最终版 (2026).mp4')
    expect(parsedFcp.comments[0].text).toBe('这个镜头的色调太暗了，建议提高曝光度。')
    expect(parsedFcp.comments[0].owner.name).toBe('张三 (Zhang San)')
    expect(parsedFcp.comments[1].text).toBe('同意！コントラストも少し下げた方が良いと思います。')
    expect(parsedFcp.comments[1].owner.name).toBe('佐藤健 (Satō Ken)')
    expect(parsedFcp.comments[2].text).toBe('전체적인 템포가 아주 좋습니다.')
    expect(parsedFcp.comments[2].owner.name).toBe('김민수 (Kim Min-soo)')
  })
})
