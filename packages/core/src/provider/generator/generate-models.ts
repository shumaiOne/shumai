import type { Api, Model } from '@earendil-works/pi-ai'
import { buildCatalog, type ProviderCatalog } from './build'
import { PROVIDERS } from './providers/index'
import { loadCatalogSources } from './sources/index'

export interface GeneratorOptions {
  strict?: boolean
  jsonOnly?: boolean
  timeoutMs?: number
}

export const DEFAULT_CATALOG_TIMEOUT_MS = 30000

/** Key models by id, keeping the first entry per id, sorted by id. */
function sortedById<T extends { id: string }>(models: readonly T[]): [string, T][] {
  const byId = new Map<string, T>()
  for (const model of models) {
    if (!byId.has(model.id)) byId.set(model.id, model)
  }
  return [...byId].sort(([left], [right]) => left.localeCompare(right))
}

export async function generateModels(options: GeneratorOptions = {}) {
  const strict = options.strict ?? true
  const timeoutMs = options.timeoutMs ?? DEFAULT_CATALOG_TIMEOUT_MS

  const sources = await loadCatalogSources(strict, timeoutMs)
  const catalogs = buildCatalog(PROVIDERS, sources, strict)

  // Providers without any chat models are left out.
  const activeCatalogs: Record<string, ProviderCatalog> = Object.fromEntries(
    Object.entries(catalogs).filter(([, catalog]) => catalog.chat.length > 0),
  )

  const sortedProviderIds = Object.keys(activeCatalogs).sort()
  const jsonProviders: Record<string, Record<string, Model<Api>>> = {}
  const generatedDataProviders: Record<string, Record<string, Record<string, Model<Api>>>> = {}

  for (const providerId of sortedProviderIds) {
    const models = Object.fromEntries(sortedById(activeCatalogs[providerId].chat))
    jsonProviders[providerId] = models
    generatedDataProviders[providerId] = {}
    const apiIds = Array.from(new Set(Object.values(models).map((model) => model.api))).sort()
    for (const api of apiIds) {
      generatedDataProviders[providerId][api] = {}
      for (const [modelId, model] of Object.entries(models)) {
        if (model.api !== api) continue
        generatedDataProviders[providerId][api][modelId] = model
      }
    }
  }

  return {
    providers: jsonProviders,
    groupedProviders: generatedDataProviders,
    sortedProviderIds,
  }
}
