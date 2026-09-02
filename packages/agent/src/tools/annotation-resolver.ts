import { prisma } from '@shumai/db'
import type { ShumaiMessageContext } from '@shumai/dtos'

export async function resolveAnnotationsById(
  annotationId?: string,
): Promise<{ annotations: PrismaJson.AnnotationList | null; timestamp: number | null }> {
  if (!annotationId) {
    return { annotations: null, timestamp: null }
  }

  // 1. Check AssetComment table (Comments Mode)
  const comment = await prisma.assetComment.findUnique({
    where: { id: annotationId },
    select: { annotation: true, second: true },
  })
  if (comment) {
    const list = comment.annotation
    const annotations =
      Array.isArray(list) && list.length > 0 ? (list as PrismaJson.AnnotationList) : null
    return { annotations, timestamp: comment.second }
  }

  // 2. Check AgentSessionEntry table (1-on-1 Chat Mode)
  const entry = await prisma.agentSessionEntry.findUnique({
    where: { id: annotationId },
    select: { data: true },
  })
  if (entry?.data) {
    const details = (entry.data as Record<string, unknown>).details as
      | ShumaiMessageContext
      | undefined
    const list = details?.annotations
    const annotations =
      Array.isArray(list) && list.length > 0 ? (list as unknown as PrismaJson.AnnotationList) : null
    const timestamp = details?.position?.type === 'time' ? details.position.seconds : null
    return { annotations, timestamp }
  }

  return { annotations: null, timestamp: null }
}
