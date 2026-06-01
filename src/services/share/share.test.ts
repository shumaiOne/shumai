import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db'
import { shareService } from './share'
import { assetService } from '@/services/asset/asset'
import { projectService } from '@/services/project/project'
import { AssetType } from '@/generated/prisma/client'

describe('ShareService', () => {
  setupTestDbHooks()

  let teamId: string
  let projectId: string
  let userId: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: `test-${Date.now()}@example.com` },
    })
    userId = user.id

    const team = await prisma.team.create({ data: { name: 'Test Team' } })
    teamId = team.id

    await prisma.teamMember.create({
      data: { teamId, userId, role: 'owner' },
    })

    const project = await projectService.createProject(
      { id: userId },
      {
        name: 'Test Project',
        teamId,
      },
    )
    projectId = project.id
  })

  it('creates a share link and its root folder', async () => {
    const shareLink = await shareService.createShareLink(projectId, {
      name: 'Public Share',
    })

    expect(shareLink.name).toBe('Public Share')
    expect(shareLink.rootFolderId).toBeDefined()

    const asset = await prisma.asset.findUnique({
      where: { id: shareLink.rootFolderId },
    })
    expect(asset?.type).toBe(AssetType.share)
    expect(asset?.projectId).toBe(projectId)
  })

  it('adds multiple assets to share and handles duplicates', async () => {
    // Create real assets
    const file1 = await prisma.asset.create({
      data: {
        name: 'file1.txt',
        type: AssetType.file,
        status: 'processed',
        projectId,
      },
    })
    const file2 = await prisma.asset.create({
      data: {
        name: 'file2.txt',
        type: AssetType.file,
        status: 'processed',
        projectId,
      },
    })

    const shareLink = await shareService.createShareLink(projectId, {
      name: 'Batch Share',
    })

    // Add first asset
    const count1 = await shareService.addAssetToShare(shareLink.id, {
      assetIds: [file1.id],
    })
    expect(count1).toBe(1)

    // Add both assets (one is duplicate)
    const count2 = await shareService.addAssetToShare(shareLink.id, {
      assetIds: [file1.id, file2.id],
    })
    expect(count2).toBe(1) // Only file2 added

    // Add both again (all duplicates)
    const count3 = await shareService.addAssetToShare(shareLink.id, {
      assetIds: [file1.id, file2.id],
    })
    expect(count3).toBe(0)

    // List children of the share root folder
    const children = await assetService.listChildren({
      assetId: shareLink.rootFolderId,
      assetType: 'file',
    })

    expect(children.data).toHaveLength(2)
  })

  it('verifies public access correctly', async () => {
    const file = await prisma.asset.create({
      data: {
        name: 'data.png',
        type: AssetType.file,
        status: 'processed',
        projectId,
      },
    })

    const shareLink = await shareService.createShareLink(projectId, {
      name: 'Protected Share',
      password: 'secret-password',
    })

    await shareService.addAssetToShare(shareLink.id, {
      assetIds: [file.id],
    })

    const symlink = await prisma.asset.findFirst({
      where: { targetId: file.id, parentId: shareLink.rootFolderId },
    })
    expect(symlink).toBeDefined()

    // Test password check
    await expect(shareService.verifyPublicAccess(symlink!.id, 'wrong')).rejects.toThrow(
      'Invalid password',
    )
    await expect(
      shareService.verifyPublicAccess(symlink!.id, 'secret-password'),
    ).resolves.toBeDefined()

    // Test expiration
    await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { expireAt: new Date(Date.now() - 1000) },
    })
    await expect(shareService.verifyPublicAccess(symlink!.id, 'secret-password')).rejects.toThrow(
      'expired',
    )
  })

  it('traces deep ancestors for public access', async () => {
    const shareLink = await shareService.createShareLink(projectId, {
      name: 'Deep Share',
    })

    const subfolder = await prisma.asset.create({
      data: {
        name: 'subfolder',
        type: AssetType.folder,
        status: 'processed',
        projectId,
        parentId: shareLink.rootFolderId,
      },
    })

    const deepFile = await prisma.asset.create({
      data: {
        name: 'deep.txt',
        type: AssetType.file,
        status: 'processed',
        projectId,
        parentId: subfolder.id,
      },
    })

    await expect(shareService.verifyPublicAccess(deepFile.id)).resolves.toBeDefined()
  })

  it('verifies public access via symlink to a folder', async () => {
    // 1. Create a real folder with a file
    const realFolder = await prisma.asset.create({
      data: {
        name: 'Real Folder',
        type: AssetType.folder,
        status: 'processed',
        projectId,
      },
    })
    const realFile = await prisma.asset.create({
      data: {
        name: 'Real File',
        type: AssetType.file,
        status: 'processed',
        projectId,
        parentId: realFolder.id,
      },
    })

    // 2. Share the folder via symlink
    const shareLink = await shareService.createShareLink(projectId, { name: 'Folder Share' })
    await shareService.addAssetToShare(shareLink.id, { assetIds: [realFolder.id] })

    // 3. Verify access to the file inside the real folder (which is reached via the symlinked folder)
    await expect(shareService.verifyPublicAccess(realFile.id)).resolves.toBeDefined()
  })

  it('fails public access for non-shared assets', async () => {
    const privateFile = await prisma.asset.create({
      data: {
        name: 'private.txt',
        type: AssetType.file,
        status: 'processed',
        projectId,
      },
    })
    await expect(shareService.verifyPublicAccess(privateFile.id)).rejects.toThrow(
      'Asset is not shared',
    )
  })

  it('updates a share link including fieldVisibility', async () => {
    const shareLink = await shareService.createShareLink(projectId, { name: 'Old Name' })
    const updated = await shareService.updateShareLink(shareLink.id, {
      name: 'New Name',
      password: 'new-password',
      fieldVisibility: { field1: true, field2: false },
    })

    expect(updated.name).toBe('New Name')
    expect(updated.hasPassword).toBe(true)
    expect(updated.fieldVisibility).toEqual({ field1: true, field2: false })

    const rootAsset = await prisma.asset.findUnique({ where: { id: shareLink.rootFolderId } })
    expect(rootAsset?.name).toBe('New Name')
  })

  it('deletes a share link', async () => {
    const shareLink = await shareService.createShareLink(projectId, { name: 'To Delete' })
    await shareService.deleteShareLink(shareLink.id)

    const link = await prisma.shareLink.findUnique({ where: { id: shareLink.id } })
    expect(link).toBeNull()

    const asset = await prisma.asset.findUnique({ where: { id: shareLink.rootFolderId } })
    expect(asset).toBeNull()
  })

  it('lists share links for a project', async () => {
    await shareService.createShareLink(projectId, { name: 'Share 1' })
    await shareService.createShareLink(projectId, { name: 'Share 2' })

    const list = await shareService.listProjectShareLinks({ projectId })
    expect(list.data).toHaveLength(2)
  })

  it('gets a single share link', async () => {
    const shareLink = await shareService.createShareLink(projectId, { name: 'Target' })
    const fetched = await shareService.getShareLink(shareLink.id)
    expect(fetched.name).toBe('Target')
  })

  it('removes an asset from share', async () => {
    const file = await prisma.asset.create({
      data: { name: 'f', type: AssetType.file, status: 'processed', projectId },
    })
    const shareLink = await shareService.createShareLink(projectId, { name: 'S' })
    await shareService.addAssetToShare(shareLink.id, { assetIds: [file.id] })

    const symlink = await prisma.asset.findFirst({ where: { targetId: file.id } })
    expect(symlink).toBeDefined()

    await shareService.removeAssetFromShare(shareLink.id, symlink!.id)
    const symlinkAfter = await prisma.asset.findUnique({ where: { id: symlink!.id } })
    expect(symlinkAfter).toBeNull()
  })
})
