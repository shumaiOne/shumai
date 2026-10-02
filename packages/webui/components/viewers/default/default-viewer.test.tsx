// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DefaultViewer } from './default-viewer'
import type { AssetInfo } from '@shumai/dtos'

vi.mock('@/ui/paraglide/messages.js', () => ({
  m: new Proxy({}, { get: () => () => '' }),
}))

describe('DefaultViewer', () => {
  afterEach(() => {
    cleanup()
  })
  it('renders failed state when file status is failed', () => {
    const file = {
      id: 'failed-doc',
      name: 'failed.docx',
      status: 'failed',
      media: {
        error: 'PDF generation failed',
      },
    } as unknown as AssetInfo

    render(<DefaultViewer file={file} />)
    expect(screen.getByTestId('default-viewer-failed-state')).toBeDefined()
    expect(screen.getByText('PDF generation failed')).toBeDefined()
  })

  it('renders standard download view when file is not failed', () => {
    const file = {
      id: 'file-1',
      name: 'archive.zip',
      status: 'processed',
      sizeByte: 1024,
      media: {
        original: { key: 'raw/archive.zip' },
      },
    } as unknown as AssetInfo

    render(<DefaultViewer file={file} />)
    expect(screen.queryByTestId('default-viewer-failed-state')).toBeNull()
    expect(screen.getByText('Download')).toBeDefined()
  })
})
