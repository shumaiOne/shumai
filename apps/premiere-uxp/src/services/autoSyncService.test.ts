import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { autoSyncService } from './autoSyncService'
import type { Project, Sequence } from '@adobe/premierepro'
import type { CommentInfo } from '@shumai/dtos'
import * as premiereService from './premiere'
import * as linkStorage from './linkStorage'
import * as markersService from './markers'

describe('autoSyncService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
    autoSyncService.stop()
  })

  afterEach(() => {
    autoSyncService.stop()
    vi.useRealTimers()
  })

  it('starts and stops background interval without throwing', () => {
    autoSyncService.start('https://api.shumai.test', 'test-key')
    expect(autoSyncService['timer']).not.toBeNull()

    autoSyncService.stop()
    expect(autoSyncService['timer']).toBeNull()
  })

  it('syncs all linked sequences on triggerImmediateSync', async () => {
    const mockSeq = { guid: 'seq-1', name: 'Seq 1' }
    const mockProject = { guid: 'proj-1' }
    const mockLink = {
      sequenceGuid: 'seq-1',
      sequenceName: 'Seq 1',
      assetId: 'asset-1',
      assetName: 'video.mp4',
      syncedCommentIds: [],
      lastSyncAt: 0,
      totalCommentsSynced: 0,
    }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([mockSeq as unknown as Sequence])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([mockLink])
    vi.spyOn(markersService, 'fetchAssetComments').mockResolvedValue([
      { id: 'comm-1', second: 5, message: 'hello' } as unknown as CommentInfo,
    ])
    vi.spyOn(markersService, 'syncCommentsToSequence').mockResolvedValue({
      updatedLink: { ...mockLink, syncedCommentIds: ['comm-1'] },
      addedCount: 1,
    })

    autoSyncService.start('https://api.shumai.test', 'test-key')
    await autoSyncService.triggerImmediateSync()

    expect(markersService.fetchAssetComments).toHaveBeenCalledWith(
      'https://api.shumai.test',
      'test-key',
      'asset-1',
    )
    expect(markersService.syncCommentsToSequence).toHaveBeenCalled()
  })

  it('normalizes sequence GUIDs with braces and uppercase when matching against linked sequences', async () => {
    const mockSeq = { guid: '{B991F605-7BD7-4028-B05F-0BC36B66CD0A}', name: 'Seq Braced' }
    const mockProject = { guid: 'proj-1' }
    const mockLink = {
      sequenceGuid: 'b991f605-7bd7-4028-b05f-0bc36b66cd0a',
      sequenceName: 'Seq Braced',
      assetId: 'asset-99',
      assetName: 'video.mp4',
      syncedCommentIds: [],
      lastSyncAt: 0,
      totalCommentsSynced: 0,
    }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([mockSeq as unknown as Sequence])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([mockLink])
    vi.spyOn(markersService, 'fetchAssetComments').mockResolvedValue([
      { id: 'comm-1', second: 1, message: 'braced guid comment' } as unknown as CommentInfo,
    ])
    vi.spyOn(markersService, 'syncCommentsToSequence').mockResolvedValue({
      updatedLink: { ...mockLink, syncedCommentIds: ['comm-1'] },
      addedCount: 1,
    })

    autoSyncService.start('https://api.shumai.test', 'test-key')
    await autoSyncService.triggerImmediateSync()

    expect(markersService.fetchAssetComments).toHaveBeenCalledWith(
      'https://api.shumai.test',
      'test-key',
      'asset-99',
    )
    expect(markersService.syncCommentsToSequence).toHaveBeenCalledWith(
      mockProject,
      mockSeq,
      expect.any(Array),
      mockLink,
    )
  })

  it('skips linked sequences configured for a different server endpoint', async () => {
    const mockSeq1 = { guid: 'seq-foreign', name: 'Seq Foreign' }
    const mockSeq2 = { guid: 'seq-local', name: 'Seq Local' }
    const mockProject = { guid: 'proj-1' }

    const foreignLink = {
      sequenceGuid: 'seq-foreign',
      sequenceName: 'Seq Foreign',
      assetId: 'asset-foreign',
      assetName: 'foreign.mp4',
      endpoint: 'http://localhost:3000',
      syncedCommentIds: [],
      lastSyncAt: 0,
      totalCommentsSynced: 0,
    }

    const sameLink = {
      sequenceGuid: 'seq-local',
      sequenceName: 'Seq Local',
      assetId: 'asset-local',
      assetName: 'local.mp4',
      endpoint: 'https://staging.shumai.one/', // trailing slash variation
      syncedCommentIds: [],
      lastSyncAt: 0,
      totalCommentsSynced: 0,
    }

    vi.spyOn(premiereService, 'getActiveProject').mockResolvedValue(
      mockProject as unknown as Project,
    )
    vi.spyOn(premiereService, 'getAllSequences').mockResolvedValue([
      mockSeq1 as unknown as Sequence,
      mockSeq2 as unknown as Sequence,
    ])
    vi.spyOn(linkStorage, 'getAllLinkedSequences').mockResolvedValue([foreignLink, sameLink])
    vi.spyOn(markersService, 'fetchAssetComments').mockResolvedValue([
      { id: 'comm-1', second: 2, message: 'comment' } as unknown as CommentInfo,
    ])
    vi.spyOn(markersService, 'syncCommentsToSequence').mockResolvedValue({
      updatedLink: { ...sameLink, syncedCommentIds: ['comm-1'] },
      addedCount: 1,
    })

    autoSyncService.start('https://staging.shumai.one', 'test-key')
    await autoSyncService.triggerImmediateSync()

    // Foreign link should be skipped
    expect(markersService.fetchAssetComments).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'asset-foreign',
    )

    // Matching link should be synced
    expect(markersService.fetchAssetComments).toHaveBeenCalledWith(
      'https://staging.shumai.one',
      'test-key',
      'asset-local',
    )
    expect(markersService.syncCommentsToSequence).toHaveBeenCalledWith(
      mockProject,
      mockSeq2,
      expect.any(Array),
      sameLink,
    )
  })

  it('aborts syncing when stop() is called and credentials are reset', async () => {
    const fetchSpy = vi.spyOn(markersService, 'fetchAssetComments')
    autoSyncService.start('https://api.shumai.test', 'test-key')
    autoSyncService.stop()
    await autoSyncService.triggerImmediateSync()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
