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
    expect(screen.queryByText(/Browse Assets to Link/i)).toBeNull()
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

  it('displays foreign server badge and disables sync button when linked to a different endpoint', async () => {
    const mockSeq = { guid: 'seq-1', name: 'Sequence Foreign' }
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

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getActiveSequence').mockResolvedValue(mockSeq as unknown as Sequence)
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([mockSeq as unknown as Sequence])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([foreignLink])

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

    // Foreign server badge should be displayed
    expect(screen.getAllByText('Server: localhost:3000').length).toBeGreaterThan(0)

    // Sync button should be disabled with tooltip explaining the server mismatch
    const syncButtons = screen.getAllByTitle(/Linked to different server \(localhost:3000\)/i)
    expect(syncButtons.length).toBeGreaterThan(0)
    expect(syncButtons[0].hasAttribute('disabled')).toBe(true)
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
