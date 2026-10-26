import { prisma } from '@shumai/db'
import type { ShumaiMessageContext } from '@shumai/dtos'
import { HTTPException } from 'hono/http-exception'
import { degreeToSecond } from '@shumai/core/src/utils/model3d'

/**
 * Resolve the visual markup referenced by an annotation ID: a comment (comments mode) or an
 * agent session entry (1-on-1 chat mode). The annotation must belong to `assetId`.
 */
export async function resolveAnnotationsById(
  assetId: string,
  annotationId?: string | null,
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
      throw new HTTPException(400, {
        message: `Annotation "${annotationId}" belongs to asset "${comment.assetId}", not target asset "${assetId}".`,
      })
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
      ShumaiMessageContext | undefined
    const entryAssetId = entry.assetId || details?.currentAsset?.id
    if (entryAssetId && entryAssetId !== assetId) {
      throw new HTTPException(400, {
        message: `Annotation "${annotationId}" belongs to asset "${entryAssetId}", not target asset "${assetId}".`,
      })
    }
    const list = details?.annotations
    const annotations =
      Array.isArray(list) && list.length > 0 ? (list as unknown as PrismaJson.AnnotationList) : null
    let timestamp: number | null = null
    if (details?.position?.type === 'time') {
      timestamp = details.position.seconds
    } else if (details?.position?.type === 'degree') {
      timestamp = degreeToSecond(details.position.degree)
    } else if (details?.position?.type === 'page') {
      timestamp = details.position.page
    }
    return { annotations, timestamp }
  }

  throw new HTTPException(404, { message: `Annotation with ID "${annotationId}" not found.` })
}
