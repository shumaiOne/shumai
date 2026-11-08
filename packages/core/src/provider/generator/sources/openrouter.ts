import {
  type OpenRouterModel,
  openRouterCost,
} from '@earendil-works/pi-ai/providers/openrouter-api'
import type {
  ClassifierModel,
  ImageModel,
  Model,
  ThinkingLevel,
  ThinkingLevelMap,
} from '@earendil-works/pi-ai'
import { getEffortThinkingLevelMap } from '../reasoning'

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

export interface OpenRouterReasoningMetadata {
  mandatory?: boolean
  default_enabled?: boolean
  supported_efforts?: Array<ThinkingLevel | 'none'>
  default_effort?: ThinkingLevel | 'none'
}

/** Convert OpenRouter's reasoning metadata into Pi model capabilities. */
export function getOpenRouterThinkingLevelMap(
  reasoning: OpenRouterReasoningMetadata | undefined,
): ThinkingLevelMap | undefined {
  if (!reasoning) return undefined
  if (!reasoning.supported_efforts?.length) {
    return reasoning.mandatory === true ? { off: null } : undefined
  }

  // OpenRouter's supported_efforts uses the same effort values as models.dev reasoning_options,
  // so both sources can share the same Pi thinking-level conversion.
  const map = getEffortThinkingLevelMap([{ type: 'effort', values: reasoning.supported_efforts }])
  if (!map) return reasoning.mandatory === true ? { off: null } : undefined
  return { ...map, off: reasoning.mandatory === true ? null : 'none' }
}

export interface OpenRouterModelListItem extends OpenRouterModel {
  name: string
  supported_parameters?: string[]
  architecture?: { modality?: string; input_modalities?: string[]; output_modalities?: string[] }
  reasoning?: OpenRouterReasoningMetadata
}

export interface OpenRouterCatalog {
  chat: Model<'anthropic-messages' | 'openai-completions'>[]
  images: ImageModel<'openrouter-images'>[]
  classifiers: ClassifierModel<'typesafe-system-one'>[]
}

export function buildOpenRouterCatalog(
  listed: readonly OpenRouterModelListItem[],
): OpenRouterCatalog {
  const chat: OpenRouterCatalog['chat'] = []

  for (const model of listed) {
    // Only include models that support tools
    if (!model.supported_parameters?.includes('tools')) continue
    // Parse input modalities
    const input: ('text' | 'image')[] = ['text']
    if (model.architecture?.modality?.includes('image')) {
      input.push('image')
    }

    const thinkingLevelMap = getOpenRouterThinkingLevelMap(model.reasoning)
    // Includes the `~anthropic/claude-*-latest` aliases, which OpenRouter's Messages endpoint accepts.
    const useAnthropicMessages = /^~?anthropic\//.test(model.id) && !model.id.endsWith(':batch')
    chat.push({
      type: 'chat',
      id: model.id,
      name: model.name,
      api: useAnthropicMessages ? 'anthropic-messages' : 'openai-completions',
      baseUrl: useAnthropicMessages ? 'https://openrouter.ai/api' : 'https://openrouter.ai/api/v1',
      provider: 'openrouter',
      reasoning: model.supported_parameters?.includes('reasoning') || false,
      ...(thinkingLevelMap && { thinkingLevelMap }),
      input,
      cost: openRouterCost(model.pricing),
      contextWindow: model.top_provider?.context_length || model.context_length || 4096,
      maxTokens: model.top_provider?.max_completion_tokens || 4096,
    })
  }

  return { chat, images: [], classifiers: [] }
}

/** Fetch the tool-capable chat listing. */
export async function fetchOpenRouterCatalog(timeoutMs: number): Promise<OpenRouterCatalog> {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`OpenRouter API returned ${response.status}`)
  const data = (await response.json()) as { data?: OpenRouterModelListItem[] }
  return buildOpenRouterCatalog(data.data ?? [])
}
