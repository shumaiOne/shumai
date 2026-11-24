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

  it('displays 480p instead of 360p for 480p video transcode in download menu', () => {
    render(
      <MobileFileHeader
        fileName="scene1.mp4"
        activeFileId="file-1"
        allowDownload={true}
        onBack={vi.fn()}
        downloadInfo={{
          originalKey: 'raw.mov',
          videoTranscodes: [
            {
              key: 'scene1-480p.mp4',
              width: 854,
              height: 480,
              resolution: '480p',
              hdr: false,
            },
          ],
        }}
      />,
    )

    const menuBtn = screen.getByLabelText(/More options/i)
    fireEvent.pointerDown(menuBtn, { button: 0, ctrlKey: false })

    const downloadSubTrigger = screen.getByText('Download')
    fireEvent.click(downloadSubTrigger)

    const items = screen.getAllByRole('menuitem')
    expect(items.some((i) => i.textContent?.includes('480p'))).toBe(true)
    expect(items.some((i) => i.textContent?.includes('360p'))).toBe(false)
  })

  it('correctly labels legacy portrait video transcode in download menu using long side fallback', () => {
    render(
      <MobileFileHeader
        fileName="portrait.mp4"
        activeFileId="file-portrait"
        allowDownload={true}
        onBack={vi.fn()}
        downloadInfo={{
          originalKey: 'raw.mp4',
          videoTranscodes: [
            {
              key: 'portrait-legacy.mp4',
              width: 1080,
              height: 1920,
              hdr: false,
            },
          ],
        }}
      />,
    )

    const menuBtn = screen.getByLabelText(/More options/i)
    fireEvent.pointerDown(menuBtn, { button: 0, ctrlKey: false })

    const downloadSubTrigger = screen.getByText('Download')
    fireEvent.click(downloadSubTrigger)

    const items = screen.getAllByRole('menuitem')
    expect(items.some((i) => i.textContent?.includes('1080p'))).toBe(true)
    expect(items.some((i) => i.textContent?.includes('1920p'))).toBe(false)
  })

  it('renders archive icon in front of file name without archived text when status is archived', () => {
    render(
      <MobileFileHeader
        fileName="video.mp4"
        activeFileId="file-archived"
        status="archived"
        onBack={vi.fn()}
      />,
    )

    const archiveIcon = screen.getByTestId('detail-header-archived-badge')
    expect(archiveIcon).toBeDefined()
    expect(screen.queryByText('Archived')).toBeNull()
    expect(screen.queryByText('已归档')).toBeNull()
  })

  it('renders archive icon in front of file name without restoring text when status is restoring', () => {
    render(
      <MobileFileHeader
        fileName="restoring-video.mp4"
        activeFileId="file-restoring"
        status="restoring"
        onBack={vi.fn()}
      />,
    )

    const archiveIcon = screen.getByTestId('detail-header-restoring-badge')
    expect(archiveIcon).toBeDefined()
    expect(screen.queryByText('Restoring...')).toBeNull()
    expect(screen.queryByText('恢复中...')).toBeNull()
  })

  it('renders Create Share Link and Add to Share Links at top of three-dot menu above Download for editors', () => {
    const onCreateShareLink = vi.fn()
    const onAddToShareLink = vi.fn()

    render(
      <MobileFileHeader
        fileName="clip.mp4"
        activeFileId="file-1"
        canEdit={true}
        allowDownload={true}
        downloadInfo={{ originalKey: 'clip.mp4' }}
        shareLinks={[
          {
            id: 'share-1',
            name: 'Client Review',
            isDisabled: false,
            allowDownload: true,
            hasPassword: false,
            rootFolderId: 'rf-1',
            projectId: 'proj-1',
            isExpired: false,
            createdAt: '2026-11-24T00:00:00.000Z',
            updatedAt: '2026-11-24T00:00:00.000Z',
          },
        ]}
        onCreateShareLink={onCreateShareLink}
        onAddToShareLink={onAddToShareLink}
        onBack={vi.fn()}
      />,
    )

    const menuBtn = screen.getByLabelText(/More options/i)
    fireEvent.pointerDown(menuBtn, { button: 0, ctrlKey: false })

    const items = screen.getAllByRole('menuitem')
    expect(items[0].textContent).toContain('Create Share Link')
    expect(items[1].textContent).toContain('Add to Share Links')
    expect(items[2].textContent).toContain('Download')

    fireEvent.click(items[0])
    expect(onCreateShareLink).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(menuBtn, { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByText('Add to Share Links'))
    fireEvent.click(screen.getByText('Client Review'))
    expect(onAddToShareLink).toHaveBeenCalledWith('share-1')
  })

  it('hides share link options when public or when canEdit is false', () => {
    const { rerender } = render(
      <MobileFileHeader
        fileName="clip.mp4"
        activeFileId="file-1"
        canEdit={false}
        onCreateShareLink={vi.fn()}
        onAddToShareLink={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    const menuBtn = screen.getByLabelText(/More options/i)
    fireEvent.pointerDown(menuBtn, { button: 0, ctrlKey: false })
    expect(screen.queryByText('Create Share Link')).toBeNull()

    rerender(
      <MobileFileHeader
        fileName="clip.mp4"
        activeFileId="file-1"
        canEdit={true}
        isPublic={true}
        onCreateShareLink={vi.fn()}
        onAddToShareLink={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.queryByText('Create Share Link')).toBeNull()
  })
})
