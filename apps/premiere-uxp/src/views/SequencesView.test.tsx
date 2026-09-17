// @vitest-environment happy-dom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SequencesView } from './SequencesView'
import type { Project, Sequence } from '@adobe/premierepro'
import * as premiereService from '../services/premiere'
import * as linkStorage from '../services/linkStorage'
import * as markersService from '../services/markers'
import type { CommentInfo } from '@shumai/dtos'

// Configure React 19 act environment for happy-dom
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('SequencesView Component', () => {
  const mockSwitchToBrowse = vi.fn()
  const mockOnLinkCountChange = vi.fn()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders unified empty state when no sequences are linked', async () => {
    const mockSeq = { guid: 'seq-1', name: 'Sequence 01' }
    const mockProject = { guid: 'proj-1' }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getActiveSequence').mockResolvedValue(mockSeq as unknown as Sequence)
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([mockSeq as unknown as Sequence])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([])

    await act(async () => {
      render(
        <SequencesView
          endpoint="https://api.shumai.test"
          apiKey="test-key"
          onSwitchToBrowse={mockSwitchToBrowse}
          onLinkCountChange={mockOnLinkCountChange}
        />,
      )
    })

    expect(screen.getByText('No Linked Sequences')).toBeDefined()
    expect(screen.getByText(/Sequence 01/i)).toBeDefined()
    const browseButton = screen.getByText('Browse Assets to Link')
    expect(browseButton).toBeDefined()
    fireEvent.click(browseButton)
    expect(mockSwitchToBrowse).toHaveBeenCalled()
  })

  it('renders linked sequence card and handles unlink', async () => {
    const mockSeq = { guid: 'seq-1', name: 'Sequence 01' }
    const mockProject = { guid: 'proj-1' }
    const mockLink = {
      sequenceGuid: 'seq-1',
      sequenceName: 'Sequence 01',
      assetId: 'asset-1',
      assetName: 'final_edit.mp4',
      syncedCommentIds: ['comm-1'],
      lastSyncAt: Date.now(),
      totalCommentsSynced: 1,
    }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getActiveSequence').mockResolvedValue(mockSeq as unknown as Sequence)
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([mockSeq as unknown as Sequence])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([mockLink])
    vi.spyOn(linkStorage, 'removeSequenceLink').mockResolvedValue(true)

    await act(async () => {
      render(
        <SequencesView
          endpoint="https://api.shumai.test"
          apiKey="test-key"
          onSwitchToBrowse={mockSwitchToBrowse}
          onLinkCountChange={mockOnLinkCountChange}
        />,
      )
    })

    expect(screen.getAllByText('Sequence 01').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Asset: final_edit.mp4/i).length).toBeGreaterThan(0)

    const unlinkButtons = screen.getAllByTitle('Unlink sequence')
    expect(unlinkButtons.length).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.click(unlinkButtons[0])
    })

    expect(linkStorage.removeSequenceLink).toHaveBeenCalledWith(mockProject, mockSeq)
  })

  it('filters out foreign endpoint links from the view and link count', async () => {
    const mockSeq1 = { guid: 'seq-1', name: 'Sequence Foreign' }
    const mockSeq2 = { guid: 'seq-2', name: 'Sequence Staging' }
    const mockProject = { guid: 'proj-1' }
    const foreignLink = {
      sequenceGuid: 'seq-1',
      sequenceName: 'Sequence Foreign',
      assetId: 'asset-dev',
      assetName: 'dev_asset.mp4',
      endpoint: 'http://localhost:3000',
      syncedCommentIds: [],
      lastSyncAt: Date.now(),
      totalCommentsSynced: 0,
    }
    const stagingLink = {
      sequenceGuid: 'seq-2',
      sequenceName: 'Sequence Staging',
      assetId: 'asset-staging',
      assetName: 'staging_asset.mp4',
      endpoint: 'https://staging.shumai.one',
      syncedCommentIds: [],
      lastSyncAt: Date.now(),
      totalCommentsSynced: 0,
    }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getActiveSequence').mockResolvedValue(
      mockSeq1 as unknown as Sequence,
    )
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([
      mockSeq1 as unknown as Sequence,
      mockSeq2 as unknown as Sequence,
    ])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([foreignLink, stagingLink])

    await act(async () => {
      render(
        <SequencesView
          endpoint="https://staging.shumai.one"
          apiKey="staging-key"
          onSwitchToBrowse={mockSwitchToBrowse}
          onLinkCountChange={mockOnLinkCountChange}
        />,
      )
    })

    // Foreign link should be completely hidden
    expect(screen.queryByText('dev_asset.mp4')).toBeNull()
    expect(screen.queryByText(/Server:/i)).toBeNull()

    // Matching link should be visible
    expect(screen.getAllByText(/staging_asset.mp4/i).length).toBeGreaterThan(0)

    // Active sequence (seq-1) is linked to foreign server, so current sequence card should show unlinked state
    expect(screen.getByText('This sequence is not linked to any Shumai asset.')).toBeDefined()

    // Link count reported to parent should only count staging link (1)
    expect(mockOnLinkCountChange).toHaveBeenCalledWith(1)
  })

  it('shows error toast when manual sync fails', async () => {
    const mockSeq = { guid: 'seq-1', name: 'Sequence 01' }
    const mockProject = { guid: 'proj-1' }
    const mockLink = {
      sequenceGuid: 'seq-1',
      sequenceName: 'Sequence 01',
      assetId: 'asset-missing',
      assetName: 'missing.mp4',
      endpoint: 'https://staging.shumai.one',
      syncedCommentIds: [],
      lastSyncAt: Date.now(),
      totalCommentsSynced: 0,
    }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getActiveSequence').mockResolvedValue(mockSeq as unknown as Sequence)
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([mockSeq as unknown as Sequence])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([mockLink])

    vi.spyOn(markersService, 'fetchAssetComments').mockRejectedValue(
      new Error('Asset not found on this server (HTTP 404)'),
    )

    await act(async () => {
      render(
        <SequencesView
          endpoint="https://staging.shumai.one"
          apiKey="staging-key"
          onSwitchToBrowse={mockSwitchToBrowse}
          onLinkCountChange={mockOnLinkCountChange}
        />,
      )
    })

    const syncButtons = screen.getAllByTitle('Sync comments now')
    expect(syncButtons[0].hasAttribute('disabled')).toBe(false)

    await act(async () => {
      fireEvent.click(syncButtons[0])
    })

    expect(markersService.fetchAssetComments).toHaveBeenCalledWith(
      'https://staging.shumai.one',
      'staging-key',
      'asset-missing',
    )
    expect(screen.getByText('Asset not found on this server (HTTP 404)')).toBeDefined()
  })

  it('shows success toast when manual sync succeeds', async () => {
    const mockSeq = { guid: 'seq-1', name: 'Sequence 01' }
    const mockProject = { guid: 'proj-1' }
    const mockLink = {
      sequenceGuid: 'seq-1',
      sequenceName: 'Sequence 01',
      assetId: 'asset-1',
      assetName: 'final.mp4',
      endpoint: 'https://staging.shumai.one',
      syncedCommentIds: [],
      lastSyncAt: Date.now(),
      totalCommentsSynced: 0,
    }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getActiveSequence').mockResolvedValue(mockSeq as unknown as Sequence)
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([mockSeq as unknown as Sequence])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([mockLink])

    vi.spyOn(markersService, 'fetchAssetComments').mockResolvedValue([
      { id: 'comm-1', second: 10, message: 'Fix color' } as unknown as CommentInfo,
    ])
    vi.spyOn(markersService, 'syncCommentsToSequence').mockResolvedValue({
      updatedLink: { ...mockLink, syncedCommentIds: ['comm-1'], totalCommentsSynced: 1 },
      addedCount: 1,
    })

    await act(async () => {
      render(
        <SequencesView
          endpoint="https://staging.shumai.one"
          apiKey="staging-key"
          onSwitchToBrowse={mockSwitchToBrowse}
          onLinkCountChange={mockOnLinkCountChange}
        />,
      )
    })

    const syncButtons = screen.getAllByTitle('Sync comments now')
    await act(async () => {
      fireEvent.click(syncButtons[0])
    })

    expect(screen.getByText('Synced 1 new comment marker for "Sequence 01".')).toBeDefined()
  })
})
