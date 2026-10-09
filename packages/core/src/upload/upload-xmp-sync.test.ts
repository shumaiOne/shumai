import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncXmpSidecarsAfterCommit } from '@shumai/core/src/metadata/xmp-sidecar-sync'
import { UploadService } from './upload'

vi.mock('@shumai/core/src/metadata/xmp-sidecar-sync', () => ({
  syncXmpSidecarsAfterCommit: vi.fn(),
}))
vi.mock('@shumai/core/src/s3/s3', () => ({
  getStorageBackend: vi.fn().mockReturnValue('s3'),
  s3Service: { getObjectSize: vi.fn().mockResolvedValue(100) },
}))

const syncMock = vi.mocked(syncXmpSidecarsAfterCommit)

/** A confirmFileUpload run against a fake client, recording the order of transaction events. */
async function confirm(assetName: string) {
  const events: string[] = []
  const tx = {
    asset: { update: vi.fn().mockResolvedValue({ sizeByte: 100n }) },
    task: { update: vi.fn().mockResolvedValue({ uploaded: 1, total: 2 }) },
  }
  const fakePrisma = {
    asset: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'asset-1',
        name: assetName,
        mediaType: 'application/octet-stream',
        parentId: null,
        projectId: 'p1',
        storageKey: { key: 'k' },
        project: { team: { id: 't1' } },
      }),
    },
    $transaction: vi.fn(async (fn: (client: unknown) => Promise<void>) => {
      events.push('tx-start')
      await fn(tx)
      events.push('tx-end')
    }),
  }
  const service = new UploadService(fakePrisma as never)
  const trigger = vi.spyOn(service, 'triggerPostUploadWorkflows').mockImplementation(async () => {
    events.push('trigger')
  })
  syncMock.mockImplementation(() => {
    events.push('sync')
  })
  await service.confirmFileUpload('u1', 'task-1', { fileId: 'asset-1' } as never)
  return { events, tx, trigger }
}

describe('confirmFileUpload and XMP sidecars', () => {
  beforeEach(() => {
    syncMock.mockReset()
  })

  it('syncs a sidecar only after the transaction has committed, without the transaction client', async () => {
    const { events, tx, trigger } = await confirm('DSCF1.RAF.xmp')
    expect(events).toEqual(['tx-start', 'trigger', 'tx-end', 'sync'])
    expect(trigger).toHaveBeenCalledWith(tx, 'asset-1', 't1', 'p1')
    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(syncMock).toHaveBeenCalledWith('asset-1')
  })

  it('does not sync for an ordinary file', async () => {
    await confirm('DSCF1.RAF')
    expect(syncMock).not.toHaveBeenCalled()
  })
})
