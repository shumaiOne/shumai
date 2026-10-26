import { describe, expect, it } from 'vitest'
import { READER_KINDS, readerOptionSchemas } from '@shumai/operations'
import { findReader, getReader, readers } from '../registry'
import type { ReadableAsset } from '../types'
import { documentReader, isPlainTextAsset, MAX_TEXT_BYTES, truncateText } from './document'
import { imageReader } from './image'
import { model3dReader } from './model3d'
import { videoReader } from './video'

function asset(overrides: Partial<ReadableAsset> & { name: string }): ReadableAsset {
  const mediaType = overrides.mediaType ?? null
  return {
    id: 'asset-1',
    projectId: 'project-1',
    storageKey: null,
    media: null,
    mediaType,
    mediaTypeLower: mediaType?.toLowerCase() ?? '',
    filenameLower: overrides.name.toLowerCase(),
    ...overrides,
  }
}

const noAnnotation = { annotation: null, includeContent: true }

describe('reader registry', () => {
  it('has exactly one reader per declared kind, each with a config field', () => {
    expect(readers.map((r) => r.kind).sort()).toEqual([...READER_KINDS].sort())
    for (const kind of READER_KINDS) {
      expect(getReader(kind).kind).toBe(kind)
      expect(readerOptionSchemas[kind].key).toMatch(/Config$|^config3d$/)
    }
  })

  it.each([
    [{ name: 'robot.glb', mediaType: 'model/gltf-binary' }, 'model3d'],
    // 3D models also have image transcodes; the 3D reader must win.
    [{ name: 'robot.png', mediaType: 'image/png', media: { proxyType: '3d' } }, 'model3d'],
    [{ name: 'photo.JPG', mediaType: 'IMAGE/JPEG' }, 'image'],
    [{ name: 'layers.psd', mediaType: 'application/octet-stream' }, 'image'],
    [{ name: 'clip.webm', mediaType: 'video/webm' }, 'video'],
    [{ name: 'slides.pdf', mediaType: 'application/pdf' }, 'document'],
    [{ name: 'data.csv', mediaType: null }, 'document'],
    [{ name: 'config.json', mediaType: 'application/json' }, 'document'],
  ] as const)('%o is read by %s', (overrides, kind) => {
    expect(findReader(asset(overrides as Partial<ReadableAsset> & { name: string }))?.kind).toBe(
      kind,
    )
  })

  it('has no reader for archives', () => {
    expect(findReader(asset({ name: 'bundle.zip', mediaType: 'application/zip' }))).toBeUndefined()
  })
})

describe('imageReader', () => {
  it('prefers the web proxy over the original', async () => {
    const plan = await imageReader.plan(
      asset({
        name: 'photo.png',
        mediaType: 'image/png',
        storageKey: 'raw/photo.png',
        media: { imageTranscodes: [{ key: 'proxy/photo.webp' }] } as PrismaJson.MediaInfo,
      }),
      undefined,
      noAnnotation,
    )
    expect(plan).toMatchObject({
      status: 'ready',
      result: { images: [{ key: 'proxy/photo.webp', mimeType: 'image/webp' }] },
    })
  })

  it('fails without any stored content', async () => {
    await expect(
      imageReader.plan(asset({ name: 'photo.png' }), undefined, noAnnotation),
    ).rejects.toThrow('No media content found')
  })

  it('requires the annotated key from the render', () => {
    expect(() => imageReader.collect!(asset({ name: 'photo.png' }), undefined, {}, {})).toThrow(
      'failed to output S3 key',
    )
  })
})

describe('videoReader', () => {
  const video = asset({ name: 'clip.mp4', mediaType: 'video/mp4' })

  it.each([
    [{ start: -1, end: 2, count: 1 }, 'must be non-negative'],
    [{ start: 3, end: 2, count: 1 }, 'must be less than or equal to end'],
    [{ start: 0, end: 2, count: 0 }, 'must be at least 1'],
    [{ start: 0, end: 2, count: 21 }, 'exceeds the maximum of 20 frames'],
  ])('rejects %o', (options, message) => {
    expect(() => videoReader.validate(video, options, { hasAnnotation: false })).toThrow(message)
  })

  it('accepts exactly 20 frames', () => {
    expect(() =>
      videoReader.validate(video, { start: 0, end: 60, count: 20 }, { hasAnnotation: false }),
    ).not.toThrow()
  })

  it('renders frames through the screenshot workflow with the annotation', async () => {
    const plan = await videoReader.plan(
      video,
      { start: 1, end: 3, count: 2 },
      {
        annotation: { annotationId: 'c1', annotations: [], timestamp: 2 },
        includeContent: true,
      },
    )
    expect(plan).toEqual({
      status: 'render',
      task: {
        type: 'transcode_screenshot',
        spec: {
          screenshot: { start: 1, end: 3, count: 2, commentTimestamp: 2, annotations: [] },
        },
      },
    })
  })

  it('rounds frame timestamps in labels', () => {
    const result = videoReader.collect!(
      video,
      { start: 0, end: 8, count: 3 },
      { screenshots: [{ key: 's/1.webp', timestamp: 2.6666666666666665 }] },
      {},
    )
    expect(result.images[0].label).toBe('Frame at 2.667s')
  })

  it('fails when the render produced no frames', () => {
    expect(() =>
      videoReader.collect!(video, { start: 0, end: 1, count: 1 }, { screenshots: [] }, {}),
    ).toThrow('No screenshots were generated.')
  })
})

