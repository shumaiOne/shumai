// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  getFileTypeCategory,
  getAssetVersionLabel,
  FileItem,
  FileCardItem,
  type AssetSummary,
} from './FileItem'

// Configure React 19 act environment for happy-dom
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('getFileTypeCategory', () => {
  it('identifies folder type', () => {
    const asset: AssetSummary = {
      id: 'f1',
      name: 'My Folder',
      type: 'folder',
    }
    expect(getFileTypeCategory(asset)).toBe('folder')
  })

  it('identifies video by mimeType', () => {
    const asset: AssetSummary = {
      id: 'v1',
      name: 'clip.dat',
      type: 'file',
      mimeType: 'video/mp4',
    }
    expect(getFileTypeCategory(asset)).toBe('video')
  })

  it('identifies video by extension', () => {
    const extensions = ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'webm']
    for (const ext of extensions) {
      const asset: AssetSummary = {
        id: `v-${ext}`,
        name: `sample.${ext}`,
        type: 'file',
      }
      expect(getFileTypeCategory(asset)).toBe('video')
    }
  })

  it('identifies audio by mimeType or extension', () => {
    const asset1: AssetSummary = {
      id: 'a1',
      name: 'audio.raw',
      type: 'file',
      mimeType: 'audio/wav',
    }
    const asset2: AssetSummary = {
      id: 'a2',
      name: 'track.mp3',
      type: 'file',
    }
    expect(getFileTypeCategory(asset1)).toBe('audio')
    expect(getFileTypeCategory(asset2)).toBe('audio')
  })

  it('identifies image by mimeType or extension', () => {
    const asset1: AssetSummary = {
      id: 'i1',
      name: 'photo.bin',
      type: 'file',
      mimeType: 'image/png',
    }
    const asset2: AssetSummary = {
      id: 'i2',
      name: 'art.jpg',
      type: 'file',
    }
    expect(getFileTypeCategory(asset1)).toBe('image')
    expect(getFileTypeCategory(asset2)).toBe('image')
  })

  it('falls back to generic file', () => {
    const asset: AssetSummary = {
      id: 'doc1',
      name: 'notes.pdf',
      type: 'file',
      mimeType: 'application/pdf',
    }
    expect(getFileTypeCategory(asset)).toBe('file')
  })
})

