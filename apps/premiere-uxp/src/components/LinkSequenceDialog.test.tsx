// @vitest-environment happy-dom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LinkSequenceDialog } from './LinkSequenceDialog'
import type { AssetSummary } from './FileItem'
import * as premiereService from '../services/premiere'
import * as linkStorage from '../services/linkStorage'
import * as markersService from '../services/markers'
import type { Project, Sequence } from '@adobe/premierepro'
import type { CommentInfo } from '@shumai/dtos'

// Configure React 19 act environment for happy-dom
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('LinkSequenceDialog Component', () => {
  const mockOnClose = vi.fn()
  const mockOnLinkSuccess = vi.fn()

  const videoAsset: AssetSummary = {
    id: 'asset-vid-1',
    name: 'interview_clip.mp4',
    type: 'file',
    mimeType: 'video/mp4',
    sizeByte: 1024 * 1024 * 45,
    preview: {
      duration: 154,
    },
    commentsCount: 3,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when closed or asset is null', () => {
    const { container } = render(
      <LinkSequenceDialog
        asset={videoAsset}
        endpoint="https://api.shumai.test"
        apiKey="test-key"
        isOpen={false}
        onClose={mockOnClose}
        onLinkSuccess={mockOnLinkSuccess}
      />,
    )
    expect(container.firstChild).toBeNull()

    const { container: containerNull } = render(
      <LinkSequenceDialog
        asset={null}
        endpoint="https://api.shumai.test"
        apiKey="test-key"
        isOpen={true}
        onClose={mockOnClose}
        onLinkSuccess={mockOnLinkSuccess}
      />,
    )
    expect(containerNull.firstChild).toBeNull()
  })

  it('displays error message when no active project is open', async () => {
    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(null)

    await act(async () => {
      render(
        <LinkSequenceDialog
          asset={videoAsset}
          endpoint="https://api.shumai.test"
          apiKey="test-key"
          isOpen={true}
          onClose={mockOnClose}
          onLinkSuccess={mockOnLinkSuccess}
        />,
      )
    })

    expect(screen.getByText(/no active premiere pro project found/i)).toBeDefined()
  })

  it('lists project sequences and highlights active sequence without sequence icon', async () => {
    const mockSeq1 = { guid: 'seq-1', name: 'Rough Cut' }
    const mockSeq2 = { guid: 'seq-2', name: 'Fine Cut' }
    const mockProject = { guid: 'proj-1' }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([
      mockSeq1,
      mockSeq2,
    ] as unknown as Sequence[])
    vi.spyOn(premiereService, 'getActiveSequence').mockResolvedValue(
      mockSeq2 as unknown as Sequence,
    )
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([])

    let renderedContainer: HTMLElement = null!
    await act(async () => {
      const { container } = render(
        <LinkSequenceDialog
          asset={videoAsset}
          endpoint="https://api.shumai.test"
          apiKey="test-key"
          isOpen={true}
          onClose={mockOnClose}
          onLinkSuccess={mockOnLinkSuccess}
        />,
      )
      renderedContainer = container
    })

    expect(screen.getByText('Rough Cut')).toBeDefined()
    expect(screen.getByText('Fine Cut')).toBeDefined()
    expect(screen.getByText('Active')).toBeDefined()
    expect(renderedContainer.querySelectorAll('.shumai-option-card sp-icon-filmstrip').length).toBe(
      0,
    )
  })

  it('executes sync and invokes onLinkSuccess on confirmation', async () => {
    const mockSeq1 = { guid: 'seq-1', name: 'Rough Cut' }
    const mockProject = { guid: 'proj-1' }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([
      mockSeq1,
    ] as unknown as Sequence[])
    vi.spyOn(premiereService, 'getActiveSequence').mockResolvedValue(
      mockSeq1 as unknown as Sequence,
    )
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([])
    vi.spyOn(markersService, 'fetchAssetComments').mockResolvedValue([
      { id: 'comm-1', second: 10, message: 'Test marker' } as unknown as CommentInfo,
    ])

    const mockUpdatedLink = {
      sequenceGuid: 'seq-1',
      sequenceName: 'Rough Cut',
      assetId: 'asset-vid-1',
      assetName: 'interview_clip.mp4',
      syncedCommentIds: ['comm-1'],
      lastSyncAt: Date.now(),
      totalCommentsSynced: 1,
    }

    vi.spyOn(markersService, 'syncCommentsToSequence').mockResolvedValue({
      updatedLink: mockUpdatedLink,
      addedCount: 1,
    })

    await act(async () => {
      render(
        <LinkSequenceDialog
          asset={videoAsset}
          endpoint="https://api.shumai.test"
          apiKey="test-key"
          isOpen={true}
          onClose={mockOnClose}
          onLinkSuccess={mockOnLinkSuccess}
        />,
      )
    })

    const linkBtn = screen.getByText('Link Sequence')
    await act(async () => {
      fireEvent.click(linkBtn)
    })

    expect(markersService.fetchAssetComments).toHaveBeenCalledWith(
      'https://api.shumai.test',
      'test-key',
      'asset-vid-1',
    )
    expect(markersService.syncCommentsToSequence).toHaveBeenCalledWith(
      mockProject,
      mockSeq1,
      expect.any(Array),
      expect.objectContaining({
        endpoint: 'https://api.shumai.test',
        sequenceGuid: 'seq-1',
        assetId: 'asset-vid-1',
      }),
    )
    expect(mockOnLinkSuccess).toHaveBeenCalledWith(mockUpdatedLink, 1)
    expect(mockOnClose).toHaveBeenCalled()
  })
})
