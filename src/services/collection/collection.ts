import { prisma } from '@/db'
import { paginateQuery } from '../pagination'
import {
  CreateCollectionRequest,
  UpdateCollectionRequest,
  ListCollectionsRequest,
} from '@/dtos/collection'

export class CollectionService {
  async createCollection(projectId: string, req: CreateCollectionRequest) {
    return await prisma.collection.create({
      data: {
        name: req.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: req.filter as any,
        projectId,
      },
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
    })
  }

  async listCollections(projectId: string, req: ListCollectionsRequest) {
    return await paginateQuery(
      (skip, take) =>
        prisma.collection.findMany({
          where: { projectId },
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
