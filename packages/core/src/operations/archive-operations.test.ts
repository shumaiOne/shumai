import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { AssetStatus, prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { AuditAction } from '@shumai/dtos'
import { projectService } from '@shumai/core/src/project/project'
import { assetService } from '@shumai/core/src/asset/asset'
import { resetArchiveStorageServiceForTests } from '@shumai/core/src/s3/archive-storage'
import {
  archiveAssetsOp,
  restoreArchivedAssetsOp,
  runOperation,
  type OperationContext,
} from './index'

describe('archive_assets and restore_archived_assets Operations', () => {
  setupTestDbHooks()

  const archiveRoot = path.join(process.cwd(), 'data-test-ops-archive')
  let originalEnv: NodeJS.ProcessEnv
  let owner: User
  let editor: User
  let reviewer: User
  let outsider: User
  let teamId: string
  let projectId: string
  let rootFolderId: string

  const as = (user: User, via: OperationContext['via'] = 'cli'): OperationContext => ({
    userId: user.id,
    via,
  })

  beforeEach(async () => {
    originalEnv = { ...process.env }
    process.env.ARCHIVE_STORAGE_BACKEND = 'local'
    process.env.ARCHIVE_LOCAL_ROOT = archiveRoot
    resetArchiveStorageServiceForTests()

    owner = await prisma.user.create({
      data: { name: 'Owner', email: 'arch-ops-owner@test.com', password: 'pw' },
    })
    editor = await prisma.user.create({
      data: { name: 'Editor', email: 'arch-ops-editor@test.com', password: 'pw' },
    })
    reviewer = await prisma.user.create({
      data: { name: 'Reviewer', email: 'arch-ops-reviewer@test.com', password: 'pw' },
    })
    outsider = await prisma.user.create({
      data: { name: 'Outsider', email: 'arch-ops-outsider@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'Arch Ops Team' } })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, userId: owner.id, role: 'owner' } })
    await prisma.teamMember.create({ data: { teamId, userId: editor.id, role: 'editor' } })
    await prisma.teamMember.create({ data: { teamId, userId: reviewer.id, role: 'reviewer' } })

    const project = await projectService.createProject(owner, { teamId, name: 'Arch Ops Project' })
    projectId = project.id
    rootFolderId = project.rootFolder!
  })

  afterEach(() => {
    process.env = originalEnv
    resetArchiveStorageServiceForTests()
    if (fs.existsSync(archiveRoot)) {
      fs.rmSync(archiveRoot, { recursive: true, force: true })
    }
  })

  it('allows editor and owner to archive and restore assets and records audit entries', async () => {
    const file = await assetService.createAsset({
      name: 'take1.mov',
      type: 'file',
      parentId: rootFolderId,
      projectId,
      key: 'files/01OP/take1.mov',
      sizeByte: 4096,
      contentType: 'video/quicktime',
      creatorId: owner.id,
    })
    await prisma.asset.update({
      where: { id: file.id },
      data: { status: AssetStatus.processed },
    })

    const archiveOut = await runOperation(archiveAssetsOp, as(editor, 'api'), {
      assetIds: [file.id],
    })
    expect(archiveOut.archivedAssetIds).toEqual([file.id])
    expect(archiveOut.taskIds).toHaveLength(1)
    expect(archiveOut.skippedCount).toBe(0)

    const archiveAudit = await prisma.auditLog.findMany({
      where: { action: AuditAction.asset_archive },
    })
    expect(archiveAudit).toHaveLength(1)
    expect(archiveAudit[0]).toMatchObject({
      teamId,
      projectId,
      userId: editor.id,
      itemId: file.id,
      via: 'api',
    })

    // Transition to archived state to test restore_archived_assets
    await prisma.storageKey.update({
      where: { key: 'files/01OP/take1.mov' },
      data: { isArchived: true },
    })
    await prisma.asset.update({
      where: { id: file.id },
      data: { status: AssetStatus.archived },
    })

    const restoreOut = await runOperation(restoreArchivedAssetsOp, as(owner, 'mcp'), {
      assetIds: [file.id],
    })
    expect(restoreOut.restoredAssetIds).toEqual([file.id])
    expect(restoreOut.taskIds).toHaveLength(1)

    const restoreAudit = await prisma.auditLog.findMany({
      where: { action: AuditAction.asset_restore_archive },
    })
    expect(restoreAudit).toHaveLength(1)
    expect(restoreAudit[0]).toMatchObject({
      teamId,
      projectId,
      userId: owner.id,
      itemId: file.id,
      via: 'mcp',
    })
  })

  it('denies reviewer and outsider with 403 and causes no side effects or audit entries', async () => {
    const file = await assetService.createAsset({
      name: 'protected.mov',
      type: 'file',
      parentId: rootFolderId,
      projectId,
      key: 'files/01PROT/protected.mov',
      sizeByte: 2048,
      contentType: 'video/quicktime',
      creatorId: owner.id,
    })
    await prisma.asset.update({
      where: { id: file.id },
      data: { status: AssetStatus.processed },
    })

    for (const user of [reviewer, outsider]) {
      await expect(
        runOperation(archiveAssetsOp, as(user), { assetIds: [file.id] }),
      ).rejects.toMatchObject({ status: 403 })
    }

    const row = await prisma.asset.findUniqueOrThrow({ where: { id: file.id } })
    expect(row.status).toBe(AssetStatus.processed)
    expect(await prisma.auditLog.count({ where: { action: AuditAction.asset_archive } })).toBe(0)

    await prisma.storageKey.update({
      where: { key: 'files/01PROT/protected.mov' },
      data: { isArchived: true },
    })
    await prisma.asset.update({
      where: { id: file.id },
      data: { status: AssetStatus.archived },
    })

    for (const user of [reviewer, outsider]) {
      await expect(
        runOperation(restoreArchivedAssetsOp, as(user), { assetIds: [file.id] }),
      ).rejects.toMatchObject({ status: 403 })
    }

    const archivedRow = await prisma.asset.findUniqueOrThrow({ where: { id: file.id } })
    expect(archivedRow.status).toBe(AssetStatus.archived)
    expect(
      await prisma.auditLog.count({ where: { action: AuditAction.asset_restore_archive } }),
    ).toBe(0)
  })

  it('rejects symlinks directly with 400 and causes no side effects', async () => {
    const file = await assetService.createAsset({
      name: 'real.mov',
      type: 'file',
      parentId: rootFolderId,
      projectId,
      key: 'files/01REAL/real.mov',
      sizeByte: 2048,
      contentType: 'video/quicktime',
      creatorId: owner.id,
    })
    await prisma.asset.update({
      where: { id: file.id },
      data: { status: AssetStatus.processed },
    })

    const symlink = await prisma.asset.create({
      data: {
        name: 'symlink.mov',
        type: 'symlink',
        parentId: rootFolderId,
        projectId,
        targetId: file.id,
        status: AssetStatus.processed,
        creatorId: owner.id,
      },
    })

    await expect(
      runOperation(archiveAssetsOp, as(owner), { assetIds: [symlink.id] }),
    ).rejects.toMatchObject({ status: 400, message: 'Symlinks cannot be archived or restored' })

    const unchangedFile = await prisma.asset.findUniqueOrThrow({ where: { id: file.id } })
    expect(unchangedFile.status).toBe(AssetStatus.processed)
    expect(await prisma.auditLog.count({ where: { action: AuditAction.asset_archive } })).toBe(0)

    await expect(
      runOperation(restoreArchivedAssetsOp, as(owner), { assetIds: [symlink.id] }),
    ).rejects.toMatchObject({ status: 400, message: 'Symlinks cannot be archived or restored' })
  })
})
