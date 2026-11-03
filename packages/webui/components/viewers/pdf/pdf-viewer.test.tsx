// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PdfViewer } from './pdf-viewer'
import type { AssetInfo } from '@shumai/dtos'

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

describe('PdfViewer', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders archived placeholder when native PDF is archived and pdfTranscode.url is absent', () => {
    const archivedPdf: AssetInfo = {
      id: 'pdf-1',
      name: 'document.pdf',
      type: 'file',
      status: 'archived',
      sizeByte: 1024,
      fileCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      media: {
        original: { key: 'files/pdf-1/document.pdf' },
        pdfTranscode: { key: 'files/pdf-1/document.pdf' },
      },
    } as AssetInfo

    render(<PdfViewer file={archivedPdf} />)

    expect(screen.getByTestId('pdf-viewer-archived-state')).toBeTruthy()
  })
})
