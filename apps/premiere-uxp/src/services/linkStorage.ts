import type { Marker, Project, Sequence } from '@adobe/premierepro'
import { getPremiereModule } from './premiere'
import type { LinkedSequenceAsset } from '../types/link'
import { getStoredCredentials } from './storage'
import { fetchAssetComments, formatCommentBody } from './commentUtils'
import { isSameEndpoint } from '../utils/url'

export const LINK_STORAGE_PROP_KEY = 'shumai_linked_asset'
const STORAGE_PREFIX = '@shumai/premiere-uxp:project-links'

/**
 * Normalizes a GUID or string identifier by removing curly braces,
 * trimming whitespace, and converting to lower case for reliable comparison.
 */
export function normalizeGuid(guid: unknown): string {
  if (!guid) return ''
  const str =
    typeof guid === 'string'
      ? guid
      : typeof (guid as { toString?: () => string }).toString === 'function'
        ? (guid as { toString: () => string }).toString()
        : String(guid)
  return str.trim().toLowerCase().replace(/[{}]/g, '')
}

function getStorageKey(projectGuid?: string | null): string {
  return `${STORAGE_PREFIX}:${projectGuid ? normalizeGuid(projectGuid) : 'default'}`
}

/**
 * Reads all cached sequence links for a project from localStorage.
 * If projectGuid is omitted or null, aggregates across all project keys in localStorage.
 */
export function getAllSequenceLinksFromCache(projectGuid?: string | null): LinkedSequenceAsset[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const normProj = projectGuid ? normalizeGuid(projectGuid) : null
    if (normProj) {
      const raw = localStorage.getItem(getStorageKey(normProj))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
        if (typeof parsed === 'object' && parsed !== null) {
          return Object.values(parsed)
        }
      }
      return []
    }

    // When projectGuid is not provided, aggregate all cached sequence links
    const results: LinkedSequenceAsset[] = []
    const seenGuids = new Set<string>()

    // Check default key
    const defaultRaw = localStorage.getItem(getStorageKey(null))
    if (defaultRaw) {
      try {
        const parsed = JSON.parse(defaultRaw)
        const items: LinkedSequenceAsset[] = Array.isArray(parsed)
          ? parsed
          : typeof parsed === 'object' && parsed !== null
            ? Object.values(parsed)
            : []
        for (const item of items) {
          const normSeq = normalizeGuid(item.sequenceGuid)
          if (normSeq && !seenGuids.has(normSeq)) {
            seenGuids.add(normSeq)
            results.push(item)
          }
        }
      } catch {
        // Ignore JSON error
      }
    }

    // Scan all keys matching STORAGE_PREFIX in localStorage
    if (typeof localStorage.length === 'number') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = typeof localStorage.key === 'function' ? localStorage.key(i) : null
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key)
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              const items: LinkedSequenceAsset[] = Array.isArray(parsed)
                ? parsed
                : typeof parsed === 'object' && parsed !== null
                  ? Object.values(parsed)
                  : []
              for (const item of items) {
                const normSeq = normalizeGuid(item.sequenceGuid)
                if (normSeq && !seenGuids.has(normSeq)) {
                  seenGuids.add(normSeq)
                  results.push(item)
                }
              }
            } catch {
              // Ignore corrupted item
            }
          }
        }
      }
    }

    return results
  } catch (err) {
    console.warn('[linkStorage] Failed to read cached links from localStorage:', err)
    return []
  }
}

/**
 * Gets a cached sequence link by sequence GUID from localStorage.
 */
export function getSequenceLinkFromCache(
  sequenceGuid: string,
  projectGuid?: string | null,
): LinkedSequenceAsset | null {
  const normSeq = normalizeGuid(sequenceGuid)
  const all = getAllSequenceLinksFromCache(projectGuid)
  return all.find((item) => normalizeGuid(item.sequenceGuid) === normSeq) || null
}

/**
 * Saves a sequence link in the local cache.
 */
export function saveSequenceLinkToCache(
  linkData: LinkedSequenceAsset,
  projectGuid?: string | null,
): void {
  if (typeof localStorage === 'undefined') return
  try {
    const normSeq = normalizeGuid(linkData.sequenceGuid)
    const normalizedData: LinkedSequenceAsset = {
      ...linkData,
      sequenceGuid: normSeq,
      ...(linkData.syncedMarkerGuids != null
        ? { syncedMarkerGuids: linkData.syncedMarkerGuids.map(normalizeGuid).filter(Boolean) }
        : {}),
    }

    if (projectGuid) {
      const all = getAllSequenceLinksFromCache(projectGuid).filter(
        (item) => normalizeGuid(item.sequenceGuid) !== normSeq,
      )
      all.push(normalizedData)
      localStorage.setItem(getStorageKey(projectGuid), JSON.stringify(all))
    }

    // Always also update default key so it's accessible when projectGuid is unknown
    const defaultAll = getAllSequenceLinksFromCache(null).filter(
      (item) => normalizeGuid(item.sequenceGuid) !== normSeq,
    )
    defaultAll.push(normalizedData)
    localStorage.setItem(getStorageKey(null), JSON.stringify(defaultAll))
  } catch (err) {
    console.warn('[linkStorage] Failed to save link to localStorage:', err)
  }
}

