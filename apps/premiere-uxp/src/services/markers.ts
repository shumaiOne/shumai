import type { Project, Sequence } from '@adobe/premierepro'
import { getPremiereModule } from './premiere'
import type { LinkedSequenceAsset } from '../types/link'
import { saveSequenceLink } from './linkStorage'
import type { CommentInfo } from '@shumai/dtos'
import { getShumaiClient } from '../api/client'

/**
 * Fetches timecoded comments for an asset from Shumai.
 */
export async function fetchAssetComments(
  endpoint: string,
  apiKey: string,
  assetId: string,
): Promise<CommentInfo[]> {
  try {
    const client = getShumaiClient(endpoint, apiKey)
    const res = await client.api.files[':fileId'].comments.$get({
      param: { fileId: assetId },
      query: { first: '100' },
    })
    if (!res.ok) {
      console.warn('[markers] Failed to fetch comments for asset:', res.status)
      return []
    }
    const data = await res.json()
    return (data?.data as CommentInfo[]) || []
  } catch (err) {
    console.error('[markers] Error fetching asset comments:', err)
    return []
  }
}

/**
 * Formats a Shumai comment into marker text including any threaded replies.
 */
export function formatCommentBody(comment: CommentInfo): string {
  let body = comment.message || ''

  if (comment.replies && comment.replies.length > 0) {
    body += '\n\n--- Replies ---'
    for (const reply of comment.replies) {
      const author = reply.creator?.name || 'User'
      const replyMsg = reply.message || ''
      body += `\n${author}: ${replyMsg}`
    }
  }

  return body
}

export interface SyncCommentsResult {
  updatedLink: LinkedSequenceAsset
  addedCount: number
}

/**
 * Synchronizes new Shumai comments to a Premiere Pro sequence as markers.
 * Comments without timestamps (`second == null`) default to time 0 (sequence start),
 * matching Frame.io convention. Deleted markers in Premiere are not re-created.
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

  if (newComments.length === 0) {
    const updatedLink: LinkedSequenceAsset = {
      ...existingLink,
      lastSyncAt: now,
    }
    await saveSequenceLink(project, sequence, updatedLink)
    return { updatedLink, addedCount: 0 }
  }

  if (!ppro?.Markers || !ppro?.TickTime) {
    console.warn('[markers] premierepro Markers or TickTime module not available')
    const updatedLink: LinkedSequenceAsset = {
      ...existingLink,
      syncedCommentIds: [...existingLink.syncedCommentIds, ...newComments.map((c) => c.id)],
      totalCommentsSynced: existingLink.totalCommentsSynced + newComments.length,
      lastSyncAt: now,
    }
    await saveSequenceLink(project, sequence, updatedLink)
    return { updatedLink, addedCount: newComments.length }
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
      beforeGuids = new Set(
        beforeMarkers.map((m) => (m.guid ? m.guid.toString() : '')).filter(Boolean),
      )
    } catch (err) {
      console.warn('[markers] Could not get existing markers before sync:', err)
    }

    project.lockedAccess(() => {
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
      }, 'Sync Shumai Comments')
    })

    // Identify newly added markers by GUID
    try {
      const afterMarkers = sequenceMarkers.getMarkers() || []
      for (const m of afterMarkers) {
        const guidStr = m.guid ? m.guid.toString() : ''
        if (guidStr && !beforeGuids.has(guidStr)) {
          newMarkerGuids.push(guidStr)
        }
      }
    } catch (err) {
      console.warn('[markers] Could not retrieve newly created marker GUIDs:', err)
    }
  } catch (err) {
    console.error('[markers] Failed to execute add markers transaction:', err)
  }

  const updatedLink: LinkedSequenceAsset = {
    ...existingLink,
    syncedCommentIds: [...existingLink.syncedCommentIds, ...newComments.map((c) => c.id)],
    syncedMarkerGuids: [...(existingLink.syncedMarkerGuids || []), ...newMarkerGuids],
    totalCommentsSynced: existingLink.totalCommentsSynced + newComments.length,
    lastSyncAt: now,
  }

  await saveSequenceLink(project, sequence, updatedLink)
  return { updatedLink, addedCount: newComments.length }
}
