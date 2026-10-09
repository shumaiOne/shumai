import { beforeEach, describe, expect, it, vi } from 'vitest'
import { metadataService } from './metadata'
import { syncXmpSidecars } from './xmp-sidecar-sync'

const mocks = vi.hoisted(() => ({
  assetFindUnique: vi.fn(),
  assetFindMany: vi.fn(),
  valueFindMany: vi.fn(),
  valueDeleteMany: vi.fn(),
  parse: vi.fn(),
}))

vi.mock('@shumai/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shumai/db')>()),
  prisma: {
    asset: { findUnique: mocks.assetFindUnique, findMany: mocks.assetFindMany },
    assetMetadataValue: { findMany: mocks.valueFindMany, deleteMany: mocks.valueDeleteMany },
  },
}))
vi.mock('../s3/s3', () => ({
  s3Service: { getObject: vi.fn().mockResolvedValue({ buffer: Buffer.from('x') }) },
}))
vi.mock('./metadata', () => ({
  metadataService: { updateAssetMetadata: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('./xmp-sidecar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./xmp-sidecar')>()),
  parseXmpSidecar: mocks.parse,
}))

const update = vi.mocked(metadataService.updateAssetMetadata)

const file = (id: string, name: string) => ({
  id,
  name,
  createdAt: new Date(2026, 0, 1),
  sizeByte: 10n,
  storageKey: { key: `k-${id}` },
})

describe('syncXmpSidecars', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.assetFindUnique.mockResolvedValue({
      name: 'DSCF1.RAF',
      type: 'file',
      parentId: 'folder',
      parent: { type: 'folder', parentId: null },
    })
    mocks.assetFindMany.mockResolvedValue([file('m', 'DSCF1.RAF'), file('s', 'DSCF1.RAF.xmp')])
    mocks.valueFindMany.mockResolvedValue([])
    mocks.valueDeleteMany.mockResolvedValue({ count: 0 })
  })

  it('takes no transaction client: it always runs on the shared client', () => {
    expect(syncXmpSidecars.length).toBe(1)
  })

  it('writes the values the sidecar has and deletes the rows for the ones it lacks', async () => {
    mocks.parse.mockResolvedValue({ rating: 3, rejected: false, keywords: [] })
    await syncXmpSidecars('m')
    expect(update).toHaveBeenCalledWith('m', [{ key: 'xmp_rating', value: 3 }], true)
    expect(mocks.valueDeleteMany).toHaveBeenCalledWith({
      where: { assetId: 'm', fieldKey: { in: ['xmp_rejected', 'xmp_label', 'xmp_keywords'] } },
    })
  })

  it('stores no all-null row when the sidecar holds nothing', async () => {
    mocks.parse.mockResolvedValue(null)
    await syncXmpSidecars('m')
    expect(update).not.toHaveBeenCalled()
    expect(mocks.valueDeleteMany).toHaveBeenCalledWith({
      where: {
        assetId: 'm',
        fieldKey: { in: ['xmp_rating', 'xmp_rejected', 'xmp_label', 'xmp_keywords'] },
      },
    })
  })

  it('deletes the values of a photo whose sidecar is gone', async () => {
    mocks.assetFindMany.mockResolvedValue([file('m', 'DSCF1.RAF')])
    mocks.valueFindMany.mockResolvedValue([{ assetId: 'm' }])
    await syncXmpSidecars('m')
    expect(update).not.toHaveBeenCalled()
    expect(mocks.valueDeleteMany).toHaveBeenCalledTimes(1)
  })
})
