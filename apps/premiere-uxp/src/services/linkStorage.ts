import type { Project, Sequence } from '@adobe/premierepro'
import { getPremiereModule } from './premiere'
import type { LinkedSequenceAsset } from '../types/link'

export const LINK_STORAGE_PROP_KEY = 'shumai_linked_asset'
const STORAGE_PREFIX = '@shumai/premiere-uxp:project-links'

function getStorageKey(projectGuid?: string | null): string {
  return `${STORAGE_PREFIX}:${projectGuid || 'default'}`
}

/**
 * Reads all cached sequence links for a project from localStorage.
 */
export function getAllSequenceLinksFromCache(projectGuid?: string | null): LinkedSequenceAsset[] {
  if (typeof localStorage === 'undefined') return []
  try {
    let raw = localStorage.getItem(getStorageKey(projectGuid))
    if (!raw && projectGuid) {
      raw = localStorage.getItem(getStorageKey(null))
    }
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.values(parsed)
    }
    return []
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
  const all = getAllSequenceLinksFromCache(projectGuid)
  return all.find((item) => item.sequenceGuid === sequenceGuid) || null
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
    const all = getAllSequenceLinksFromCache(projectGuid).filter(
      (item) => item.sequenceGuid !== linkData.sequenceGuid,
    )
    all.push(linkData)
    localStorage.setItem(getStorageKey(projectGuid), JSON.stringify(all))
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
    const all = getAllSequenceLinksFromCache(projectGuid).filter(
      (item) => item.sequenceGuid !== sequenceGuid,
    )
    localStorage.setItem(getStorageKey(projectGuid), JSON.stringify(all))
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
  const seqGuidStr = sequence.guid ? sequence.guid.toString() : ''
  const prGuidStr = project?.guid ? project.guid.toString() : null

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
  const prGuidStr = project.guid ? project.guid.toString() : null
  const seqs = allSequences || (await project.getSequences()) || []

  const results: LinkedSequenceAsset[] = []
  const checkedGuids = new Set<string>()

  for (const seq of seqs) {
    const seqGuid = seq.guid ? seq.guid.toString() : ''
    if (seqGuid) checkedGuids.add(seqGuid)
    const link = await getSequenceLink(seq, project)
    if (link) {
      results.push(link)
    }
  }

  // Also check cache for any items matching project or known sequences
  const cached = getAllSequenceLinksFromCache(prGuidStr)
  for (const item of cached) {
    if (!results.some((r) => r.sequenceGuid === item.sequenceGuid)) {
      if (checkedGuids.size === 0 || checkedGuids.has(item.sequenceGuid)) {
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
  const prGuidStr = project.guid ? project.guid.toString() : null

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
 * Removes the persistent link metadata from the sequence and cache.
 */
export async function removeSequenceLink(project: Project, sequence: Sequence): Promise<boolean> {
  const ppro = getPremiereModule()
  const seqGuidStr = sequence.guid ? sequence.guid.toString() : ''
  const prGuidStr = project.guid ? project.guid.toString() : null

  // Remove from cache
  removeSequenceLinkFromCache(seqGuidStr, prGuidStr)

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
    return success
  } catch (err) {
    console.warn('[linkStorage] Failed to clear sequence persistent property:', err)
    return true // Cache was cleared
  }
}
