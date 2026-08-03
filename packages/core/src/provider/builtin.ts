import { getBuiltinProviders, getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import type { ProviderConfigSerializable, providerModelSchema } from '@shumai/dtos'
import type { z } from 'zod'

type ProviderModel = z.infer<typeof providerModelSchema>

export const PRIORITY_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'groq',
  'openrouter',
  'mistral',
  'amazon-bedrock',
]

export const ENV_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  'github-copilot': 'COPILOT_GITHUB_TOKEN',
  'azure-openai-responses': 'AZURE_OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  google: 'GEMINI_API_KEY',
  'google-vertex': 'GOOGLE_CLOUD_API_KEY',
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  xai: 'XAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  'vercel-ai-gateway': 'AI_GATEWAY_API_KEY',
  zai: 'ZAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  'minimax-cn': 'MINIMAX_CN_API_KEY',
  moonshotai: 'MOONSHOT_API_KEY',
  'moonshotai-cn': 'MOONSHOT_API_KEY',
  huggingface: 'HF_TOKEN',
  fireworks: 'FIREWORKS_API_KEY',
  together: 'TOGETHER_API_KEY',
  opencode: 'OPENCODE_API_KEY',
  'opencode-go': 'OPENCODE_API_KEY',
  'kimi-coding': 'KIMI_API_KEY',
  'cloudflare-workers-ai': 'CLOUDFLARE_API_KEY',
  'cloudflare-ai-gateway': 'CLOUDFLARE_API_KEY',
  xiaomi: 'XIAOMI_API_KEY',
  'xiaomi-token-plan-cn': 'XIAOMI_TOKEN_PLAN_CN_API_KEY',
  'xiaomi-token-plan-ams': 'XIAOMI_TOKEN_PLAN_AMS_API_KEY',
  'xiaomi-token-plan-sgp': 'XIAOMI_TOKEN_PLAN_SGP_API_KEY',
}

export interface BuiltinProviderData {
  name: string
  config: ProviderConfigSerializable
  models: ProviderModel[]
}

export function getBuiltinProvidersMap(): Record<string, BuiltinProviderData> {
  const providerNames = getBuiltinProviders()

  providerNames.sort((a, b) => {
    const indexA = PRIORITY_PROVIDERS.indexOf(a)
    const indexB = PRIORITY_PROVIDERS.indexOf(b)

    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    return a.localeCompare(b)
  })

  const providers: Record<string, BuiltinProviderData> = {}

  for (const providerName of providerNames) {
    const modelList = getBuiltinModels(providerName)
    if (!modelList || modelList.length === 0) continue

    const firstModel = modelList[0]
    providers[providerName] = {
      name: providerName,
      config: {
        api: firstModel.api as ProviderConfigSerializable['api'],
        baseUrl: firstModel.baseUrl,
        apiKey: ENV_MAP[providerName] || '',
      },
      models: modelList.map((m) => ({
        modelId: m.id,
        name: m.name,
        config: {
          api: m.api as ProviderConfigSerializable['api'],
          reasoning: m.reasoning,
          input: m.input,
          contextWindow: m.contextWindow,
          maxTokens: m.maxTokens,
          cost: m.cost,
        },
      })),
    }
  }

  return providers
}
