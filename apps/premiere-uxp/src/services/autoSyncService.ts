import type { Sequence } from '@adobe/premierepro'
import { getActiveProject, getAllSequences, getPremiereModule } from './premiere'
import { getAllLinkedSequences } from './linkStorage'
import { fetchAssetComments, syncCommentsToSequence } from './markers'

const SYNC_INTERVAL_MS = 12000 // 12 seconds

class AutoSyncService {
  private timer: ReturnType<typeof setInterval> | null = null
  private isSyncing = false
  private endpoint = ''
  private apiKey = ''
  private cleanupListeners: (() => void) | null = null
  private syncPromise: Promise<void> | null = null

  /**
   * Starts the background auto-sync loop.
   */
  start(endpoint: string, apiKey: string): void {
    this.stop()
    this.endpoint = endpoint
    this.apiKey = apiKey

    if (!endpoint || !apiKey) return

    // Setup background interval
    this.timer = setInterval(() => {
      void this.syncAllLinkedSequences()
    }, SYNC_INTERVAL_MS)

    // Setup host and window event listeners
    this.setupListeners()
  }

  /**
   * Stops the background auto-sync loop and tears down listeners.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.cleanupListeners) {
      this.cleanupListeners()
      this.cleanupListeners = null
    }
    this.endpoint = ''
    this.apiKey = ''
    this.syncPromise = null
  }

  /**
   * Forces an immediate synchronization cycle.
   */
  async triggerImmediateSync(): Promise<void> {
    if (this.syncPromise) {
      await this.syncPromise
    }
    await this.syncAllLinkedSequences()
  }

  private setupListeners(): void {
    const onFocus = () => {
      void this.syncAllLinkedSequences()
    }
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void this.syncAllLinkedSequences()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    // Premiere Pro Sequence Activated listener
    const ppro = getPremiereModule()
    let hasSeqListener = false
    const onSequenceActivated = () => {
      void this.syncAllLinkedSequences()
    }

    if (ppro?.EventManager && ppro.Constants?.SequenceEvent?.ACTIVATED) {
      try {
        ppro.EventManager.addGlobalEventListener(
          ppro.Constants.SequenceEvent.ACTIVATED,
          onSequenceActivated,
          true,
        )
        hasSeqListener = true
      } catch (err) {
        console.warn('[autoSyncService] Could not add SequenceEvent.ACTIVATED listener:', err)
      }
    }

    this.cleanupListeners = () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
      if (hasSeqListener && ppro?.EventManager && ppro.Constants?.SequenceEvent?.ACTIVATED) {
        try {
          ppro.EventManager.removeGlobalEventListener(
            ppro.Constants.SequenceEvent.ACTIVATED,
            onSequenceActivated,
          )
        } catch {
          // Ignore error during cleanup
        }
      }
    }
  }

  private async syncAllLinkedSequences(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise
    }
    if (!this.endpoint || !this.apiKey) return

    this.syncPromise = (async () => {
      try {
        const project = await getActiveProject()
        if (!project) return

        const allSeqs = await getAllSequences(project)
        if (!allSeqs || allSeqs.length === 0) return

        const linkedItems = await getAllLinkedSequences(project, allSeqs)
        if (!linkedItems || linkedItems.length === 0) return

        const seqsMap = new Map<string, Sequence>()
        for (const s of allSeqs) {
          if (s.guid) {
            seqsMap.set(s.guid.toString(), s)
          }
        }

        for (const link of linkedItems) {
          const targetSeq = seqsMap.get(link.sequenceGuid)
          if (!targetSeq) continue

          try {
            const comments = await fetchAssetComments(this.endpoint, this.apiKey, link.assetId)
            await syncCommentsToSequence(project, targetSeq, comments, link)
          } catch (itemErr) {
            console.error(`[autoSyncService] Error syncing sequence ${link.sequenceName}:`, itemErr)
          }
        }
      } catch (err) {
        console.error('[autoSyncService] Sync cycle failed:', err)
      } finally {
        this.syncPromise = null
      }
    })()

    return this.syncPromise
  }
}

export const autoSyncService = new AutoSyncService()
