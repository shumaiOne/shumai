import { prisma } from '@shumai/db'
import type { ShumaiMessageContext } from '@shumai/dtos'

export async function resolveAnnotationsById(
  assetId: string,
  annotationId?: string,
): Promise<{ annotations: PrismaJson.AnnotationList | null; timestamp: number | null }> {
  if (!annotationId) {
    return { annotations: null, timestamp: null }
  }

  // 1. Check AssetComment table (Comments Mode)
  const comment = await prisma.assetComment.findUnique({
    where: { id: annotationId },
    select: { assetId: true, annotation: true, second: true },
  })
  if (comment) {
    if (comment.assetId !== assetId) {
      throw new Error(
        `Annotation "${annotationId}" belongs to asset "${comment.assetId}", not target asset "${assetId}".`,
      )
    }
    const list = comment.annotation
    const annotations =
      Array.isArray(list) && list.length > 0 ? (list as PrismaJson.AnnotationList) : null
    return { annotations, timestamp: comment.second }
  }

  // 2. Check AgentSessionEntry table (1-on-1 Chat Mode)
  const entry = await prisma.agentSessionEntry.findUnique({
    where: { id: annotationId },
    select: { assetId: true, data: true },
  })
  if (entry) {
    const details = (entry.data as Record<string, unknown> | null)?.details as
      | ShumaiMessageContext
      | undefined
    const entryAssetId = entry.assetId || details?.currentAsset?.id
    if (entryAssetId && entryAssetId !== assetId) {
      throw new Error(
        `Annotation "${annotationId}" belongs to asset "${entryAssetId}", not target asset "${assetId}".`,
      )
    }
    const list = details?.annotations
    const annotations =
      Array.isArray(list) && list.length > 0 ? (list as unknown as PrismaJson.AnnotationList) : null
    const timestamp = details?.position?.type === 'time' ? details.position.seconds : null
    return { annotations, timestamp }
  }

  throw new Error(`Annotation with ID "${annotationId}" not found.`)
}
