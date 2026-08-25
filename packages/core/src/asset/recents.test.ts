import { describe, it, expect } from 'vitest'
import { prisma, AssetType, AssetStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { assetService } from './asset'
import { projectService } from '../project/project'

describe('AssetService - Recently Viewed', () => {
  setupTestDbHooks()

  async function setupProject() {
    const user1 = await prisma.user.create({
      data: { name: 'User 1', email: 'user1@example.com' },
    })
    const user2 = await prisma.user.create({
      data: { name: 'User 2', email: 'user2@example.com' },
    })
    const team = await prisma.team.create({
      data: {
        name: 'Test Team',
        settings: {
          transcode: { videoStrategy: 'best_match' },
        },
        sandbox: { create: {} },
      },
    })
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user1.id,
        role: 'owner',
        scope: 'team',
      },
    })
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user2.id,
        role: 'editor',
        scope: 'team',
      },
    })

    const project = await projectService.createProject(user1, {
      name: 'Test Project',
      teamId: team.id,
    })

    return { user1, user2, team, project }
  }

  it('records recent file view and returns it in descending order', async () => {
    const { user1, project } = await setupProject()

    const file1 = await prisma.asset.create({
      data: {
        name: 'file1.mp4',
        type: AssetType.file,
        status: 'processed',
        projectId: project.id,
        parentId: project.rootFolder!,
      },
    })
    const file2 = await prisma.asset.create({
      data: {
        name: 'file2.mp4',
        type: AssetType.file,
        status: 'processed',
        projectId: project.id,
        parentId: project.rootFolder!,
      },
    })

    await assetService.recordRecentView(user1.id, project.id, file1.id)
    await assetService.recordRecentView(user1.id, project.id, file2.id)

    const list = await assetService.listRecents(user1.id, project.id, {})
    expect(list.data.length).toBe(2)
    expect(list.data[0].id).toBe(file2.id)
    expect(list.data[1].id).toBe(file1.id)
    expect(list.pageInfo.total).toBe(2)
  })

  it('updates viewedAt when viewing the same file again', async () => {
    const { user1, project } = await setupProject()

    const file1 = await prisma.asset.create({
      data: {
        name: 'file1.mp4',
        type: AssetType.file,
        status: 'processed',
        projectId: project.id,
        parentId: project.rootFolder!,
      },
    })
    const file2 = await prisma.asset.create({
      data: {
        name: 'file2.mp4',
        type: AssetType.file,
        status: 'processed',
        projectId: project.id,
        parentId: project.rootFolder!,
      },
    })

    await assetService.recordRecentView(user1.id, project.id, file1.id)
    await assetService.recordRecentView(user1.id, project.id, file2.id)
    // View file1 again
    await assetService.recordRecentView(user1.id, project.id, file1.id)

    const list = await assetService.listRecents(user1.id, project.id, {})
    expect(list.data.length).toBe(2)
    expect(list.data[0].id).toBe(file1.id)
    expect(list.data[1].id).toBe(file2.id)
  })

  it('records version stack when viewing a child version file', async () => {
    const { user1, project } = await setupProject()

    const stack = await prisma.asset.create({
      data: {
        name: 'version_stack',
        type: AssetType.version_stack,
        status: 'processed',
        projectId: project.id,
        parentId: project.rootFolder!,
      },
    })

    const version1 = await prisma.asset.create({
      data: {
        name: 'v1.mp4',
        type: AssetType.file,
        status: 'processed',
        projectId: project.id,
        parentId: stack.id,
      },
    })

    await assetService.recordRecentView(user1.id, project.id, version1.id)

    const list = await assetService.listRecents(user1.id, project.id, {})
    expect(list.data.length).toBe(1)
    expect(list.data[0].id).toBe(stack.id)
    expect(list.data[0].type).toBe(AssetType.version_stack)
  })

  it('isolates recents per user', async () => {
    const { user1, user2, project } = await setupProject()

    const file1 = await prisma.asset.create({
      data: {
        name: 'file1.mp4',
        type: AssetType.file,
        status: 'processed',
        projectId: project.id,
        parentId: project.rootFolder!,
      },
    })

    await assetService.recordRecentView(user1.id, project.id, file1.id)

    const user1List = await assetService.listRecents(user1.id, project.id, {})
    const user2List = await assetService.listRecents(user2.id, project.id, {})

    expect(user1List.data.length).toBe(1)
    expect(user2List.data.length).toBe(0)
  })

  it('does not record assets from another project', async () => {
    const { user1, team, project } = await setupProject()
    const otherProject = await projectService.createProject(user1, {
      name: 'Other Project',
      teamId: team.id,
    })
    const foreignFile = await prisma.asset.create({
      data: {
        name: 'foreign-file.mp4',
        type: AssetType.file,
        status: AssetStatus.processed,
        projectId: otherProject.id,
        parentId: otherProject.rootFolder!,
      },
    })

    await assetService.recordRecentView(user1.id, project.id, foreignFile.id)

    const list = await assetService.listRecents(user1.id, project.id, {})
    expect(list.data).toHaveLength(0)
  })

  it('does not record non-file assets', async () => {
    const { user1, project } = await setupProject()
    const folder = await prisma.asset.create({
      data: {
        name: 'folder',
        type: AssetType.folder,
        status: AssetStatus.processed,
        projectId: project.id,
        parentId: project.rootFolder!,
      },
    })

    await assetService.recordRecentView(user1.id, project.id, folder.id)

    const list = await assetService.listRecents(user1.id, project.id, {})
    expect(list.data).toHaveLength(0)
  })

  it('does not return soft-deleted files in recents', async () => {
    const { user1, project } = await setupProject()

    const file1 = await prisma.asset.create({
      data: {
        name: 'file1.mp4',
        type: AssetType.file,
        status: 'processed',
        projectId: project.id,
        parentId: project.rootFolder!,
      },
    })

    await assetService.recordRecentView(user1.id, project.id, file1.id)

    // Soft delete file1
    await prisma.asset.update({
      where: { id: file1.id },
      data: { isDeleted: true, status: 'trashed' },
    })

    const list = await assetService.listRecents(user1.id, project.id, {})
    expect(list.data.length).toBe(0)
  })

  it('caps recents at 100 items per user/project', async () => {
    const { user1, project } = await setupProject()

    // Batch create 105 assets
    const assetsData = Array.from({ length: 105 }, (_, i) => ({
      name: `file_${i}.mp4`,
      type: AssetType.file,
      status: AssetStatus.processed,
      projectId: project.id,
      parentId: project.rootFolder!,
    }))
    await prisma.asset.createMany({ data: assetsData })
    const allAssets = await prisma.asset.findMany({
      where: { projectId: project.id, parentId: project.rootFolder! },
      orderBy: { id: 'asc' },
    })

    // Seed 100 items in recentFileItem
    const baseDate = new Date('2026-01-01T00:00:00Z')
    await prisma.recentFileItem.createMany({
      data: allAssets.slice(0, 100).map((a, i) => ({
        userId: user1.id,
        projectId: project.id,
        assetId: a.id,
        viewedAt: new Date(baseDate.getTime() + i * 1000),
      })),
    })

    // Now record view for the 101st asset to trigger pruning
    const newAsset = allAssets[100]
    await assetService.recordRecentView(user1.id, project.id, newAsset.id)

    const count = await prisma.recentFileItem.count({
      where: { userId: user1.id, projectId: project.id },
    })
    expect(count).toBe(100)

    const list = await assetService.listRecents(user1.id, project.id, { first: 100 })
    expect(list.data.length).toBe(100)
    // The most recently viewed file should be newAsset
    expect(list.data[0].id).toBe(newAsset.id)
    // The oldest file (allAssets[0]) should have been pruned
    expect(list.data.some((d) => d.id === allAssets[0].id)).toBe(false)
  }, 15000)
})
