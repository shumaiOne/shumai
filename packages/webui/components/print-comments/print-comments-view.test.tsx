// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssetInfo, CommentInfo } from '@shumai/dtos'
import { PrintCommentsView } from './print-comments-view'

function makeComment(overrides: Partial<CommentInfo> = {}): CommentInfo {
  return {
    id: 'c-1',
    assetId: 'asset-1',
    message: 'Check the color grade here',
    annotations: null,
    second: 1.5,
    creator: { id: 'u-1', name: 'Alice' },
    replies: [],
    attachments: [],
    mentions: [],
    createdAt: '2026-11-25T14:53:00.000Z',
    updatedAt: '2026-11-25T14:53:00.000Z',
    sessionId: null,
    isCompleted: false,
    completionLastChangedBy: null,
    reactionCounts: [],
    ...overrides,
  }
}

describe('PrintCommentsView', () => {
  let printMock: ReturnType<typeof vi.fn>
  const originalPrint = window.print

  beforeEach(() => {
    printMock = vi.fn()
    Object.defineProperty(window, 'print', {
      value: printMock,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'print', {
      value: originalPrint,
      writable: true,
      configurable: true,
    })
  })

  const videoAsset: AssetInfo = {
    id: 'asset-video-1',
    name: '3D_printer_building_model_20261017121617.mp4',
    type: 'file',
    status: 'processed',
    sizeByte: 1024,
    fileCount: 1,
    proxyType: 'video',
    preview: { thumbnailUrl: 'https://example.com/thumb.jpg' },
    creator: { id: 'u-1', name: 'Alice' },
    createdAt: '2026-11-06T10:00:00.000Z',
    updatedAt: '2026-11-06T10:00:00.000Z',
    media: {
      proxyType: 'video',
      imageTranscodes: [],
      videoTranscodes: [],
      metadata: { frameRate: 24 },
    },
  }

  it('renders video comments sorted by timecode with frames, SVG annotations, replies, completed status, reactions, and attachments without auto-printing', () => {
    const comments: CommentInfo[] = [
      makeComment({
        id: 'c-2',
        second: 5,
        message: 'Second comment later in timeline',
      }),
      makeComment({
        id: 'c-1',
        second: 1.5,
        message: 'First comment <@u-2>',
        mentions: [{ id: 'u-2', name: 'Bob' }],
        isCompleted: true,
        annotations: [
          {
            type: 'box',
            color: '#ef4444',
            points: [
              [0.1, 0.1],
              [0.5, 0.5],
            ],
          },
          {
            type: 'arrow',
            color: '#22c55e',
            points: [
              [0.2, 0.2],
              [0.8, 0.8],
            ],
          },
          {
            type: 'line',
            color: '#3b82f6',
            points: [
              [0.1, 0.9],
              [0.9, 0.1],
            ],
          },
          {
            type: 'freehand',
            color: '#eab308',
            points: [
              [0.1, 0.2],
              [0.2, 0.3],
              [0.4, 0.35],
            ],
          },
        ],
        attachments: [
          { id: 'att-1', assetId: 'a-1', url: 'https://example.com/ref-frame.png' },
          { id: 'att-2', assetId: 'a-2', url: 'https://example.com/notes.pdf' },
        ],
        reactionCounts: [
          { code: '👍', count: 2, requestingUserReacted: true, creatorNames: ['Bob'] },
        ],
        replies: [
          makeComment({
            id: 'r-1',
            second: null,
            message: 'Updated in v2!',
            creator: { id: 'u-2', name: 'Bob' },
          }),
        ],
      }),
    ]

    const { container } = render(
      <PrintCommentsView
        asset={videoAsset}
        breadcrumbs={['Untitled Project', 'Dailies']}
        comments={comments}
      />,
    )

    // Never auto-trigger print
    expect(printMock).not.toHaveBeenCalled()

    // Header breadcrumbs & creator
    expect(screen.getByText('Untitled Project')).toBeDefined()
    expect(screen.getByText('Dailies')).toBeDefined()
    expect(screen.getByText('Sorted by timecode')).toBeDefined()

    // Progress indicator while thumbnails are loading
    expect(screen.getByTestId('print-frames-progress')).toBeDefined()
    expect(screen.getAllByTestId('print-frame-loading')).toHaveLength(2)

    // Sorted by timecode: c-1 (1.5s) appears before c-2 (5s)
    const threads = screen.getAllByTestId('print-comment-thread')
    expect(threads).toHaveLength(2)
    expect(threads[0].textContent).toContain('First comment')
    expect(threads[0].textContent).toContain('@Bob')
    expect(threads[0].textContent).toContain('Updated in v2!')
    expect(threads[1].textContent).toContain('Second comment later in timeline')

    // Completed badge, reactions, and attachments
    expect(screen.getByTestId('print-comment-completed').textContent).toContain('Completed')
    expect(screen.getByTestId('print-comment-reactions').textContent).toContain('👍')
    expect(screen.getByTestId('print-comment-reactions').textContent).toContain('2')
    expect(screen.getByTestId('print-comment-attachments').textContent).toContain('ref-frame.png')
    expect(screen.getByTestId('print-comment-attachments').textContent).toContain('notes.pdf')

    // Frame image requests point to backend frame endpoint
    const frameImgs = container.querySelectorAll('[data-testid="print-comment-frame"] img')
    expect(frameImgs).toHaveLength(2)
    expect(frameImgs[0].getAttribute('src')).toBe(
      '/api/files/asset-video-1/comments/frame?second=1.5&width=400',
    )

    // Simulate frame image load -> SVG overlay renders all 4 annotation shapes
    Object.defineProperty(frameImgs[0], 'naturalWidth', { value: 400, configurable: true })
    Object.defineProperty(frameImgs[0], 'naturalHeight', { value: 225, configurable: true })
    fireEvent.load(frameImgs[0])
    fireEvent.load(frameImgs[1])

    expect(screen.queryByTestId('print-frames-progress')).toBeNull()
    const overlay = screen.getByTestId('print-annotation-overlay')
    expect(overlay.querySelector('rect')).not.toBeNull()
    expect(overlay.querySelector('polygon')).not.toBeNull()
    expect(overlay.querySelector('path')).not.toBeNull()

    // Clicking Print button invokes window.print()
    fireEvent.click(screen.getByTestId('print-comments-button'))
    expect(printMock).toHaveBeenCalledTimes(1)
  })

  it('uses public share frame endpoint with password query param when shareId is set', () => {
    const { container } = render(
      <PrintCommentsView
        asset={videoAsset}
        breadcrumbs={['Client Share']}
        comments={[makeComment({ id: 'c-1', second: 3.25 })]}
        shareId="share-99"
        sharePassword="pw!"
      />,
    )

    const img = container.querySelector('[data-testid="print-comment-frame"] img')
    expect(img?.getAttribute('src')).toBe(
      '/api/shares/share-99/files/asset-video-1/comments/frame?second=3.25&width=400&p=pw%21',
    )
  })

  it('reuses image proxy URL directly for image assets without calling frame API', () => {
    const imageAsset = {
      ...videoAsset,
      id: 'asset-img-1',
      name: 'poster.png',
      proxyType: 'image',
      media: {
        proxyType: 'image',
        imageTranscodes: [
          {
            id: 't1',
            key: 'k1',
            url: 'https://cdn.example.com/poster-600.webp',
            width: 600,
            height: 400,
            size: 100,
          },
        ],
        videoTranscodes: [],
      },
    } as unknown as AssetInfo

    const { container } = render(
      <PrintCommentsView
        asset={imageAsset}
        breadcrumbs={['Design']}
        comments={[makeComment({ id: 'c-img', second: null, message: 'Adjust logo spacing' })]}
      />,
    )

    expect(screen.getByText('Sorted by oldest')).toBeDefined()
    const img = container.querySelector('[data-testid="print-comment-frame"] img')
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/poster-600.webp')
  })

  it('supports PDF page formatting, 3D angle formatting, and audio without frame column', () => {
    const pdfAsset = {
      ...videoAsset,
      id: 'asset-pdf-1',
      name: 'script.pdf',
      proxyType: 'pdf',
      media: { proxyType: 'pdf', imageTranscodes: [], videoTranscodes: [] },
    } as unknown as AssetInfo

    const { rerender } = render(
      <PrintCommentsView
        asset={pdfAsset}
        breadcrumbs={['Docs']}
        comments={[makeComment({ id: 'c-pdf', second: 3, message: 'Fix typo on page 3' })]}
      />,
    )
    expect(screen.getByText('Sorted by page')).toBeDefined()
    expect(screen.getByTestId('print-comment-timestamp').textContent).toBe('P3')

    const modelAsset = {
      ...videoAsset,
      id: 'asset-3d-1',
      name: 'chair.glb',
      proxyType: '3d',
      media: { proxyType: '3d', imageTranscodes: [], videoTranscodes: [] },
    } as unknown as AssetInfo

    rerender(
      <PrintCommentsView
        asset={modelAsset}
        breadcrumbs={['Models']}
        comments={[makeComment({ id: 'c-3d', second: 3, message: 'Smooth bevel' })]}
      />,
    )
    expect(screen.getByText('Sorted by angle')).toBeDefined()
    expect(screen.getByTestId('print-comment-timestamp').textContent).toBe('270°')

    const audioAsset = {
      ...videoAsset,
      id: 'asset-audio-1',
      name: 'mix.wav',
      proxyType: 'audio',
      preview: null,
      media: {
        proxyType: 'audio',
        imageTranscodes: [],
        videoTranscodes: [],
        metadata: { frameRate: 30 },
      },
    } as unknown as AssetInfo

    rerender(
      <PrintCommentsView
        asset={audioAsset}
        breadcrumbs={['Audio']}
        comments={[makeComment({ id: 'c-aud', second: 2, message: 'Reduce reverb' })]}
      />,
    )
    expect(screen.queryByTestId('print-comment-frame')).toBeNull()
  })

  it('shows friendly fallback when a frame fails to load', () => {
    const { container } = render(
      <PrintCommentsView
        asset={videoAsset}
        breadcrumbs={['Project']}
        comments={[makeComment({ id: 'c-err', second: 2 })]}
      />,
    )

    const img = container.querySelector('[data-testid="print-comment-frame"] img')!
    fireEvent.error(img)

    expect(screen.getByTestId('print-frame-error').textContent).toContain('Frame unavailable')
    expect(screen.queryByTestId('print-frames-progress')).toBeNull()
  })
})
