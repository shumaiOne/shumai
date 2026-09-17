import type { Project, Sequence } from '@adobe/premierepro'
import { getPremiereModule } from './premiere'
import type { LinkedSequenceAsset } from '../types/link'
import { normalizeGuid, saveSequenceLink } from './linkStorage'
import type { CommentInfo } from '@shumai/dtos'
import { fetchAssetComments, formatCommentBody } from './commentUtils'

export { fetchAssetComments, formatCommentBody }

export interface SyncCommentsResult {
  updatedLink: LinkedSequenceAsset
  addedCount: number
}

/**
 * Synchronizes new Shumai comments to a Premiere Pro sequence as markers.
 * Comments without timestamps (`second == null`) default to time 0 (sequence start),
 * matching Frame.io convention. Newly created marker GUIDs are captured and stored
 * so they can be accurately removed when the sequence is unlinked.
 */
export async function syncCommentsToSequence(
  project: Project,
  sequence: Sequence,
  comments: CommentInfo[],
  existingLink: LinkedSequenceAsset,
): Promise<SyncCommentsResult> {
  const ppro = getPremiereModule()
  const now = Date.now()

  // Filter comments that have not been synced yet; non-timestamped comments default to time 0
  const alreadySyncedSet = new Set(existingLink.syncedCommentIds)
  const newComments = comments.filter((c) => !alreadySyncedSet.has(c.id))

  const currentMarkerGuids = (existingLink.syncedMarkerGuids || [])
    .map(normalizeGuid)
    .filter(Boolean)
  const needsGuidBackfill =
    currentMarkerGuids.length < (existingLink.syncedCommentIds?.length || 0) &&
    ppro?.Markers != null

  if (newComments.length === 0 && !needsGuidBackfill) {
    const updatedLink: LinkedSequenceAsset = {
      ...existingLink,
      lastSyncAt: now,
    }
    await saveSequenceLink(project, sequence, updatedLink)
    return { updatedLink, addedCount: 0 }
  }

  if (!ppro?.Markers || !ppro?.TickTime) {
    console.warn('[markers] premierepro Markers or TickTime module not available')
    return { updatedLink: existingLink, addedCount: 0 }
  }

  const newMarkerGuids: string[] = []

  try {
    const sequenceMarkers = await ppro.Markers.getMarkers(sequence)
    let zeroPointSeconds = 0

    try {
      const zeroPoint = await sequence.getZeroPoint()
      if (zeroPoint && typeof zeroPoint.seconds === 'number') {
        zeroPointSeconds = zeroPoint.seconds
      }
    } catch {
      // zeroPoint defaults to 0
    }

    // Capture existing marker GUIDs before adding new markers
    let beforeGuids = new Set<string>()
    try {
      const beforeMarkers = sequenceMarkers.getMarkers() || []
      beforeGuids = new Set(beforeMarkers.map((m) => normalizeGuid(m.guid)).filter(Boolean))
      console.log('[markers] Existing markers before sync:', beforeMarkers.length)
    } catch (err) {
      console.warn('[markers] Could not get existing markers before sync:', err)
    }

    if (newComments.length > 0) {
      let txSuccess = false
      project.lockedAccess(() => {
        txSuccess =
          project.executeTransaction((compoundAction) => {
            for (const comment of newComments) {
              const markerSeconds = zeroPointSeconds + (comment.second ?? 0)
              const startTime = ppro.TickTime.createWithSeconds(markerSeconds)
              const duration = ppro.TickTime.TIME_ZERO
              const markerName = comment.creator?.name || 'Comment'
              const markerText = formatCommentBody(comment)

              const addMarkerAction = sequenceMarkers.createAddMarkerAction(
                markerName,
                ppro.Marker.MARKER_TYPE_COMMENT,
                startTime,
                duration,
                markerText,
              )
              compoundAction.addAction(addMarkerAction)
            }
          }, 'Sync Shumai Comments') === true
      })
      console.log('[markers] executeTransaction result:', txSuccess)

      if (!txSuccess) {
        console.warn('[markers] Failed to execute add markers transaction (returned false)')
        return { updatedLink: existingLink, addedCount: 0 }
      }
    }

    // Re-fetch fresh Markers object after transaction to ensure newly committed markers are seen
    const freshSequenceMarkers = await ppro.Markers.getMarkers(sequence)
    const afterMarkers = freshSequenceMarkers.getMarkers() || []
    console.log('[markers] Markers after sync transaction:', afterMarkers.length)

    // 1. Identify newly added markers by GUID difference
    for (const m of afterMarkers) {
      const guidStr = normalizeGuid(m.guid)
      if (guidStr && !beforeGuids.has(guidStr) && !newMarkerGuids.includes(guidStr)) {
        newMarkerGuids.push(guidStr)
      }
    }

    // 2. Fallback / Backfill: Match any comment markers by content/author
    const allExpectedComments = [...newComments]
    if (needsGuidBackfill) {
      const alreadySyncedComments = comments.filter((c) => alreadySyncedSet.has(c.id))
      allExpectedComments.push(...alreadySyncedComments)
    }

    const currentKnownGuids = new Set([...currentMarkerGuids, ...newMarkerGuids])
    for (const comment of allExpectedComments) {
      const commentBody = formatCommentBody(comment)
      const commentAuthor = comment.creator?.name || 'Comment'
      for (const m of afterMarkers) {
        const g = normalizeGuid(m.guid)
        if (!g || currentKnownGuids.has(g)) continue
        try {
          const mName = m.getName()
          const mComments = m.getComments()
          if (
            (mName === commentAuthor && mComments === commentBody) ||
            (mComments && comment.message && mComments.includes(comment.message))
          ) {
            newMarkerGuids.push(g)
            currentKnownGuids.add(g)
            break
          }
        } catch {
          // ignore
        }
      }
    }

    console.log(
      '[markers] Total newly captured/backfilled marker GUIDs:',
      newMarkerGuids.length,
      newMarkerGuids,
    )

    const updatedMarkerGuids = Array.from(
      new Set([...currentMarkerGuids, ...newMarkerGuids.map(normalizeGuid)]),
    )

    const updatedLink: LinkedSequenceAsset = {
      ...existingLink,
      syncedCommentIds: [...existingLink.syncedCommentIds, ...newComments.map((c) => c.id)],
      syncedMarkerGuids: updatedMarkerGuids,
      totalCommentsSynced: existingLink.totalCommentsSynced + newComments.length,
      lastSyncAt: now,
    }

    await saveSequenceLink(project, sequence, updatedLink)
    return { updatedLink, addedCount: newComments.length }
  } catch (err) {
    console.error('[markers] Failed to execute add markers transaction:', err)
    return { updatedLink: existingLink, addedCount: 0 }
  }
}
