// @vitest-environment happy-dom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ImportVideoDialog } from './ImportVideoDialog'
import type { AssetSummary } from './FileItem'
import * as importService from '../services/import'

// Configure React 19 act environment for happy-dom
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('ImportVideoDialog Component', () => {
  const mockOnClose = vi.fn()
  const mockOnImportRaw = vi.fn()
  const mockOnImportProxy = vi.fn()

  const videoAsset: AssetSummary = {
    id: 'asset-vid-1',
    name: 'interview_clip.mp4',
    type: 'file',
    mimeType: 'video/mp4',
    sizeByte: 1024 * 1024 * 45,
    preview: {
      duration: 154,
    },
  }

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders nothing when closed or asset is null', () => {
    const { container } = render(
      <ImportVideoDialog
        asset={videoAsset}
        endpoint="https://api.shumai.test"
        apiKey="test-key"
        isOpen={false}
        onClose={mockOnClose}
        onImportRaw={mockOnImportRaw}
        onImportProxy={mockOnImportProxy}
      />,
    )
    expect(container.firstChild).toBeNull()

    const { container: containerNull } = render(
      <ImportVideoDialog
        asset={null}
        endpoint="https://api.shumai.test"
        apiKey="test-key"
        isOpen={true}
        onClose={mockOnClose}
        onImportRaw={mockOnImportRaw}
        onImportProxy={mockOnImportProxy}
      />,
    )
    expect(containerNull.firstChild).toBeNull()
  })

  it('renders video info and selects original file by default', async () => {
    vi.spyOn(importService, 'fetchVideoProxies').mockResolvedValue([])

    await act(async () => {
      render(
        <ImportVideoDialog
          asset={videoAsset}
          endpoint="https://api.shumai.test"
          apiKey="test-key"
          isOpen={true}
          onClose={mockOnClose}
          onImportRaw={mockOnImportRaw}
          onImportProxy={mockOnImportProxy}
        />,
      )
    })

    expect(screen.getByText('Import Video')).toBeTruthy()
    expect(screen.getByText('interview_clip.mp4')).toBeTruthy()
    expect(screen.getByText('Original File')).toBeTruthy()
    expect(screen.getByText('No proxy transcodes available for this video.')).toBeTruthy()

    // Click Import button
    const importBtn = screen.getByText('Import')
    fireEvent.click(importBtn)

    expect(mockOnImportRaw).toHaveBeenCalledWith(videoAsset)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('fetches and allows selecting a proxy transcode', async () => {
    vi.spyOn(importService, 'fetchVideoProxies').mockResolvedValue([
      {
        id: 'proxy-1',
        label: '1080p (MP4)',
        resolution: '1080p',
        url: 'https://cdn.shumai.test/1080p.mp4',
        key: 'proxies/1080p.mp4',
        width: 1920,
        height: 1080,
        size: 1024 * 1024 * 12,
      },
    ])

    await act(async () => {
      render(
        <ImportVideoDialog
          asset={videoAsset}
          endpoint="https://api.shumai.test"
          apiKey="test-key"
          isOpen={true}
          onClose={mockOnClose}
          onImportRaw={mockOnImportRaw}
          onImportProxy={mockOnImportProxy}
        />,
      )
    })

    expect(screen.getByText('1080p (MP4)')).toBeTruthy()

    // Select the proxy card
    const proxyCard = screen.getByText('1080p (MP4)')
    fireEvent.click(proxyCard)

    // Click Import button
    const importBtn = screen.getByText('Import')
    fireEvent.click(importBtn)

    expect(mockOnImportProxy).toHaveBeenCalledWith(
      videoAsset,
      expect.objectContaining({ id: 'proxy-1', label: '1080p (MP4)' }),
    )
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('closes on Escape key or cancel button', async () => {
    vi.spyOn(importService, 'fetchVideoProxies').mockResolvedValue([])

    await act(async () => {
      render(
        <ImportVideoDialog
          asset={videoAsset}
          endpoint="https://api.shumai.test"
          apiKey="test-key"
          isOpen={true}
          onClose={mockOnClose}
          onImportRaw={mockOnImportRaw}
          onImportProxy={mockOnImportProxy}
        />,
      )
    })

    const cancelBtn = screen.getByText('Cancel')
    fireEvent.click(cancelBtn)
    expect(mockOnClose).toHaveBeenCalledTimes(1)

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(mockOnClose).toHaveBeenCalledTimes(2)
  })
})
