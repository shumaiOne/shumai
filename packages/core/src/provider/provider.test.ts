import { setupTestDbHooks } from '@shumai/db/test'
import { teamService } from '@shumai/core/src/team/team'
import { agentService } from '@shumai/core/src/agent/agent'
import { providerService } from './provider'
import { describe, expect, it } from 'vitest'
import { ProviderConfigSerializable, providerModelSchema } from '@shumai/dtos'
import { getBuiltinProvidersMap } from '@shumai/core/src/provider/builtin'
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
    const builtinProviders = getBuiltinProvidersMap()
    const firstInGenerated = Object.keys(builtinProviders)[0]
    expect(providers[0].name).toBe(firstInGenerated)
  })

  it('should allow deletion of builtin providers', async () => {
    const team = await teamService.ensureDefaultTeam()
    await providerService.initBuiltinProviders(team.id)

    const providers = await providerService.listByTeam(team.id)
    const builtin = providers.find((p) => p.isBuiltin)
    expect(builtin).toBeDefined()

    await providerService.delete(team.id, builtin!.id)
    const afterDelete = await providerService.listByTeam(team.id)
    expect(afterDelete.find((p) => p.id === builtin!.id)).toBeUndefined()
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

  it('should preserve model IDs and linked agent modelId when updating provider config', async () => {
    const team = await teamService.ensureDefaultTeam()
    await providerService.initBuiltinProviders(team.id)

    const providers = await providerService.listByTeam(team.id)
    const googleProvider = providers.find((p) => p.name === 'google')
    expect(googleProvider).toBeDefined()

    const initialModels = await providerService.listModelsByProvider(team.id, googleProvider!.id)
    expect(initialModels.length).toBeGreaterThan(0)
    const initialModelId = initialModels[0].id

    // Create an agent pointing to the google provider and first model
    const agent = await agentService.createAgent({
      teamId: team.id,
      name: 'Google Agent',
      type: 'chat',
      enabled: true,
      thinkingLevel: 'off',
      providerId: googleProvider!.id,
      modelId: initialModelId,
    })
    expect(agent?.modelId).toBe(initialModelId)

    // Update provider config (e.g. API key) with the same model list
    const newConfig: ProviderConfigSerializable = {
      ...googleProvider!.config,
      apiKey: 'new-google-api-key',
    }
    await providerService.update(team.id, googleProvider!.id, newConfig, initialModels)

    // Verify model IDs were preserved
    const updatedModels = await providerService.listModelsByProvider(team.id, googleProvider!.id)
    expect(updatedModels[0].id).toBe(initialModelId)

    // Verify agent's modelId is still linked and not nulled out
    const updatedAgents = await agentService.listAgents({ teamId: team.id })
    const updatedAgent = updatedAgents.find((a) => a.id === agent!.id)
    expect(updatedAgent?.modelId).toBe(initialModelId)
  })

  it('should support granular model CRUD operations and order by id desc', async () => {
    const team = await teamService.ensureDefaultTeam()
    const provider = await providerService.create(
      team.id,
      'test-granular-provider',
      { api: 'openai-completions', apiKey: 'key1' },
      [],
    )

    // 1. createModel
    const createdModel1 = await providerService.createModel(team.id, provider.id, {
      modelId: 'custom-model-1',
      name: 'Custom Model 1',
      config: {
        reasoning: true,
        input: ['text', 'image'],
        contextWindow: 200000,
        maxTokens: 8192,
        cost: { input: 1.5, output: 5, cacheRead: 0.1, cacheWrite: 0.5 },
      },
    })
    expect(createdModel1.modelId).toBe('custom-model-1')
    expect(createdModel1.name).toBe('Custom Model 1')
    expect((createdModel1.config as { reasoning: boolean }).reasoning).toBe(true)

    // Check duplicate modelId error
    await expect(
      providerService.createModel(team.id, provider.id, {
        modelId: 'custom-model-1',
        name: 'Duplicate',
        config: {
          reasoning: false,
          input: ['text'],
          contextWindow: 100000,
          maxTokens: 4000,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      }),
    ).rejects.toThrow('already exists')

    // 2. createModel 2
    const createdModel2 = await providerService.createModel(team.id, provider.id, {
      modelId: 'custom-model-2',
      name: 'Custom Model 2',
      config: {
        reasoning: false,
        input: ['text'],
        contextWindow: 100000,
        maxTokens: 4000,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
    })

    // 3. listModelsByProvider should return newest first (id desc)
    const models = await providerService.listModelsByProvider(team.id, provider.id)
    expect(models).toHaveLength(2)
    expect(models[0].id).toBe(createdModel2.id)
    expect(models[1].id).toBe(createdModel1.id)

    // 4. updateModel
    const updatedModel = await providerService.updateModel(team.id, provider.id, createdModel1.id, {
      name: 'Updated Model 1',
      config: {
        reasoning: false,
        input: ['text'],
        contextWindow: 64000,
        maxTokens: 2048,
        cost: { input: 2, output: 8, cacheRead: 0.2, cacheWrite: 0.8 },
      },
    })
    expect(updatedModel.name).toBe('Updated Model 1')
    expect((updatedModel.config as { reasoning: boolean }).reasoning).toBe(false)
    expect((updatedModel.config as { cost: { input: number } }).cost.input).toBe(2)

    // 5. update provider config and name without touching models
    const updatedProvider = await providerService.update(
      team.id,
      provider.id,
      { api: 'openai-completions', apiKey: 'new-key' },
      undefined,
      'renamed-provider',
    )
    expect(updatedProvider.name).toBe('renamed-provider')
    expect(updatedProvider.config.apiKey).toBe('new-key')
    const modelsAfterProviderUpdate = await providerService.listModelsByProvider(
      team.id,
      provider.id,
    )
    expect(modelsAfterProviderUpdate).toHaveLength(2)

    // 6. deleteModel
    await providerService.deleteModel(team.id, provider.id, createdModel2.id)
    const modelsAfterDelete = await providerService.listModelsByProvider(team.id, provider.id)
    expect(modelsAfterDelete).toHaveLength(1)
    expect(modelsAfterDelete[0].id).toBe(createdModel1.id)
  })
})
