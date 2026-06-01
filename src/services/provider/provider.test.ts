import { setupTestDbHooks } from '@shumai/db'
import { teamService } from '@/services/team/team'
import { providerService } from './provider'
import { describe, expect, it } from 'vitest'
import { ProviderConfigSerializable, providerModelSchema } from '@shumai/dtos'
import { builtinProviders } from '@/generated/providers.generated'
import { z } from 'zod'

type ProviderModel = z.infer<typeof providerModelSchema>

describe('ProviderService', () => {
  setupTestDbHooks()

  it('should initialize builtin providers', async () => {
    const team = await teamService.ensureDefaultTeam()

    // Server startup/init logic
    await providerService.initBuiltinProviders(team.id)

    const providers = await providerService.listByTeam(team.id)
    expect(providers.length).toBeGreaterThan(0)

    const anthropic = providers.find((p) => p.name === 'anthropic')
    expect(anthropic).toBeDefined()
    expect(anthropic?.isBuiltin).toBe(true)
    expect(anthropic?.modelsCount).toBeGreaterThan(0)
  })

  it('should initialize builtin providers in correct order', async () => {
    const team = await teamService.ensureDefaultTeam()
    await providerService.initBuiltinProviders(team.id)

    const providers = await providerService.listByTeam(team.id)

    // The first provider in generated file is 'openai'
    // Since we use id: 'desc', 'openai' should be first in the list
    const firstInGenerated = Object.keys(builtinProviders)[0]
    expect(providers[0].name).toBe(firstInGenerated)
  })

  it('should prevent deletion of builtin providers', async () => {
    const team = await teamService.ensureDefaultTeam()
    await providerService.initBuiltinProviders(team.id)

    const providers = await providerService.listByTeam(team.id)
    const builtin = providers.find((p) => p.isBuiltin)
    expect(builtin).toBeDefined()

    await expect(providerService.delete(team.id, builtin!.id)).rejects.toThrow(
      'Cannot delete builtin provider',
    )
  })

  it('should allow editing builtin providers', async () => {
    const team = await teamService.ensureDefaultTeam()
    await providerService.initBuiltinProviders(team.id)

    const providers = await providerService.listByTeam(team.id)
    const builtin = providers.find((p) => p.name === 'openai')
    const builtinModels = await providerService.listModelsByProvider(team.id, builtin!.id)

    const newConfig: ProviderConfigSerializable = {
      ...builtin!.config,
      apiKey: 'new-key',
    }
    const updated = await providerService.update(team.id, builtin!.id, newConfig, builtinModels)

    expect(updated.config.apiKey).toBe('new-key')
    expect(updated.models.length).toBe(builtin!.modelsCount)

    const sortedUpdatedModels = [...updated.models].sort((a, b) =>
      a.modelId.localeCompare(b.modelId),
    )
    const sortedBuiltinModels = [...builtinModels].sort((a, b) =>
      a.modelId.localeCompare(b.modelId),
    )

    sortedUpdatedModels.forEach((model, i) => {
      expect(model.modelId).toBe(sortedBuiltinModels[i].modelId)
      expect(model.config).toEqual(sortedBuiltinModels[i].config)
    })
  })

  it('should create, list, update and delete custom providers', async () => {
    const team = await teamService.ensureDefaultTeam()

    // 1. Create
    const config: ProviderConfigSerializable = {
      baseUrl: 'https://api.openai.com/v1',
      api: 'openai-completions',
      apiKey: 'test-key',
    }
    const models: ProviderModel[] = [
      {
        modelId: 'gpt-4',
        name: 'GPT-4',
        config: {
          api: 'openai-completions',
          reasoning: false,
          input: ['text'],
          contextWindow: 128000,
          maxTokens: 4096,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      },
    ]
    const provider = await providerService.create(team.id, 'my-openai', config, models)
    expect(provider.id).toBeDefined()
    expect(provider.name).toBe('my-openai')
    expect(provider.config).toEqual(config)
    expect(provider.models).toHaveLength(1)
    expect(provider.models[0].modelId).toBe('gpt-4')

    // 2. List
    const providers = await providerService.listByTeam(team.id)
    const myProvider = providers.find((p) => p.id === provider.id)
    expect(myProvider).toBeDefined()
    expect(myProvider!.id).toBe(provider.id)
    expect(myProvider!.modelsCount).toBe(1)

    // 3. Update
    const newConfig: ProviderConfigSerializable = {
      ...config,
      apiKey: 'new-key',
    }
    const currentModels = await providerService.listModelsByProvider(team.id, provider.id)
    const newModels: ProviderModel[] = [
      ...currentModels,
      {
        modelId: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        config: {
          api: 'openai-completions',
          reasoning: false,
          input: ['text', 'image'],
          contextWindow: 128000,
          maxTokens: 4096,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      },
    ]
    const updated = await providerService.update(team.id, provider.id, newConfig, newModels)
    expect(updated.config.apiKey).toBe('new-key')
    expect(updated.models).toHaveLength(2)

    // 4. Delete
    await providerService.delete(team.id, provider.id)
    const afterDelete = await providerService.listByTeam(team.id)
    expect(afterDelete.find((p) => p.id === provider.id)).toBeUndefined()
  })
})