/**
 * Removes a sequence link from the local cache.
 */
export function removeSequenceLinkFromCache(
  sequenceGuid: string,
  projectGuid?: string | null,
): void {
  if (typeof localStorage === 'undefined') return
  try {
    const normSeq = normalizeGuid(sequenceGuid)
    if (projectGuid) {
      const all = getAllSequenceLinksFromCache(projectGuid).filter(
        (item) => normalizeGuid(item.sequenceGuid) !== normSeq,
      )
      localStorage.setItem(getStorageKey(projectGuid), JSON.stringify(all))
    }

    const defaultAll = getAllSequenceLinksFromCache(null).filter(
      (item) => normalizeGuid(item.sequenceGuid) !== normSeq,
    )
    localStorage.setItem(getStorageKey(null), JSON.stringify(defaultAll))

    // Also remove from any other keys matching STORAGE_PREFIX
    if (typeof localStorage.length === 'number') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = typeof localStorage.key === 'function' ? localStorage.key(i) : null
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key)
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter(
                  (item) => normalizeGuid(item.sequenceGuid) !== normSeq,
                )
                localStorage.setItem(key, JSON.stringify(filtered))
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[linkStorage] Failed to remove link from localStorage:', err)
  }
}

/**
 * Retrieves the persistent link metadata from a sequence's properties.
 */
export async function getSequenceLink(
  sequence: Sequence,
  project?: Project | null,
): Promise<LinkedSequenceAsset | null> {
  const ppro = getPremiereModule()
  const seqGuidStr = normalizeGuid(sequence.guid)
  const prGuidStr = project?.guid ? normalizeGuid(project.guid) : null

  // Check persistent sequence properties in Premiere
  if (ppro?.Properties) {
    try {
      const properties = await ppro.Properties.getProperties(sequence)
      const raw = properties.getValue(LINK_STORAGE_PROP_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as LinkedSequenceAsset
        // Synchronize with cache
        saveSequenceLinkToCache(parsed, prGuidStr)
        return parsed
      }
    } catch (err) {
      // Property might not exist or failed to load
      console.debug('[linkStorage] No persistent property found or failed:', err)
    }
  }

  // Fallback to local cache if sequence property was not available
  return getSequenceLinkFromCache(seqGuidStr, prGuidStr)
}

/**
 * Retrieves all linked sequence assets across a project.
 */
export async function getAllLinkedSequences(
  project: Project,
  allSequences?: Sequence[],
): Promise<LinkedSequenceAsset[]> {
  const prGuidStr = project.guid ? normalizeGuid(project.guid) : null
  const seqs = allSequences || (await project.getSequences()) || []

  const results: LinkedSequenceAsset[] = []
  const checkedGuids = new Set<string>()

  for (const seq of seqs) {
    const seqGuid = normalizeGuid(seq.guid)
    if (seqGuid) checkedGuids.add(seqGuid)
    const link = await getSequenceLink(seq, project)
    if (link) {
      results.push(link)
    }
  }

  // Also check cache for any items matching known sequences
  const cached = getAllSequenceLinksFromCache(prGuidStr)
  for (const item of cached) {
    const normItemSeq = normalizeGuid(item.sequenceGuid)
    if (!results.some((r) => normalizeGuid(r.sequenceGuid) === normItemSeq)) {
      if (checkedGuids.has(normItemSeq)) {
        results.push(item)
      }
    }
  }

  return results
}

/**
 * Saves the link metadata persistently on the sequence and in the cache.
 */
export async function saveSequenceLink(
  project: Project,
  sequence: Sequence,
  linkData: LinkedSequenceAsset,
): Promise<boolean> {
  const ppro = getPremiereModule()
  const prGuidStr = project.guid ? normalizeGuid(project.guid) : null

  // Always update cache first
  saveSequenceLinkToCache(linkData, prGuidStr)

  if (!ppro?.Properties) {
    return true
  }

  try {
    const properties = await ppro.Properties.getProperties(sequence)
    const persistentType =
      ppro.Constants?.PropertyType?.PERSISTENT ?? ppro.Properties.PROPERTY_PERSISTENT ?? 0

    let success = false
    project.lockedAccess(() => {
      success = project.executeTransaction((compoundAction) => {
        const setValAction = properties.createSetValueAction(
          LINK_STORAGE_PROP_KEY,
          JSON.stringify(linkData),
          persistentType,
        )
        compoundAction.addAction(setValAction)
      }, 'Save Shumai Link')
    })
    return success
  } catch (err) {
    console.warn('[linkStorage] Failed to set sequence persistent property:', err)
    return true // Local cache succeeded
  }
}

/**
 * Removes the persistent link metadata from the sequence and cache,
 * and deletes any markers that were synced from Shumai (matching Frame.io behavior).
 */