describe('FileItem and FileCardItem UI Components', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const mockOnClick = vi.fn()
  const mockOnImportRaw = vi.fn()
  const mockOnSelectVideoForImport = vi.fn()

  const folderAsset: AssetSummary = {
    id: 'folder-1',
    name: 'Raw Footage',
    type: 'folder',
    fileCount: 5,
  }

  const imageAsset: AssetSummary = {
    id: 'img-1',
    name: 'logo.png',
    type: 'file',
    mimeType: 'image/png',
    sizeByte: 2048,
  }

  const videoAsset: AssetSummary = {
    id: 'vid-1',
    name: 'interview.mp4',
    type: 'file',
    mimeType: 'video/mp4',
    sizeByte: 50 * 1024 * 1024,
  }

  it('FileItem navigates into folder on click without download button', () => {
    render(
      <FileItem
        asset={folderAsset}
        onClick={mockOnClick}
        onImportRaw={mockOnImportRaw}
        onSelectVideoForImport={mockOnSelectVideoForImport}
      />,
    )

    expect(screen.getByText('Raw Footage')).toBeTruthy()
    expect(screen.queryByTitle('Import into Premiere Pro')).toBeNull()

    fireEvent.click(screen.getByText('Raw Footage'))
    expect(mockOnClick).toHaveBeenCalled()
    expect(mockOnImportRaw).not.toHaveBeenCalled()
  })

  it('FileCardItem calls onImportRaw when download button is clicked for non-video, but clicking card does not', () => {
    render(
      <FileCardItem
        asset={imageAsset}
        onClick={mockOnClick}
        onImportRaw={mockOnImportRaw}
        onSelectVideoForImport={mockOnSelectVideoForImport}
      />,
    )

    expect(screen.getByText('logo.png')).toBeTruthy()
    // Clicking the file title / card text should NOT trigger import
    fireEvent.click(screen.getByText('logo.png'))
    expect(mockOnImportRaw).not.toHaveBeenCalled()

    const downloadBtn = screen.getByTitle('Import into Premiere Pro')
    expect(downloadBtn).toBeTruthy()

    fireEvent.click(downloadBtn)
    expect(mockOnImportRaw).toHaveBeenCalledWith(imageAsset)
  })

  it('FileCardItem calls onSelectVideoForImport when download button is clicked for video', () => {
    render(
      <FileCardItem
        asset={videoAsset}
        onClick={mockOnClick}
        onImportRaw={mockOnImportRaw}
        onSelectVideoForImport={mockOnSelectVideoForImport}
      />,
    )

    expect(screen.getByText('interview.mp4')).toBeTruthy()
    const downloadBtn = screen.getByTitle('Import into Premiere Pro')
    fireEvent.click(downloadBtn)

    expect(mockOnSelectVideoForImport).toHaveBeenCalledWith(videoAsset)
    expect(mockOnImportRaw).not.toHaveBeenCalled()
  })

  it('FileCardItem renders sp-icon-link when isLinked is false, and triggers onLinkSequence on click', () => {
    const mockOnLinkSequence = vi.fn()
    const { container } = render(
      <FileCardItem
        asset={videoAsset}
        onClick={mockOnClick}
        onLinkSequence={mockOnLinkSequence}
        isLinked={false}
      />,
    )

    const linkIcon = container.querySelector('sp-icon-link')
    const unlinkIcon = container.querySelector('sp-icon-unlink')
    expect(linkIcon).toBeTruthy()
    expect(unlinkIcon).toBeNull()

    const linkBtn = screen.getByTitle('Link to Sequence')
    expect(linkBtn).toBeTruthy()
    fireEvent.click(linkBtn)
    expect(mockOnLinkSequence).toHaveBeenCalledWith(videoAsset)
  })

  it('FileCardItem renders sp-icon-unlink when isLinked is true, and triggers onUnlinkSequence on click', () => {
    const mockOnLinkSequence = vi.fn()
    const mockOnUnlinkSequence = vi.fn()
    const { container } = render(
      <FileCardItem
        asset={videoAsset}
        onClick={mockOnClick}
        onLinkSequence={mockOnLinkSequence}
        onUnlinkSequence={mockOnUnlinkSequence}
        isLinked={true}
        linkedSequenceName="Cut_v1"
      />,
    )

    const linkIcon = container.querySelector('sp-icon-link')
    const unlinkIcon = container.querySelector('sp-icon-unlink')
    expect(linkIcon).toBeNull()
    expect(unlinkIcon).toBeTruthy()

    const unlinkBtn = screen.getByTitle('Unlink from Cut_v1')
    expect(unlinkBtn).toBeTruthy()
    fireEvent.click(unlinkBtn)
    expect(mockOnUnlinkSequence).toHaveBeenCalledWith(videoAsset)
    expect(mockOnLinkSequence).not.toHaveBeenCalled()
  })

  it('FileItem renders sp-icon-unlink when isLinked is true', () => {
    const mockOnLinkSequence = vi.fn()
    const mockOnUnlinkSequence = vi.fn()
    const { container } = render(
      <FileItem
        asset={videoAsset}
        onClick={mockOnClick}
        onLinkSequence={mockOnLinkSequence}
        onUnlinkSequence={mockOnUnlinkSequence}
        isLinked={true}
        linkedSequenceName="Cut_v1"
      />,
    )

    const linkIcon = container.querySelector('sp-icon-link')
    const unlinkIcon = container.querySelector('sp-icon-unlink')
    expect(linkIcon).toBeNull()
    expect(unlinkIcon).toBeTruthy()

    const unlinkBtn = screen.getByTitle('Unlink from Cut_v1')
    expect(unlinkBtn).toBeTruthy()
    fireEvent.click(unlinkBtn)
    expect(mockOnUnlinkSequence).toHaveBeenCalledWith(videoAsset)
  })

  it('FileCardItem renders version in details when asset has versionStack', () => {
    const versionedAsset: AssetSummary = {
      id: 'vid-v2',
      name: 'interview_cut.mp4',
      type: 'file',
      mimeType: 'video/mp4',
      sizeByte: 20 * 1024 * 1024,
      versionStack: {
        id: 'stack-1',
        versions: [
          { version: 2, current: true, id: 'vid-v2', name: 'interview_cut.mp4' },
          { version: 1, current: false, id: 'vid-v1', name: 'interview_cut_v1.mp4' },
        ],
      },
    }

    render(<FileCardItem asset={versionedAsset} onClick={mockOnClick} />)

    expect(screen.getByText('v2')).toBeTruthy()
  })

  it('FileCardItem does not render version when asset has no versionStack', () => {
    render(<FileCardItem asset={videoAsset} onClick={mockOnClick} />)

    expect(screen.queryByText(/^v\d+$/)).toBeNull()
  })

  it('FileItem renders version in subtext when asset has versionStack', () => {
    const versionedAsset: AssetSummary = {
      id: 'vid-v2',
      name: 'interview_cut.mp4',
      type: 'file',
      mimeType: 'video/mp4',
      sizeByte: 20 * 1024 * 1024,
      versionStack: {
        id: 'stack-1',
        versions: [
          { version: 2, current: true, id: 'vid-v2', name: 'interview_cut.mp4' },
          { version: 1, current: false, id: 'vid-v1', name: 'interview_cut_v1.mp4' },
        ],
      },
    }

    render(<FileItem asset={versionedAsset} onClick={mockOnClick} />)

    expect(screen.getByText(/v2 •/)).toBeTruthy()
  })
})

