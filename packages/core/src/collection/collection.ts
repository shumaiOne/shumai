import { prisma } from '@shumai/db'
import { paginateQuery } from '../pagination'
import {
  CreateCollectionRequest,
  UpdateCollectionRequest,
  ListCollectionsRequest,
} from '@shumai/dtos'

export class CollectionService {
  async createCollection(projectId: string, req: CreateCollectionRequest, creatorId?: string) {
    return await prisma.collection.create({
      data: {
        name: req.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: req.filter as any,
        projectId,
        creatorId,
      },
      include: { creator: true },
    })
  }

  async updateCollection(collectionId: string, req: UpdateCollectionRequest) {
    return await prisma.collection.update({
      where: { id: collectionId },
      data: {
        ...(req.name && { name: req.name }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(req.filter && { filter: req.filter as any }),
      },
      include: { creator: true },
    })
  }

  async deleteCollection(collectionId: string) {
    return await prisma.collection.delete({
      where: { id: collectionId },
    })
  }

  async getCollection(collectionId: string) {
    return await prisma.collection.findUnique({
      where: { id: collectionId },
      include: { creator: true },
    })
  }

  async listCollections(projectId: string, req: ListCollectionsRequest) {
    return await paginateQuery(
      (skip, take) =>
        prisma.collection.findMany({
          where: { projectId },
          include: { creator: true },
          orderBy: { id: 'desc' },
          skip,
          take,
        }),
      () => prisma.collection.count({ where: { projectId } }),
      req,
    )
  }
}

export const collectionService = new CollectionService()
