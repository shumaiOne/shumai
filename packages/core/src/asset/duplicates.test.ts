import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import type { prisma } from '@shumai/db'
import { assetService } from './asset'
import { DuplicateService } from './duplicates'

vi.mock('./asset', () => ({
  assetService: { deleteAssets: vi.fn().mockResolvedValue(undefined) },
}))

const HASH = 'a'.repeat(64)

describe('DuplicateService.resolveGroup', () => {
  const findMany = vi.fn()
  const service = new DuplicateService({ asset: { findMany } } as unknown as typeof prisma)

  beforeEach(() => {
    findMany.mockReset()
    vi.mocked(assetService.deleteAssets).mockClear()
  })

  it('looks only at live, non-symlink files of the project and deletes through the asset service', async () => {
    findMany.mockResolvedValue([
      { id: 'k', contentHash: HASH, sizeByte: 10n },
      { id: 'b', contentHash: HASH, sizeByte: 10n },
    ])

    const result = await service.resolveGroup('p1', 'k', ['b'])

    expect(result).toEqual({ deletedIds: ['b'] })
    expect(assetService.deleteAssets).toHaveBeenCalledWith(['b'])
    const where = findMany.mock.calls[0][0].where
    expect(where).toMatchObject({
      projectId: 'p1',
      type: 'file',
      isDeleted: false,
      targetId: null,
      id: { in: ['k', 'b'] },
    })
  })

  it('deletes nothing and answers 409 when a copy has a different hash', async () => {
    findMany.mockResolvedValue([
      { id: 'k', contentHash: HASH, sizeByte: 10n },
      { id: 'b', contentHash: HASH, sizeByte: 10n },
      { id: 'c', contentHash: 'f'.repeat(64), sizeByte: 10n },
    ])

    const err = await service.resolveGroup('p1', 'k', ['b', 'c']).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(HTTPException)
    expect((err as HTTPException).status).toBe(409)
    expect(assetService.deleteAssets).not.toHaveBeenCalled()
  })

  it('deletes nothing when an id is outside the project or already deleted', async () => {
    // The query is scoped to the project and live files, so such ids simply do not come back.
    findMany.mockResolvedValue([{ id: 'k', contentHash: HASH, sizeByte: 10n }])

    await expect(service.resolveGroup('p1', 'k', ['elsewhere'])).rejects.toBeInstanceOf(
      HTTPException,
    )
    expect(assetService.deleteAssets).not.toHaveBeenCalled()
  })

  it('refuses to use an unhashed file as the keeper', async () => {
    findMany.mockResolvedValue([
      { id: 'k', contentHash: null, sizeByte: 10n },
      { id: 'b', contentHash: null, sizeByte: 10n },
    ])

    await expect(service.resolveGroup('p1', 'k', ['b'])).rejects.toBeInstanceOf(HTTPException)
    expect(assetService.deleteAssets).not.toHaveBeenCalled()
  })
})
