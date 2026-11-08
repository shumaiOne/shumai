import type { Model } from '@earendil-works/pi-ai'
import {
  MODELS_DEV_URL,
  type ModelsDevDecisionMetadata,
  type ModelsDevV2Catalog,
} from './models-dev'
import { fetchOpenRouterCatalog, type OpenRouterCatalog } from './openrouter'
import { type AiGatewayCatalog, fetchAiGatewayCatalog } from './vercel-ai-gateway'

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'

/** Everything fetched from upstream before the catalog is built. */
export interface CatalogSources {
  modelsDev: ModelsDevV2Catalog
  modelsDevDecisions: Record<string, ModelsDevDecisionMetadata>
  openRouter: OpenRouterCatalog
  aiGateway: AiGatewayCatalog
  /** Live NVIDIA NIM ids, keyed by both the raw and the normalized id. */
  nvidiaModelIds: Map<string, string>
  radius: Model<'pi-messages'>[]
}

async function fetchJson<T>(url: string, label: string, timeoutMs: number): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`${label} returned ${response.status}`)
  return (await response.json()) as T
}

export function normalizeNvidiaModelId(modelId: string): string {
  return modelId.toLowerCase().replaceAll('_', '.')
}

async function fetchNvidiaModelIds(timeoutMs: number): Promise<Map<string, string>> {
  const data = await fetchJson<{ data?: { id: string }[] }>(
    `${NVIDIA_BASE_URL}/models`,
    'NVIDIA NIM API',
    timeoutMs,
  )
  const modelIds = new Map<string, string>()
  for (const model of data.data ?? []) {
    modelIds.set(model.id, model.id)
    modelIds.set(normalizeNvidiaModelId(model.id), model.id)
  }
  return modelIds
}

/**
 * Fetch every chat upstream source. In strict mode any failure aborts generation;
 * otherwise a failed source contributes nothing.
 */
export async function loadCatalogSources(
  strict: boolean,
  timeoutMs: number,
): Promise<CatalogSources> {
  async function load<T>(label: string, fetcher: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fetcher()
    } catch (error) {
      if (strict) throw error
      return fallback
    }
  }

  const modelsDev = await load(
    'models.dev catalog',
    () => fetchJson<ModelsDevV2Catalog>(MODELS_DEV_URL, 'models.dev API', timeoutMs),
    {},
  )
  const nvidiaModelIds = modelsDev.nvidia?.models
    ? await load(
        'NVIDIA NIM models',
        () => fetchNvidiaModelIds(timeoutMs),
        new Map<string, string>(),
      )
    : new Map<string, string>()
  const openRouter = await load('OpenRouter models', () => fetchOpenRouterCatalog(timeoutMs), {
    chat: [],
    images: [],
    classifiers: [],
  })
  const aiGateway = await load('Vercel AI Gateway models', () => fetchAiGatewayCatalog(timeoutMs), {
    chat: [],
    classifiers: [],
  })

  return {
    modelsDev,
    modelsDevDecisions: {},
    openRouter,
    aiGateway,
    nvidiaModelIds,
    radius: [],
  }
}
