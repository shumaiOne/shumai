import { prisma } from '@shumai/db'
import {
  CreateModelRequest,
  ProviderConfigSerializable,
  providerModelSchema,
  SyncApplyRequest,
  SyncApplyResponse,
  SyncCheckResponse,
  SyncModelItem,
  SyncProviderItem,
  UpdateModelRequest,
} from '@shumai/dtos'
import {
  ENV_MAP,
  getBuiltinProvidersMap,
  PRIORITY_PROVIDERS,
} from '@shumai/core/src/provider/builtin'
import { generateModels } from '@shumai/core/src/provider/generator/generate-models'
import { z } from 'zod'

type ProviderModel = z.infer<typeof providerModelSchema>

export class ProviderService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async initBuiltinProviders(teamId: string) {
    const team = await this.prismaClient.team.findUnique({
      where: { id: teamId },
      include: {
        _count: {
          select: { providers: true },
        },
      },
    })

    if (team && team._count.providers === 0) {
      const builtinProviders = getBuiltinProvidersMap()
      // We insert them one by one in reverse order to ensure that the
      // popular providers (first in builtinProviders) get the highest ULIDs
      // and appear first when sorted by id DESC.
      const entries = Object.entries(builtinProviders).reverse()
      for (const [name, data] of entries) {
        await this.prismaClient.provider.create({
          data: {
            teamId: team.id,
            name,
            config: data.config,
            isBuiltin: true,
            models: {
              create: data.models.map((m) => ({
                modelId: m.modelId,
                name: m.name,
                config: m.config,
              })),
            },
          },
        })
      }
    }
  }

  async listByTeam(teamId: string) {
    const providers = await this.prismaClient.provider.findMany({
      where: { teamId },
      include: {
        _count: {
          select: { models: true },
        },
      },
      orderBy: { id: 'desc' },
    })

    return providers.map((p) => ({
      ...p,
      modelsCount: p._count.models,
      _count: undefined,
    }))
  }

  async getById(id: string) {
    return this.prismaClient.provider.findUnique({
      where: { id },
    })
  }

  async listModelsByProvider(teamId: string, providerId: string) {
    return this.prismaClient.model.findMany({
      where: {
        providerId,
        provider: { teamId },
      },
      orderBy: { id: 'desc' },
    })
  }

  async create(
    teamId: string,
    name: string,
    config: ProviderConfigSerializable,
    models: ProviderModel[] = [],
  ) {
    return this.prismaClient.provider.create({
      data: {
        teamId,
        name,
        config,
        models: {
          create: models.map((m) => ({
            modelId: m.modelId,
            name: m.name,
            config: m.config,
          })),
        },
      },
      include: { models: true },
    })
  }

  async update(
    teamId: string,
    id: string,
    config: ProviderConfigSerializable,
    models?: ProviderModel[],
    name?: string,
  ) {
    return this.prismaClient.$transaction(async (tx) => {
      if (models !== undefined) {
        const existingModels = await tx.model.findMany({
          where: { providerId: id },
        })

        const existingByModelId = new Map(existingModels.map((m) => [m.modelId, m]))
        const incomingModelIds = new Set(models.map((m) => m.modelId))

        // Delete models that are no longer in the incoming list
        const modelsToDelete = existingModels.filter((m) => !incomingModelIds.has(m.modelId))
        if (modelsToDelete.length > 0) {
          await tx.model.deleteMany({
            where: {
              id: { in: modelsToDelete.map((m) => m.id) },
            },
          })
        }

        // Update existing models or create new ones
        for (const m of models) {
          const existing = existingByModelId.get(m.modelId)
          const modelConfig = {
            ...m.config,
            api: m.config?.api || config.api,
          }
          if (existing) {
            await tx.model.update({
              where: { id: existing.id },
              data: {
                name: m.name,
                config: modelConfig,
              },
            })
          } else {
            await tx.model.create({
              data: {
                providerId: id,
                modelId: m.modelId,
                name: m.name,
                config: modelConfig,
              },
            })
          }
        }
      } else if (config.api) {
        // Propagate provider API protocol change to all existing models
        const existingModels = await tx.model.findMany({
          where: { providerId: id },
        })
        for (const m of existingModels) {
          const currentConfig = m.config
          if (currentConfig.api !== config.api) {
            await tx.model.update({
              where: { id: m.id },
              data: {
                config: {
                  ...currentConfig,
                  api: config.api,
                },
              },
            })
          }
        }
      }

      // Update provider config and optional name
      return tx.provider.update({
        where: { id, teamId },
        data: {
          config,
          ...(name ? { name } : {}),
        },
        include: { models: true },
      })
    })
  }

  async createModel(teamId: string, providerId: string, data: CreateModelRequest) {
    const provider = await this.prismaClient.provider.findUnique({
      where: { id: providerId, teamId },
    })
    if (!provider) {
      throw new Error('Provider not found')
    }

    const existing = await this.prismaClient.model.findFirst({
      where: {
        providerId,
        modelId: data.modelId,
      },
    })
    if (existing) {
      throw new Error(`Model with id "${data.modelId}" already exists for this provider`)
    }

    return this.prismaClient.model.create({
      data: {
        providerId,
        modelId: data.modelId,
        name: data.name ?? '',
        config: data.config,
      },
    })
  }

  async updateModel(
    teamId: string,
    providerId: string,
    modelDbId: string,
    data: UpdateModelRequest,
  ) {
    const provider = await this.prismaClient.provider.findUnique({
      where: { id: providerId, teamId },
    })
    if (!provider) {
      throw new Error('Provider not found')
    }

    const model = await this.prismaClient.model.findFirst({
      where: { id: modelDbId, providerId },
    })
    if (!model) {
      throw new Error('Model not found')
    }

    if (data.modelId && data.modelId !== model.modelId) {
      const existingWithNewId = await this.prismaClient.model.findFirst({
        where: {
          providerId,
          modelId: data.modelId,
        },
      })
      if (existingWithNewId) {
        throw new Error(`Model with id "${data.modelId}" already exists for this provider`)
      }
    }

    return this.prismaClient.model.update({
      where: { id: modelDbId },
      data: {
        ...(data.modelId ? { modelId: data.modelId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.config ? { config: data.config } : {}),
      },
    })
  }

  async deleteModel(teamId: string, providerId: string, modelDbId: string) {
    const provider = await this.prismaClient.provider.findUnique({
      where: { id: providerId, teamId },
    })
    if (!provider) {
      throw new Error('Provider not found')
    }

    const model = await this.prismaClient.model.findFirst({
      where: { id: modelDbId, providerId },
    })
    if (!model) {
      throw new Error('Model not found')
    }

    return this.prismaClient.model.delete({
      where: { id: modelDbId },
    })
  }

  async delete(teamId: string, id: string) {
    const provider = await this.prismaClient.provider.findUnique({
      where: { id, teamId },
    })

    if (!provider) {
      throw new Error('Provider not found')
    }

    return this.prismaClient.provider.delete({
      where: { id, teamId },
    })
  }

  async checkUpdates(teamId: string): Promise<SyncCheckResponse> {
    const catalog = await generateModels({ jsonOnly: true })

    const existingProviders = await this.prismaClient.provider.findMany({
      where: { teamId },
      include: { models: true },
    })

    const existingProviderMap = new Map<string, (typeof existingProviders)[number]>()
    for (const p of existingProviders) {
      existingProviderMap.set(p.name, p)
    }

    const items: SyncProviderItem[] = []
    let totalNewProviders = 0
    let totalNewModels = 0

    for (const providerId of catalog.sortedProviderIds) {
      const modelsMap = catalog.providers[providerId]
      if (!modelsMap) continue
      const modelList = Object.values(modelsMap)
      if (modelList.length === 0) continue

      const existingProvider = existingProviderMap.get(providerId)

      if (!existingProvider) {
        const firstModel = modelList[0]
        const newModels: SyncModelItem[] = modelList.map((m) => ({
          modelId: m.id,
          name: m.name || m.id,
          config: {
            api: m.api as ProviderConfigSerializable['api'],
            reasoning: m.reasoning ?? false,
            input: (m.input ?? ['text']) as ('text' | 'image')[],
            contextWindow: m.contextWindow,
            maxTokens: m.maxTokens,
            cost: {
              input: m.cost?.input ?? 0,
              output: m.cost?.output ?? 0,
              cacheRead: m.cost?.cacheRead ?? 0,
              cacheWrite: m.cost?.cacheWrite ?? 0,
            },
          },
        }))

        items.push({
          name: providerId,
          isNewProvider: true,
          config: {
            api: firstModel.api as ProviderConfigSerializable['api'],
            baseUrl: firstModel.baseUrl,
            apiKey: ENV_MAP[providerId] || '',
          },
          models: newModels,
        })

        totalNewProviders++
        totalNewModels += newModels.length
      } else {
        const existingModelIds = new Set(existingProvider.models.map((m) => m.modelId))
        const newModels: SyncModelItem[] = []

        for (const m of modelList) {
          if (!existingModelIds.has(m.id)) {
            newModels.push({
              modelId: m.id,
              name: m.name || m.id,
              config: {
                api: m.api as ProviderConfigSerializable['api'],
                reasoning: m.reasoning ?? false,
                input: (m.input ?? ['text']) as ('text' | 'image')[],
                contextWindow: m.contextWindow,
                maxTokens: m.maxTokens,
                cost: {
                  input: m.cost?.input ?? 0,
                  output: m.cost?.output ?? 0,
                  cacheRead: m.cost?.cacheRead ?? 0,
                  cacheWrite: m.cost?.cacheWrite ?? 0,
                },
              },
            })
          }
        }

        if (newModels.length > 0) {
          items.push({
            name: providerId,
            isNewProvider: false,
            config: existingProvider.config as ProviderConfigSerializable,
            models: newModels,
          })
          totalNewModels += newModels.length
        }
      }
    }

    items.sort((a, b) => {
      const indexA = PRIORITY_PROVIDERS.indexOf(a.name)
      const indexB = PRIORITY_PROVIDERS.indexOf(b.name)
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    return {
      providers: items,
      totalNewProviders,
      totalNewModels,
    }
  }

  async applySync(teamId: string, payload: SyncApplyRequest): Promise<SyncApplyResponse> {
    let addedProviders = 0
    let addedModels = 0

    await this.prismaClient.$transaction(async (tx) => {
      for (const providerItem of payload.providers) {
        let providerId: string

        if (providerItem.isNewProvider) {
          const existing = await tx.provider.findFirst({
            where: { teamId, name: providerItem.name },
          })
          if (!existing) {
            const created = await tx.provider.create({
              data: {
                teamId,
                name: providerItem.name,
                isBuiltin: true,
                config: providerItem.config,
              },
            })
            providerId = created.id
            addedProviders++
          } else {
            providerId = existing.id
          }
        } else {
          const existing = await tx.provider.findFirst({
            where: { teamId, name: providerItem.name },
          })
          if (!existing) continue
          providerId = existing.id
        }

        for (const modelItem of providerItem.models) {
          const existingModel = await tx.model.findFirst({
            where: {
              providerId,
              modelId: modelItem.modelId,
            },
          })
          if (!existingModel) {
            await tx.model.create({
              data: {
                providerId,
                modelId: modelItem.modelId,
                name: modelItem.name || modelItem.modelId,
                config: modelItem.config,
              },
            })
            addedModels++
          }
        }
      }
    })

    return { addedProviders, addedModels }
  }
}

export const providerService = new ProviderService()