describe('model3dReader', () => {
  const model = asset({
    name: 'robot.glb',
    mediaType: 'model/gltf-binary',
    media: {
      proxyType: '3d',
      videoTranscodes: [{ key: 'proxy/turntable.mp4' }],
      imageTranscodes: [{ key: 'proxy/views.webp' }],
    } as unknown as PrismaJson.MediaInfo,
  })

  it('accepts null as "show the overview"', async () => {
    expect(() =>
      model3dReader.validate(model, { degree: null }, { hasAnnotation: false }),
    ).not.toThrow()
    const plan = await model3dReader.plan(model, { degree: null }, noAnnotation)
    expect(plan.status).toBe('ready')
  })

  it('carries the angle to collect through the task context', async () => {
    const plan = await model3dReader.plan(model, { degree: 180 }, noAnnotation)
    expect(plan).toMatchObject({
      status: 'render',
      context: { degree: 180, hasMarkup: false },
    })
    const result = model3dReader.collect!(
      model,
      { degree: 180 },
      { screenshots: [{ key: 'shots/180.webp' }] },
      { degree: 180, hasMarkup: false },
    )
    expect(result.images).toEqual([
      { key: 'shots/180.webp', label: 'View at 180°', mimeType: 'image/webp' },
    ])
  })
})

describe('documentReader', () => {
  const pdf = asset({ name: 'slides.pdf', mediaType: 'application/pdf' })

  it.each([
    [undefined, 'docConfig with mode'],
    [{ mode: 'pages' as const }, 'startPage and endPage are required'],
    [{ mode: 'pages' as const, startPage: 0, endPage: 1 }, 'must be at least 1'],
    [{ mode: 'pages' as const, startPage: 3, endPage: 2 }, 'less than or equal to end page'],
    [{ mode: 'pages' as const, startPage: 1, endPage: 21 }, 'exceeds the maximum limit of 20'],
    [{ mode: 'text' as const }, 'cannot be read as raw text'],
  ])('rejects %o for PDFs', (options, message) => {
    expect(() => documentReader.validate(pdf, options, { hasAnnotation: false })).toThrow(message)
  })

  it('renders a page range with annotations', async () => {
    const plan = await documentReader.plan(
      pdf,
      { mode: 'pages', startPage: 2, endPage: 3 },
      { annotation: { annotationId: 'c1', annotations: null, timestamp: 2 }, includeContent: true },
    )
    expect(plan).toMatchObject({
      status: 'render',
      task: {
        type: 'transcode_pdf_pages',
        spec: { pdfPages: { start: 2, end: 3, commentTimestamp: 2, annotations: null } },
      },
    })
  })

  it('labels rendered pages by page number', () => {
    const result = documentReader.collect!(
      pdf,
      { mode: 'pages', startPage: 2, endPage: 3 },
      { pages: [{ key: 'p/2.webp', page: 2 }] },
      {},
    )
    expect(result.summary).toBe('Rendered 1 page(s) of "slides.pdf" (Pages 2 to 3):')
    expect(result.images).toEqual([{ key: 'p/2.webp', label: 'Page 2', mimeType: 'image/webp' }])
  })

  it('detects plain text by media type or extension', () => {
    expect(isPlainTextAsset('text/plain', 'a.bin')).toBe(true)
    expect(isPlainTextAsset('application/x-yaml', 'a')).toBe(true)
    expect(isPlainTextAsset('', 'main.rs')).toBe(true)
    expect(isPlainTextAsset('application/pdf', 'a.pdf')).toBe(false)
  })

  it('truncates by bytes as well as lines', () => {
    const big = 'x'.repeat(MAX_TEXT_BYTES + 10)
    const { content, truncated } = truncateText(big)
    expect(truncated).toBe(true)
    expect(Buffer.byteLength(content)).toBe(MAX_TEXT_BYTES)
    expect(truncateText('short')).toEqual({ content: 'short', truncated: false })
  })
})
