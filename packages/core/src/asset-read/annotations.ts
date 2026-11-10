import { degreeToSecond } from '@shumai/core/src/utils/model3d'
import { prisma } from '@shumai/db'
import { getShumaiMessage } from '@shumai/dtos'
import { HTTPException } from 'hono/http-exception'
import { agentSessionService } from '../agent/session-service'

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

  const reference = /^chat:([^:]+):(.+)$/.exec(annotationId)
  const entry = reference
    ? await agentSessionService.getEntryForRequest(reference[1], reference[2])
    : undefined
  if (entry) {
    const details = getShumaiMessage(entry)?.context
    const entryAssetId = details?.currentAsset?.id
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