export async function removeSequenceLink(project: Project, sequence: Sequence): Promise<boolean> {
  const ppro = getPremiereModule()
  const seqGuidStr = normalizeGuid(sequence.guid)
  const prGuidStr = project.guid ? normalizeGuid(project.guid) : null

  console.log('[linkStorage] removeSequenceLink called for sequence:', sequence.name || seqGuidStr)

  // Retrieve link metadata before clearing, to identify synced marker GUIDs
  let linkData = await getSequenceLink(sequence, project)
  if (!linkData) {
    const cached = getAllSequenceLinksFromCache(prGuidStr)
    linkData = cached.find((item) => normalizeGuid(item.sequenceGuid) === seqGuidStr) || null
  }
  console.log(
    '[linkStorage] Retrieved linkData:',
    linkData ? { assetId: linkData.assetId, guidsCount: linkData.syncedMarkerGuids?.length } : null,
  )

  // Remove from cache
  removeSequenceLinkFromCache(seqGuidStr, prGuidStr)

  // Remove synced markers from the sequence timeline
  if (ppro?.Markers) {
    try {
      const sequenceMarkers = await ppro.Markers.getMarkers(sequence)
      const allMarkers = sequenceMarkers.getMarkers() || []
      console.log('[linkStorage] Found', allMarkers.length, 'markers on sequence timeline')

      const targetGuids = new Set(
        (linkData?.syncedMarkerGuids || []).map(normalizeGuid).filter(Boolean),
      )
      console.log('[linkStorage] targetGuids count:', targetGuids.size)

      const markersToRemove: Marker[] = []

      // 1. Match markers by GUID
      if (targetGuids.size > 0) {
        for (const m of allMarkers) {
          const g = normalizeGuid(m.guid)
          if (g && targetGuids.has(g)) {
            markersToRemove.push(m)
          }
        }
      }

      // 2. Fallback: If targetGuids was empty/missing or didn't find markers, match by asset comments
      if (markersToRemove.length === 0 && linkData?.assetId) {
        console.log(
          '[linkStorage] Fallback: attempting comment-based marker identification for asset:',
          linkData.assetId,
        )
        try {
          const creds = getStoredCredentials()
          const canFetchComments =
            creds?.endpoint &&
            creds?.apiKey &&
            (!linkData.endpoint || isSameEndpoint(linkData.endpoint, creds.endpoint))
          if (canFetchComments) {
            const comments = await fetchAssetComments(
              creds.endpoint,
              creds.apiKey,
              linkData.assetId,
            )
            for (const comm of comments) {
              const commBody = formatCommentBody(comm)
              const commAuthor = comm.creator?.name || 'Comment'
              for (const m of allMarkers) {
                if (markersToRemove.includes(m)) continue
                try {
                  const mName = m.getName()
                  const mComments = m.getComments()
                  if (
                    (mName === commAuthor && mComments === commBody) ||
                    (mComments && comm.message && mComments.includes(comm.message))
                  ) {
                    markersToRemove.push(m)
                    break
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
        } catch (err) {
          console.warn('[linkStorage] Fallback comment fetch failed:', err)
        }
      }

      console.log('[linkStorage] Total markers to remove:', markersToRemove.length)

      if (markersToRemove.length > 0) {
        let removeSuccess = false
        try {
          project.lockedAccess(() => {
            removeSuccess = project.executeTransaction((compoundAction) => {
              for (const marker of markersToRemove) {
                const removeAction = sequenceMarkers.createRemoveMarkerAction(marker)
                compoundAction.addAction(removeAction)
              }
            }, 'Remove Shumai Synced Markers')
          })
        } catch (err) {
          console.error('[linkStorage] executeTransaction batch remove failed:', err)
        }

        console.log('[linkStorage] Batch remove result:', removeSuccess)

        // If batch compound action did not succeed, attempt individual removals
        if (!removeSuccess) {
          console.warn('[linkStorage] Batch remove returned false, attempting individual removals')
          for (const marker of markersToRemove) {
            try {
              project.lockedAccess(() => {
                project.executeTransaction((compoundAction) => {
                  const removeAction = sequenceMarkers.createRemoveMarkerAction(marker)
                  compoundAction.addAction(removeAction)
                }, 'Remove Shumai Synced Marker')
              })
            } catch (indErr) {
              console.warn('[linkStorage] Failed individual remove:', indErr)
            }
          }
        }
      }
    } catch (err) {
      console.warn('[linkStorage] Failed to remove synced markers from sequence:', err)
    }
  }

  if (!ppro?.Properties) {
    return true
  }

  try {
    const properties = await ppro.Properties.getProperties(sequence)
    let success = false
    project.lockedAccess(() => {
      success = project.executeTransaction((compoundAction) => {
        const clearAction = properties.createClearValueAction(LINK_STORAGE_PROP_KEY)
        compoundAction.addAction(clearAction)
      }, 'Unlink Shumai Asset')
    })
    console.log('[linkStorage] Clear property result:', success)
    return success
  } catch (err) {
    console.warn('[linkStorage] Failed to clear sequence persistent property:', err)
    return true // Cache was cleared
  }
}
