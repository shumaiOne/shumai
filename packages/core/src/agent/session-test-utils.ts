import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import { createModels } from '@earendil-works/pi-ai'
import { Harness, createRegistry, type EntryDraft } from '@earendil-works/pi-durable'
import { agentSessionService } from './session-service'

/** Seed real native records through the same writer used by the application. */
export async function appendSessionEntries(sessionId: string, drafts: EntryDraft[]) {
  return agentSessionService.withWriter(sessionId, async (storage) => {
    const harness = await Harness.open(
      storage,
      { models: createModels(), registry: createRegistry() },
      BACKGROUND_CONTEXT,
    )
    try {
      const root = await harness.root(BACKGROUND_CONTEXT)
      return await root.commit(async (tx) => {
        const entries = []
        for (const draft of drafts) entries.push(await tx.appendEntry(root.id, draft))
        return entries
      }, BACKGROUND_CONTEXT)
    } finally {
      await harness.close(BACKGROUND_CONTEXT)
    }
  })
}
