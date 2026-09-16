// @vitest-environment happy-dom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SequencesView } from './SequencesView'
import type { Project, Sequence } from '@adobe/premierepro'
import * as premiereService from '../services/premiere'
import * as linkStorage from '../services/linkStorage'

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
})
