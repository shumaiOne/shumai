import { prisma } from '@/db'
import { ProviderConfigSerializable, providerModelSchema } from '@/dtos/provider'
import { builtinProviders } from '@/generated/providers.generated'
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
      // We insert them one by one in reverse order to ensure that the
      // popular providers (first in builtinProviders) get the highest ULIDs
      // and appear first when sorted by id DESC.
      const entries = Object.entries(builtinProviders).reverse()
      for (const [name, data] of entries) {
        const typedData = data as unknown as {
          config: ProviderConfigSerializable
          models: ProviderModel[]
        }
        await this.prismaClient.provider.create({
          data: {
            teamId: team.id,
            name,
            config: typedData.config,
            isBuiltin: true,
            models: {
              create: typedData.models.map((m) => ({
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
      // Delete all existing models for this provider
      await tx.model.deleteMany({
        where: { providerId: id },
      })

      // Update provider and recreate models
      return tx.provider.update({
        where: { id, teamId },
        data: {
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
    })
  }

  async delete(teamId: string, id: string) {
    const provider = await this.prismaClient.provider.findUnique({
      where: { id, teamId },
    })

    if (!provider) {
      throw new Error('Provider not found')
    }

    if (provider.isBuiltin) {
      throw new Error('Cannot delete builtin provider')
    }

    return this.prismaClient.provider.delete({
      where: { id, teamId },
    })
  }
}

export const providerService = new ProviderService()