describe('getAssetVersionLabel', () => {
  it('returns null for folder asset', () => {
    const folder: AssetSummary = {
      id: 'f1',
      name: 'Footage',
      type: 'folder',
    }
    expect(getAssetVersionLabel(folder)).toBeNull()
  })

  it('returns null for standalone file without versionStack', () => {
    const file: AssetSummary = {
      id: 'file1',
      name: 'clip.mp4',
      type: 'file',
    }
    expect(getAssetVersionLabel(file)).toBeNull()
  })

  it('returns null when versionStack has empty versions array', () => {
    const file: AssetSummary = {
      id: 'file1',
      name: 'clip.mp4',
      type: 'file',
      versionStack: {
        id: 'stack-1',
        versions: [],
      },
    }
    expect(getAssetVersionLabel(file)).toBeNull()
  })

  it('returns formatted version matching asset id', () => {
    const file: AssetSummary = {
      id: 'ver-1',
      name: 'cut.mov',
      type: 'file',
      versionStack: {
        id: 'stack-1',
        versions: [
          { version: 3, current: false, id: 'ver-3' },
          { version: 2, current: false, id: 'ver-2' },
          { version: 1, current: false, id: 'ver-1' },
        ],
      },
    }
    expect(getAssetVersionLabel(file)).toBe('v1')
  })

  it('returns current version when asset id is stack id or does not match', () => {
    const file: AssetSummary = {
      id: 'stack-1',
      name: 'cut.mov',
      type: 'version_stack',
      versionStack: {
        id: 'stack-1',
        versions: [
          { version: 3, current: true, id: 'ver-3' },
          { version: 2, current: false, id: 'ver-2' },
          { version: 1, current: false, id: 'ver-1' },
        ],
      },
    }
    expect(getAssetVersionLabel(file)).toBe('v3')
  })
})
