// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileFileHeader } from './mobile-file-header'

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      files: {
        'download-url': {
          $post: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ url: 'https://example.com/download' }),
          }),
        },
      },
      shares: {
        ':shareId': {
          files: {
            ':fileId': {
              'download-url': {
                $post: vi.fn().mockResolvedValue({
                  ok: true,
                  json: async () => ({ url: 'https://example.com/share-download' }),
                }),
              },
            },
          },
        },
      },
    },
  },
}))

describe('MobileFileHeader', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders file name, folder name, and back button', () => {
    const onBack = vi.fn()
    render(
      <MobileFileHeader
        fileName="trailer.mp4"
        folderName="Rushes"
        activeFileId="file-1"
        onBack={onBack}
      />,
    )

    expect(screen.getByText('trailer.mp4')).toBeDefined()
    expect(screen.getByText('Rushes')).toBeDefined()

    const backBtn = screen.getByLabelText(/Back|Previous Page/i)
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders and calls prev/next file buttons when available', () => {
    const onPrevFile = vi.fn()
    const onNextFile = vi.fn()
    render(
      <MobileFileHeader
        fileName="clip2.mp4"
        activeFileId="file-2"
        onBack={vi.fn()}
        hasPrevFile={true}
        hasNextFile={true}
        onPrevFile={onPrevFile}
        onNextFile={onNextFile}
      />,
    )

    const prevBtn = screen.getByLabelText(/Previous file/i)
    const nextBtn = screen.getByLabelText(/Next file/i)

    fireEvent.click(prevBtn)
    expect(onPrevFile).toHaveBeenCalledTimes(1)

    fireEvent.click(nextBtn)
    expect(onNextFile).toHaveBeenCalledTimes(1)
  })

  it('renders version badge and version switch items if multiple versions exist', () => {
    const onSelectVersion = vi.fn()
    render(
      <MobileFileHeader
        fileName="v2.mp4"
        version={2}
        versions={[
          { id: 'v-1', version: 1, name: 'v1.mp4' },
          { id: 'v-2', version: 2, name: 'v2.mp4' },
        ]}
        activeFileId="v-2"
        onBack={vi.fn()}
        onSelectVersion={onSelectVersion}
      />,
    )

    expect(screen.getByText('v2')).toBeDefined()
  })

  it('shows action buttons in three-dot menu', () => {
    const onRename = vi.fn()
    const onDelete = vi.fn()
    render(
      <MobileFileHeader
        fileName="scene1.mp4"
        activeFileId="file-1"
        canEdit={true}
        onBack={vi.fn()}
        onRename={onRename}
        onDelete={onDelete}
      />,
    )

    const menuBtn = screen.getByLabelText(/More options/i)
    expect(menuBtn).toBeDefined()
    fireEvent.click(menuBtn)
  })
})
