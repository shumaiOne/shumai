import { beforeAll, describe, expect, it } from 'vitest'
import { getBuiltinProvidersMap } from '../builtin'
import { generateModels, type GenerateModelsResult } from './generate-models'

describe('Vendored Model Generator vs Original Built-in Catalog', () => {
  let generatedResult: GenerateModelsResult

  beforeAll(async () => {
    generatedResult = await generateModels({ jsonOnly: true })
  }, 60000)

  it('should successfully execute generateModels and fetch catalog data', () => {
    expect(generatedResult).toBeDefined()
    expect(generatedResult.sortedProviderIds.length).toBeGreaterThanOrEqual(30)
    expect(Object.keys(generatedResult.providers).length).toBeGreaterThanOrEqual(30)
  })

  it('should contain all Shumai priority providers in the generated catalog', () => {
    const priorityProviders = [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'groq',
      'openrouter',
      'mistral',
      'amazon-bedrock',
    ]

    for (const providerId of priorityProviders) {
      expect(generatedResult.providers[providerId]).toBeDefined()
      expect(Object.keys(generatedResult.providers[providerId]).length).toBeGreaterThan(0)
    }
  })

  it('should conform to valid model structure across all generated providers', () => {
    for (const [providerId, models] of Object.entries(generatedResult.providers)) {
      for (const [modelId, model] of Object.entries(models)) {
        expect(model.id).toBe(modelId)
        expect(model.provider).toBe(providerId)
        expect(typeof model.name).toBe('string')
        expect(model.name.length).toBeGreaterThan(0)
        expect(typeof model.api).toBe('string')
        expect(typeof model.reasoning).toBe('boolean')
        expect(Array.isArray(model.input)).toBe(true)
        expect(model.contextWindow).toBeGreaterThan(0)
        expect(model.maxTokens).toBeGreaterThan(0)
        expect(model.cost).toBeDefined()
        expect(typeof model.cost.input).toBe('number')
        expect(typeof model.cost.output).toBe('number')
      }
    }
  })

  it('should preserve and match baseline models from getBuiltinProvidersMap', () => {
    const baselineMap = getBuiltinProvidersMap()

    // Test essential models across top providers
    const keyModelsToCheck: Array<{ provider: string; modelId: string }> = [
      { provider: 'openai', modelId: 'gpt-4o' },
      { provider: 'openai', modelId: 'gpt-4o-mini' },
      { provider: 'anthropic', modelId: 'claude-sonnet-4-5' },
      { provider: 'google', modelId: 'gemini-2.5-pro' },
      { provider: 'deepseek', modelId: 'deepseek-v4-flash' },
      { provider: 'groq', modelId: 'llama-3.3-70b-versatile' },
    ]

    for (const { provider, modelId } of keyModelsToCheck) {
      const baselineProvider = baselineMap[provider]
      expect(baselineProvider).toBeDefined()

      const baselineModel = baselineProvider.models.find((m) => m.modelId === modelId)
      expect(baselineModel).toBeDefined()

      const generatedModel = generatedResult.providers[provider]?.[modelId]
      expect(generatedModel).toBeDefined()

      // Ensure core configurations match baseline
      expect(generatedModel.api).toBe(baselineModel!.config.api)
      expect(generatedModel.contextWindow).toBe(baselineModel!.config.contextWindow)
    }
  })

  it('should correctly configure reasoning models with thinking level mappings', () => {
    const reasoningModelsToCheck = [
      { provider: 'openai', modelId: 'o1' },
      { provider: 'openai', modelId: 'o3-mini' },
    ]

    for (const { provider, modelId } of reasoningModelsToCheck) {
      const model = generatedResult.providers[provider]?.[modelId]
      if (model) {
        expect(model.reasoning).toBe(true)
        expect(model.thinkingLevelMap).toBeDefined()
      }
    }
  })

  it('should produce groupedProviders corresponding to API shards', () => {
    expect(generatedResult.groupedProviders).toBeDefined()

    for (const providerId of generatedResult.sortedProviderIds) {
      const grouped = generatedResult.groupedProviders[providerId]
      expect(grouped).toBeDefined()

      const flatModels = generatedResult.providers[providerId]
      let totalGroupedCount = 0
      for (const apiModels of Object.values(grouped)) {
        totalGroupedCount += Object.keys(apiModels).length
      }

      expect(totalGroupedCount).toBe(Object.keys(flatModels).length)
    }
  })
})
