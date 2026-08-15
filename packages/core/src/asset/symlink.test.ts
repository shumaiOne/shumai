import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { AssetType } from '@shumai/db'
import { dedupeSymlinksToTarget } from './symlink'

async function setupShareFolder(projectId: string, fileCount: number) {
  const shareRoot = await prisma.asset.create({
    data: {
      name: 'share-root',
      type: AssetType.share_root,
      projectId,
      status: 'uploaded',
      fileCount,
    },
  })
  return shareRoot
}

describe('dedupeSymlinksToTarget', () => {
  setupTestDbHooks()

  async function setupProject() {
    const team = await prisma.team.create({ data: { name: 'Team ' + Date.now() } })
    const project = await prisma.project.create({
      data: { name: 'Project ' + Date.now(), teamId: team.id },
    })
    const root = await prisma.asset.create({
      data: {
        name: 'root',
        type: AssetType.folder,
        projectId: project.id,
        status: 'uploaded',
      },
    })
    const fileA = await prisma.asset.create({
      data: {
        name: 'a.txt',
        type: AssetType.file,
        parentId: root.id,
        projectId: project.id,
        status: 'uploaded',
        sizeByte: 10,
      },
    })
    const fileB = await prisma.asset.create({
      data: {
        name: 'b.txt',
        type: AssetType.file,
        parentId: root.id,
        projectId: project.id,
        status: 'uploaded',
        sizeByte: 20,
      },
    })
    return { project, root, fileA, fileB }
  }

  it('repoints one symlink per parent and deletes duplicates, decrementing fileCount once', async () => {
    const { project, root, fileA, fileB } = await setupProject()
    const shareRoot = await setupShareFolder(project.id, 2)

    const symA = await prisma.asset.create({
      data: {
        name: fileA.name,
        type: AssetType.symlink,
        parentId: shareRoot.id,
        targetId: fileA.id,
        projectId: project.id,
        status: 'uploaded',
      },
    })
    const symB = await prisma.asset.create({
      data: {
        name: fileB.name,
        type: AssetType.symlink,
        parentId: shareRoot.id,
        targetId: fileB.id,
        projectId: project.id,
        status: 'uploaded',
      },
    })

    const stack = await prisma.asset.create({
      data: {
        name: '',
        type: AssetType.version_stack,
        parentId: root.id,
        projectId: project.id,
        status: 'uploaded',
        fileCount: 2,
        sizeByte: 30,
      },
    })

    await prisma.$transaction((tx) =>
      dedupeSymlinksToTarget(tx, { targetIds: [fileA.id, fileB.id], newTargetId: stack.id }),
    )

    // First symlink repointed to the stack, second deleted
    const repointed = await prisma.asset.findUnique({ where: { id: symA.id } })
    expect(repointed?.targetId).toBe(stack.id)
    expect(await prisma.asset.findUnique({ where: { id: symB.id } })).toBeNull()

    // fileCount decremented exactly once (2 -> 1)
    const updatedShareRoot = await prisma.asset.findUnique({ where: { id: shareRoot.id } })
    expect(updatedShareRoot?.fileCount).toBe(1)
  })

  it('deletes a file symlink when the parent already shows the stack', async () => {
    const { project, root, fileA } = await setupProject()
    const shareRoot = await setupShareFolder(project.id, 2)

    const stack = await prisma.asset.create({
      data: {
        name: '',
        type: AssetType.version_stack,
        parentId: root.id,
        projectId: project.id,
        status: 'uploaded',
        fileCount: 1,
        sizeByte: 10,
      },
    })
    // Share already contains a symlink to the stack
    const stackSymlink = await prisma.asset.create({
      data: {
        name: '',
        type: AssetType.symlink,
        parentId: shareRoot.id,
        targetId: stack.id,
        projectId: project.id,
        status: 'uploaded',
      },
    })
    // And a symlink to the file being moved into the stack
    const fileSymlink = await prisma.asset.create({
      data: {
        name: fileA.name,
        type: AssetType.symlink,
        parentId: shareRoot.id,
        targetId: fileA.id,
        projectId: project.id,
        status: 'uploaded',
      },
    })

    await prisma.$transaction((tx) =>
      dedupeSymlinksToTarget(tx, { targetIds: [fileA.id], newTargetId: stack.id }),
    )

    // File symlink deleted, stack symlink untouched
    expect(await prisma.asset.findUnique({ where: { id: fileSymlink.id } })).toBeNull()
    const updatedStackSymlink = await prisma.asset.findUnique({ where: { id: stackSymlink.id } })
    expect(updatedStackSymlink?.targetId).toBe(stack.id)

    // fileCount decremented once (2 -> 1)
    const updatedShareRoot = await prisma.asset.findUnique({ where: { id: shareRoot.id } })
    expect(updatedShareRoot?.fileCount).toBe(1)
  })

  it('repoints symlinks in different share folders without changing fileCounts', async () => {
    const { project, root, fileA, fileB } = await setupProject()
    const share1 = await setupShareFolder(project.id, 1)
    const share2 = await setupShareFolder(project.id, 1)

    const sym1 = await prisma.asset.create({
      data: {
        name: fileA.name,
        type: AssetType.symlink,
        parentId: share1.id,
        targetId: fileA.id,
        projectId: project.id,
        status: 'uploaded',
      },
    })
    const sym2 = await prisma.asset.create({
      data: {
        name: fileB.name,
        type: AssetType.symlink,
        parentId: share2.id,
        targetId: fileB.id,
        projectId: project.id,
        status: 'uploaded',
      },
    })

    const stack = await prisma.asset.create({
      data: {
        name: '',
        type: AssetType.version_stack,
        parentId: root.id,
        projectId: project.id,
        status: 'uploaded',
        fileCount: 2,
        sizeByte: 30,
      },
    })

    await prisma.$transaction((tx) =>
      dedupeSymlinksToTarget(tx, { targetIds: [fileA.id, fileB.id], newTargetId: stack.id }),
    )

    expect((await prisma.asset.findUnique({ where: { id: sym1.id } }))?.targetId).toBe(stack.id)
    expect((await prisma.asset.findUnique({ where: { id: sym2.id } }))?.targetId).toBe(stack.id)
    expect((await prisma.asset.findUnique({ where: { id: share1.id } }))?.fileCount).toBe(1)
    expect((await prisma.asset.findUnique({ where: { id: share2.id } }))?.fileCount).toBe(1)
  })

  it('sets the provided name on repointed symlinks', async () => {
    const { project, root, fileA } = await setupProject()
    const shareRoot = await setupShareFolder(project.id, 1)

    const sym = await prisma.asset.create({
      data: {
        name: fileA.name,
        type: AssetType.symlink,
        parentId: shareRoot.id,
        targetId: fileA.id,
        projectId: project.id,
        status: 'uploaded',
      },
    })

    const stack = await prisma.asset.create({
      data: {
        name: '',
        type: AssetType.version_stack,
        parentId: root.id,
        projectId: project.id,
        status: 'uploaded',
        fileCount: 1,
        sizeByte: 10,
      },
    })

    await prisma.$transaction((tx) =>
      dedupeSymlinksToTarget(tx, {
        targetIds: [fileA.id],
        newTargetId: stack.id,
        name: '',
      }),
    )

    const updatedSym = await prisma.asset.findUnique({ where: { id: sym.id } })
    expect(updatedSym?.targetId).toBe(stack.id)
    expect(updatedSym?.name).toBe('')
  })
})
