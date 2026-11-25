import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { assetService } from '@shumai/core/src/asset/asset'
import { shareActivityService } from './share-activity'
import { shareService } from './share'

describe('Share activity', () => {
  setupTestDbHooks()

  let shareId: string
  let projectId: string
  let assetId: string
  let userId: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Reviewer',
        email: 'reviewer@example.com',
        image: 'https://example.com/avatar',
      },
    })
    const team = await prisma.team.create({ data: { name: 'Team' } })
    const project = await prisma.project.create({ data: { name: 'Project', teamId: team.id } })
    const asset = await prisma.asset.create({
      data: { name: 'Review Cut', projectId: project.id, type: 'file', status: 'processed' },
    })
    const share = await shareService.createShareLink(project.id, { name: 'Review' }, user.id)
    shareId = share.id
    projectId = project.id
    assetId = asset.id
    userId = user.id
  })

  it('sets the last view and counts every visit, including a duplicate deep-link visit', async () => {
    expect(await shareService.getShareLink(shareId)).toMatchObject({ views: 0, lastViewedAt: null })
    await shareActivityService.recordView(shareId, { assetId, isShareEntry: true })
    const first = await prisma.shareLink.findUniqueOrThrow({ where: { id: shareId } })
    expect(first).toMatchObject({ views: 1, lastViewedAt: expect.any(Date) })

    const prior = new Date('2020-01-01T00:00:00Z')
    await prisma.shareLink.update({ where: { id: shareId }, data: { lastViewedAt: prior } })
    await shareActivityService.recordView(shareId, { assetId, isShareEntry: true })

    const share = await prisma.shareLink.findUniqueOrThrow({ where: { id: shareId } })
    expect(share.views).toBe(2)
    expect(share.lastViewedAt!.getTime()).toBeGreaterThan(prior.getTime())
    expect(await prisma.shareActivity.findMany({ where: { shareLinkId: shareId } })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'share_viewed', userId: null, assetId: null }),
        expect.objectContaining({ kind: 'asset_viewed', userId: null, assetId }),
      ]),
    )
    expect(await prisma.shareActivity.count({ where: { shareLinkId: shareId } })).toBe(2)
  })

  it('uses a rolling window from the last recorded event and permits a match after 30 minutes', async () => {
    const event = { kind: 'asset_downloaded', userId, assetId } as const
    const record = await prisma.shareActivity.create({
      data: {
        ...event,
        shareLinkId: shareId,
        createdAt: new Date(Date.now() - 29 * 60_000),
      },
    })
    await shareActivityService.recordEvent(shareId, event)
    expect(await prisma.shareActivity.count({ where: { shareLinkId: shareId } })).toBe(1)
    expect(await prisma.shareActivity.findUnique({ where: { id: record.id } })).toEqual(record)

    await prisma.shareActivity.update({
      where: { id: record.id },
      data: { createdAt: new Date(Date.now() - 30 * 60_000) },
    })
    await shareActivityService.recordEvent(shareId, event)
    expect(await prisma.shareActivity.count({ where: { shareLinkId: shareId } })).toBe(2)
  })

  it('scopes the deduplication identity to the share, event kind, user and asset', async () => {
    const otherShare = await shareService.createShareLink(projectId, { name: 'Other' })
    const otherAsset = await prisma.asset.create({
      data: { name: 'Other Cut', projectId, type: 'file', status: 'processed' },
    })
    await shareActivityService.recordView(shareId, { assetId })
    await shareActivityService.recordView(shareId, { assetId, userId })
    await shareActivityService.recordView(shareId, { assetId: otherAsset.id, userId })
    await shareActivityService.recordView(otherShare.id, { assetId, userId })
    await shareActivityService.recordEvent(shareId, { kind: 'asset_downloaded', assetId, userId })

    expect(await prisma.shareActivity.count({ where: { shareLinkId: shareId } })).toBe(4)
    expect(await prisma.shareActivity.count({ where: { shareLinkId: otherShare.id } })).toBe(1)
    expect(await shareService.getShareLink(shareId)).toMatchObject({ views: 3 })
  })

  it('records a share comment in its transaction while preserving every comment', async () => {
    const comment = { assetId, userId, message: 'Looks good', attachmentIds: [] }
    await assetService.createComment(comment, { shareLinkId: shareId })
    await assetService.createComment({ ...comment, message: 'Ready' }, { shareLinkId: shareId })
    await assetService.createComment({ ...comment, message: 'Workspace comment' })
    expect(await prisma.assetComment.count({ where: { assetId } })).toBe(3)
    const events = await prisma.shareActivity.findMany({ where: { shareLinkId: shareId } })
    expect(events).toMatchObject([{ kind: 'comment_created', assetId, userId }])

    await expect(assetService.createComment(comment, { shareLinkId: 'missing' })).rejects.toThrow(
      'Share link not found',
    )
    expect(await prisma.assetComment.count({ where: { assetId } })).toBe(3)
  })

  it('paginates the feed and resolves current names and missing assets', async () => {
    await shareActivityService.recordView(shareId, { assetId, userId, isShareEntry: true })
    await prisma.asset.update({ where: { id: assetId }, data: { name: 'Renamed Cut' } })
    const first = await shareActivityService.list(shareId, { first: 1 })
    expect(first.pageInfo).toMatchObject({ total: 2, cursor: expect.any(String) })
    const second = await shareActivityService.list(shareId, {
      first: 1,
      after: first.pageInfo.cursor,
    })
    expect(first.data).toHaveLength(1)
    expect(second.data).toHaveLength(1)
    expect(first.data[0].id > second.data[0].id).toBe(true)
    expect([...first.data, ...second.data]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'asset_viewed',
          user: { name: 'Reviewer', image: 'https://example.com/avatar' },
          asset: { id: assetId, name: 'Renamed Cut' },
        }),
        expect.objectContaining({ kind: 'share_viewed', asset: null }),
      ]),
    )

    await prisma.asset.update({ where: { id: assetId }, data: { isDeleted: true } })
    const getAssetEvent = async () =>
      (await shareActivityService.list(shareId, {})).data.find(
        (event) => event.kind === 'asset_viewed',
      )
    expect((await getAssetEvent())?.asset).toEqual({ id: assetId, name: null })
    await prisma.asset.delete({ where: { id: assetId } })
    expect((await getAssetEvent())?.asset).toEqual({ id: assetId, name: null })
    await shareService.deleteShareLink(shareId)
    expect(await prisma.shareActivity.count({ where: { shareLinkId: shareId } })).toBe(0)
  })

  it('checks that a share root is accessible before accepting a root view', async () => {
    const share = await shareService.getShareLink(shareId)
    await expect(shareService.verifyPublicAccess(shareId, undefined)).resolves.toMatchObject({
      id: shareId,
    })
    await prisma.asset.update({
      where: { id: share.rootFolderId },
      data: { isDeleted: true },
    })
    await expect(shareService.verifyPublicAccess(shareId, undefined)).rejects.toThrow(
      'Asset is not shared',
    )
  })
})
