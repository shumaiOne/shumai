import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { shareService } from './share'
import { assetService } from '@shumai/core/src/asset/asset'
import { projectService } from '@shumai/core/src/project/project'
import { AssetType } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    presign: vi.fn(),
  },
}))

describe('ShareService', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.mocked(s3Service.presign).mockResolvedValue('http://s3/mock-avatar')
  })

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
    expect(shareLink.allowDownload).toBe(true)
    expect(shareLink.rootFolderId).toBeDefined()

    const asset = await prisma.asset.findUnique({
      where: { id: shareLink.rootFolderId },
    })
    expect(asset?.type).toBe(AssetType.share)
    expect(asset?.projectId).toBe(projectId)
  })

  it('creates a share link with allowDownload disabled', async () => {
    const shareLink = await shareService.createShareLink(projectId, {
      name: 'No Download Share',
      allowDownload: false,
    })

    expect(shareLink.allowDownload).toBe(false)

    const fetched = await shareService.getShareLink(shareLink.id)
    expect(fetched.allowDownload).toBe(false)
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

  it('updates a share link including fieldVisibility, viewMode, and defaultSortOrder', async () => {
    const shareLink = await shareService.createShareLink(projectId, { name: 'Old Name' })
    const updated = await shareService.updateShareLink(shareLink.id, {
      name: 'New Name',
      password: 'new-password',
      fieldVisibility: { field1: true, field2: false },
      viewMode: 'list',
      defaultSortOrder: 'name:desc',
    })

    expect(updated.name).toBe('New Name')
    expect(updated.hasPassword).toBe(true)
    expect(updated.fieldVisibility).toEqual({ field1: true, field2: false })
    expect(updated.viewMode).toBe('list')
    expect(updated.defaultSortOrder).toBe('name:desc')

    const rootAsset = await prisma.asset.findUnique({ where: { id: shareLink.rootFolderId } })
    expect(rootAsset?.name).toBe('New Name')
  })

  it('updates allowDownload on a share link', async () => {
    const shareLink = await shareService.createShareLink(projectId, { name: 'Toggle Share' })
    expect(shareLink.allowDownload).toBe(true)

    const disabled = await shareService.updateShareLink(shareLink.id, { allowDownload: false })
    expect(disabled.allowDownload).toBe(false)

    const reEnabled = await shareService.updateShareLink(shareLink.id, { allowDownload: true })
    expect(reEnabled.allowDownload).toBe(true)
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

  it('resolves the creator avatar image to a presigned URL', async () => {
    const userWithAvatar = await prisma.user.create({
      data: {
        name: 'User With Avatar',
        email: `avatar-test-${Date.now()}@example.com`,
        image: 'avatars/user123.png',
      },
    })

    vi.mocked(s3Service.presign).mockResolvedValue('http://s3/avatars/user123-presigned.png')

    const shareLink = await shareService.createShareLink(
      projectId,
      { name: 'Avatar Share' },
      userWithAvatar.id,
    )

    expect(shareLink.creator).toBeDefined()
    expect(shareLink.creator?.image).toBe('http://s3/avatars/user123-presigned.png')

    const fetched = await shareService.getShareLink(shareLink.id)
    expect(fetched.creator?.image).toBe('http://s3/avatars/user123-presigned.png')

    const list = await shareService.listProjectShareLinks({ projectId })
    const item = list.data.find((l) => l.id === shareLink.id)
    expect(item?.creator?.image).toBe('http://s3/avatars/user123-presigned.png')
  })

  it('hides soft-deleted files from share link and restores them upon file restoration', async () => {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const file = await prisma.asset.create({
      data: {
        name: 'shared-doc.pdf',
        type: AssetType.file,
        status: 'processed',
        projectId,
        parentId: project.rootFolderId,
      },
    })

    const shareLink = await shareService.createShareLink(projectId, {
      name: 'Doc Share',
    })

    await shareService.addAssetToShare(shareLink.id, {
      assetIds: [file.id],
    })

    // Verify initial state: 1 file in share link
    const initialChildren = await assetService.listChildren({
      assetId: shareLink.rootFolderId,
      assetType: 'file',
    })
    expect(initialChildren.data).toHaveLength(1)
    expect(initialChildren.data[0].name).toBe('shared-doc.pdf')

    const initialShareRoot = await prisma.asset.findUnique({
      where: { id: shareLink.rootFolderId },
    })
    expect(initialShareRoot?.fileCount).toBe(1)

    const symlink = await prisma.asset.findFirst({
      where: { targetId: file.id, parentId: shareLink.rootFolderId },
    })
    expect(symlink).toBeDefined()
    await expect(shareService.verifyPublicAccess(file.id)).resolves.toBeDefined()
    await expect(shareService.verifyPublicAccess(symlink!.id)).resolves.toBeDefined()

    // 1. Soft-delete the file (move to trash)
    await assetService.deleteAssets([file.id])

    // Verify: file should disappear from share link children
    const afterDeleteChildren = await assetService.listChildren({
      assetId: shareLink.rootFolderId,
      assetType: 'file',
    })
    expect(afterDeleteChildren.data).toHaveLength(0)

    // Verify: share root fileCount should be decremented to 0
    const afterDeleteShareRoot = await prisma.asset.findUnique({
      where: { id: shareLink.rootFolderId },
    })
    expect(afterDeleteShareRoot?.fileCount).toBe(0)

    // Verify: public access is rejected
    await expect(shareService.verifyPublicAccess(file.id)).rejects.toThrow()
    await expect(shareService.verifyPublicAccess(symlink!.id)).rejects.toThrow()

    // Verify: project's recently-deleted view does NOT list symlinks
    const recentlyDeleted = await assetService.listChildren({
      projectId,
      showDeleted: true,
      assetType: 'file',
    })
    expect(recentlyDeleted.data).toHaveLength(1)
    expect(recentlyDeleted.data[0].id).toBe(file.id)

    // 2. Restore the file from trash
    await assetService.restoreAssets([file.id])

    // Verify: file reappears in share link children
    const afterRestoreChildren = await assetService.listChildren({
      assetId: shareLink.rootFolderId,
      assetType: 'file',
    })
    expect(afterRestoreChildren.data).toHaveLength(1)
    expect(afterRestoreChildren.data[0].name).toBe('shared-doc.pdf')

    // Verify: share root fileCount is restored to 1
    const afterRestoreShareRoot = await prisma.asset.findUnique({
      where: { id: shareLink.rootFolderId },
    })
    expect(afterRestoreShareRoot?.fileCount).toBe(1)

    // Verify: public access works again
    await expect(shareService.verifyPublicAccess(file.id)).resolves.toBeDefined()
    await expect(shareService.verifyPublicAccess(symlink!.id)).resolves.toBeDefined()
  })

  it('hides soft-deleted folders from share link and restores them upon folder restoration', async () => {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const folder = await prisma.asset.create({
      data: {
        name: 'Shared Folder',
        type: AssetType.folder,
        status: 'processed',
        projectId,
        parentId: project.rootFolderId,
      },
    })
    const childFile = await prisma.asset.create({
      data: {
        name: 'inner-file.txt',
        type: AssetType.file,
        status: 'processed',
        projectId,
        parentId: folder.id,
      },
    })

    const shareLink = await shareService.createShareLink(projectId, {
      name: 'Folder Share',
    })

    await shareService.addAssetToShare(shareLink.id, {
      assetIds: [folder.id],
    })

    // Initial check: folder is in share link
    const initialChildren = await assetService.listChildren({
      assetId: shareLink.rootFolderId,
      assetType: 'folder',
    })
    expect(initialChildren.data).toHaveLength(1)
    expect(initialChildren.data[0].name).toBe('Shared Folder')
    await expect(shareService.verifyPublicAccess(childFile.id)).resolves.toBeDefined()

    // 1. Soft-delete the folder
    await assetService.deleteAssets([folder.id])

    // Verify: folder disappears from share link
    const afterDeleteChildren = await assetService.listChildren({
      assetId: shareLink.rootFolderId,
      assetType: 'folder',
    })
    expect(afterDeleteChildren.data).toHaveLength(0)

    // Verify: access to child file inside folder is rejected
    await expect(shareService.verifyPublicAccess(childFile.id)).rejects.toThrow()

    // 2. Restore the folder
    await assetService.restoreAssets([folder.id])

    // Verify: folder reappears in share link
    const afterRestoreChildren = await assetService.listChildren({
      assetId: shareLink.rootFolderId,
      assetType: 'folder',
    })
    expect(afterRestoreChildren.data).toHaveLength(1)
    expect(afterRestoreChildren.data[0].name).toBe('Shared Folder')

    // Verify: access to child file inside folder is restored
    await expect(shareService.verifyPublicAccess(childFile.id)).resolves.toBeDefined()
  })
})
