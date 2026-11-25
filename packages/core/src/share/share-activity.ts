import { prisma, type Prisma } from '@shumai/db'
import type { ShareActivityInfo, ShareActivityKind } from '@shumai/dtos'
import { paginateQuery, type PaginationParams } from '@shumai/core/src/pagination'
import { getAvatarUrl } from '@shumai/core/src/user/avatar'
import { ShareLinkNotFoundError } from './errors'

const deduplicationWindowMs = 30 * 60 * 1000

type Activity = {
  kind: ShareActivityKind
  userId?: string
  assetId?: string
}

class ShareActivityService {
  async recordView(
    shareLinkId: string,
    view: { userId?: string; assetId?: string; isShareEntry?: boolean },
  ): Promise<void> {
    const events: Activity[] = []
    if (!view.assetId || view.isShareEntry) {
      events.push({ kind: 'share_viewed', userId: view.userId })
    }
    if (view.assetId) {
      events.push({ kind: 'asset_viewed', userId: view.userId, assetId: view.assetId })
    }

    await prisma.$transaction(async (tx) => {
      const now = await this.lockShare(tx, shareLinkId)
      // A visit updates the counters independently of whether its events are duplicates.
      await tx.$executeRaw`
        UPDATE share_links
        SET views = views + 1,
            last_viewed_at = GREATEST(last_viewed_at, ${now.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        WHERE id = ${shareLinkId}
      `
      for (const event of events) {
        await this.insertIfNew(tx, shareLinkId, event, now)
      }
    })
  }

  async recordEvent(
    shareLinkId: string,
    event: Activity,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (!tx) {
      await prisma.$transaction((client) => this.recordEvent(shareLinkId, event, client))
      return
    }

    const now = await this.lockShare(tx, shareLinkId)
    await this.insertIfNew(tx, shareLinkId, event, now)
  }

  async list(shareLinkId: string, params: PaginationParams) {
    const where = { shareLinkId }
    const page = await paginateQuery(
      (skip, take) => prisma.shareActivity.findMany({ where, orderBy: { id: 'desc' }, skip, take }),
      () => prisma.shareActivity.count({ where }),
      params,
    )
    const userIds = page.data.flatMap(({ userId }) => (userId ? [userId] : []))
    const assetIds = page.data.flatMap(({ assetId }) => (assetId ? [assetId] : []))
    const [users, assets] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, image: true },
      }),
      prisma.asset.findMany({
        where: { id: { in: assetIds }, isDeleted: false },
        select: { id: true, name: true },
      }),
    ])
    const usersById = new Map(
      await Promise.all(
        users.map(
          async ({ id, name, image }) => [id, { name, image: await getAvatarUrl(image) }] as const,
        ),
      ),
    )
    const namesById = new Map(assets.map(({ id, name }) => [id, name]))
    const data: ShareActivityInfo[] = page.data.map((event) => ({
      id: event.id,
      kind: event.kind,
      createdAt: event.createdAt.toISOString(),
      user: event.userId ? (usersById.get(event.userId) ?? null) : null,
      asset: event.assetId
        ? { id: event.assetId, name: namesById.get(event.assetId) ?? null }
        : null,
    }))
    return { data, pageInfo: page.pageInfo }
  }

  private async lockShare(tx: Prisma.TransactionClient, shareLinkId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM share_links WHERE id = ${shareLinkId} FOR UPDATE
    `
    if (rows.length === 0) throw new ShareLinkNotFoundError('Share link not found')
    // Read time after acquiring the lock so a queued request uses its actual write time.
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
    return clock.now
  }

  private async insertIfNew(
    tx: Prisma.TransactionClient,
    shareLinkId: string,
    event: Activity,
    now: Date,
  ) {
    const identity = {
      shareLinkId,
      kind: event.kind,
      userId: event.userId ?? null,
      assetId: event.assetId ?? null,
    }
    const recent = await tx.shareActivity.findFirst({
      where: {
        ...identity,
        createdAt: { gt: new Date(now.getTime() - deduplicationWindowMs) },
      },
      select: { id: true },
    })
    if (!recent) await tx.shareActivity.create({ data: { ...identity, createdAt: now } })
  }
}

export const shareActivityService = new ShareActivityService()
