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
})
