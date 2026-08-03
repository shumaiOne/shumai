import { prisma } from '@shumai/db'
import { ProviderConfigSerializable, providerModelSchema } from '@shumai/dtos'
import { getBuiltinProvidersMap } from '@shumai/core/src/provider/builtin'
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
      orderBy: { id: 'asc' },
    })
  }

  async create(
    teamId: string,
    name: string,
    config: ProviderConfigSerializable,
    models: ProviderModel[],
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
    models: ProviderModel[],
  ) {
    return this.prismaClient.$transaction(async (tx) => {
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
        if (existing) {
          await tx.model.update({
            where: { id: existing.id },
            data: {
              name: m.name,
              config: m.config,
            },
          })
        } else {
          await tx.model.create({
            data: {
              providerId: id,
              modelId: m.modelId,
              name: m.name,
              config: m.config,
            },
          })
        }
      }

      // Update provider config
      return tx.provider.update({
        where: { id, teamId },
        data: {
          config,
        },
        include: { models: true },
      })
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
}

export const providerService = new ProviderService()
