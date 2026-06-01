import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db'
import { collectionService } from './collection'
import { projectService } from '../project/project'

describe('CollectionService', () => {
  setupTestDbHooks()

  async function setupProject() {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: 'test@example.com' },
    })
    const team = await prisma.team.create({
      data: {
        name: 'Test Team',
        settings: {
          enablePublicSignup: true,
          transcode: { videoStrategy: 'best_match' },
        },
        sandbox: { create: {} },
      },
    })
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'owner',
        scope: 'team',
      },
    })
    const project = await projectService.createProject(user, {
      teamId: team.id,
      name: 'Test Project',
    })
    return { team, project }
  }

  it('can create, get, update, and delete a collection', async () => {
    const { project } = await setupProject()

    // Create
    const collection = await collectionService.createCollection(project.id, {
      name: 'Test Collection',
      filter: {
        sourceFolderId: project.rootFolder!,
        searchFilter: {
          operator: 'AND',
          conditions: [{ field: 'name', operator: 'contains', value: 'test' }],
          recursively: true,
          isSemantic: false,
        },
      },
    })
    expect(collection.name).toBe('Test Collection')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((collection.filter as any).searchFilter.conditions[0].value).toBe('test')

    // Get
    const fetched = await collectionService.getCollection(collection.id)
    expect(fetched?.id).toBe(collection.id)

    // Update
    const updated = await collectionService.updateCollection(collection.id, {
      name: 'Updated Name',
      filter: {
        sourceFolderId: project.rootFolder!,
        searchFilter: {
          operator: 'AND',
          conditions: [{ field: 'rating', operator: 'eq', value: 5 }],
          recursively: true,
          isSemantic: false,
        },
      },
    })
    expect(updated.name).toBe('Updated Name')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((updated.filter as any).searchFilter.conditions[0].field).toBe('rating')

    // Delete
    await collectionService.deleteCollection(collection.id)
    const deleted = await collectionService.getCollection(collection.id)
    expect(deleted).toBeNull()
  })

  it('can list collections for a project with pagination', async () => {
    const { project } = await setupProject()

    // Create multiple collections
    for (let i = 0; i < 5; i++) {
      await collectionService.createCollection(project.id, {
        name: `Collection ${i}`,
        filter: {
          sourceFolderId: project.rootFolder!,
          searchFilter: { operator: 'AND', conditions: [], recursively: true, isSemantic: false },
        },
      })
    }

    // List first page
    const list1 = await collectionService.listCollections(project.id, {
      first: 2,
      includeCount: true,
    })
    expect(list1.data.length).toBe(2)
    expect(list1.pageInfo.total).toBe(5)
    expect(list1.pageInfo.cursor).toBeDefined()

    // List second page
    const list2 = await collectionService.listCollections(project.id, {
      first: 2,
      after: list1.pageInfo.cursor,
    })
    expect(list2.data.length).toBe(2)
    expect(list2.data[0].name).not.toBe(list1.data[0].name)

    // List last page
    const list3 = await collectionService.listCollections(project.id, {
      first: 2,
      after: list2.pageInfo.cursor,
    })
    expect(list3.data.length).toBe(1)
    expect(list3.pageInfo.cursor).toBeUndefined()
  })

  it('cascades delete when project is deleted', async () => {
    const { project } = await setupProject()

    await collectionService.createCollection(project.id, {
      name: 'To be deleted',
      filter: {
        sourceFolderId: project.rootFolder!,
        searchFilter: { operator: 'AND', conditions: [], recursively: true, isSemantic: false },
      },
    })

    const countBefore = await prisma.collection.count({
      where: { projectId: project.id },
    })
    expect(countBefore).toBe(1)

    await projectService.deleteProject(project.id)

    const countAfter = await prisma.collection.count({
      where: { projectId: project.id },
    })
    expect(countAfter).toBe(0)
  })
})
