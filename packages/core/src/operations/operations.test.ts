import { beforeEach, describe, expect, it } from 'vitest'
import { prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { AuditAction } from '@shumai/dtos'
import { projectService } from '@shumai/core/src/project/project'
import { assetService } from '@shumai/core/src/asset/asset'
import {
  createFolderOp,
  deleteAssetOp,
  listAssetsOp,
  listProjectsOp,
  moveAssetsOp,
  renameAssetOp,
} from './index'
import { runOperation } from './run'
import type { OperationContext } from './context'

describe('asset and project Operations', () => {
  setupTestDbHooks()

  let owner: User
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
    owner = await prisma.user.create({
      data: { name: 'Owner', email: 'ops-owner@test.com', password: 'pw' },
    })
    reviewer = await prisma.user.create({
      data: { name: 'Reviewer', email: 'ops-reviewer@test.com', password: 'pw' },
    })
    outsider = await prisma.user.create({
      data: { name: 'Outsider', email: 'ops-outsider@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'Ops Team' } })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, userId: owner.id, role: 'owner' } })
    await prisma.teamMember.create({ data: { teamId, userId: reviewer.id, role: 'reviewer' } })

    const project = await projectService.createProject(owner, { teamId, name: 'Ops Project' })
    projectId = project.id
    rootFolderId = project.rootFolder!
  })

  async function auditRows(action: AuditAction) {
    return prisma.auditLog.findMany({ where: { action }, orderBy: { id: 'asc' } })
  }

  describe('create_folder', () => {
    it('creates a folder attributed to the caller and audits it with via', async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'Renders',
      })

      expect(folder).toEqual({
        id: expect.any(String),
        name: 'Renders',
        type: 'folder',
        size: 0,
        projectId,
      })
      const row = await prisma.asset.findUniqueOrThrow({ where: { id: folder.id } })
      expect(row.parentId).toBe(rootFolderId)
      expect(row.creatorId).toBe(owner.id)

      const [audit] = await auditRows(AuditAction.folder_create)
      expect(audit).toMatchObject({
        teamId,
        projectId,
        userId: owner.id,
        itemId: folder.id,
        via: 'cli',
      })
    })

    it.each([
      ['reviewer', () => reviewer],
      ['non-member', () => outsider],
    ])('rejects a %s without creating anything', async (_label, user) => {
      await expect(
        runOperation(createFolderOp, as(user()), { parent: rootFolderId, name: 'Nope' }),
      ).rejects.toMatchObject({ status: 403 })

      expect(await prisma.asset.count({ where: { name: 'Nope' } })).toBe(0)
      expect(await auditRows(AuditAction.folder_create)).toHaveLength(0)
    })
  })

  describe('list_assets', () => {
    it('paginates with first/after and reports the total', async () => {
      for (const name of ['a', 'b', 'c']) {
        await runOperation(createFolderOp, as(owner), { parent: rootFolderId, name })
      }

      const page1 = await runOperation(listAssetsOp, as(reviewer), {
        parent: rootFolderId,
        first: 2,
      })
      expect(page1.data).toHaveLength(2)
      expect(page1.total).toBe(3)
      expect(page1.pageInfo.hasNextPage).toBe(true)
      expect(page1.pageInfo.endCursor).toEqual(expect.any(String))

      const page2 = await runOperation(listAssetsOp, as(reviewer), {
        parent: rootFolderId,
        first: 2,
        after: page1.pageInfo.endCursor!,
      })
      expect(page2.data).toHaveLength(1)
      expect(page2.pageInfo).toEqual({ hasNextPage: false, endCursor: null })

      const names = [...page1.data, ...page2.data].map((a) => a.name).sort()
      expect(names).toEqual(['a', 'b', 'c'])
    })

    it('filters by type', async () => {
      await runOperation(createFolderOp, as(owner), { parent: rootFolderId, name: 'only-folder' })

      const files = await runOperation(listAssetsOp, as(owner), {
        parent: rootFolderId,
        type: 'file',
      })
      expect(files.data).toEqual([])

      const folders = await runOperation(listAssetsOp, as(owner), {
        parent: rootFolderId,
        type: 'folder',
      })
      expect(folders.data.map((a) => a.name)).toEqual(['only-folder'])
    })

    it('rejects a non-member', async () => {
      await expect(
        runOperation(listAssetsOp, as(outsider), { parent: rootFolderId }),
      ).rejects.toMatchObject({ status: 403 })
    })

    it('rejects a page size above the maximum', async () => {
      await expect(
        runOperation(listAssetsOp, as(owner), { parent: rootFolderId, first: 500 }),
      ).rejects.toMatchObject({ status: 400 })
    })
  })

  describe('rename_asset', () => {
    it('renames and audits a folder update', async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'old',
      })

      const renamed = await runOperation(renameAssetOp, as(owner, 'api'), {
        assetId: folder.id,
        name: 'new',
      })

      expect(renamed).toMatchObject({ id: folder.id, name: 'new', type: 'folder' })
      const [audit] = await auditRows(AuditAction.folder_update)
      expect(audit).toMatchObject({ itemId: folder.id, teamId, projectId, via: 'api' })
    })

    it('rejects a reviewer and leaves the name unchanged', async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'keep',
      })

      await expect(
        runOperation(renameAssetOp, as(reviewer), { assetId: folder.id, name: 'changed' }),
      ).rejects.toMatchObject({ status: 403 })
      const row = await prisma.asset.findUniqueOrThrow({ where: { id: folder.id } })
      expect(row.name).toBe('keep')
    })
  })

  describe('move_assets', () => {
    it('moves assets and audits each one', async () => {
      const dest = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'dest',
      })
      const a = await runOperation(createFolderOp, as(owner), { parent: rootFolderId, name: 'a' })
      const b = await runOperation(createFolderOp, as(owner), { parent: rootFolderId, name: 'b' })

      const result = await runOperation(moveAssetsOp, as(owner, 'mcp'), {
        assetIds: [a.id, b.id],
        newParentId: dest.id,
      })

      expect(result).toEqual({ movedAssetIds: [a.id, b.id], newParentId: dest.id })
      const moved = await prisma.asset.findMany({ where: { id: { in: [a.id, b.id] } } })
      expect(moved.every((m) => m.parentId === dest.id)).toBe(true)

      const audits = await auditRows(AuditAction.asset_reparent)
      expect(audits.map((r) => r.itemId).sort()).toEqual([a.id, b.id].sort())
      expect(audits.every((r) => r.via === 'mcp' && r.projectId === projectId)).toBe(true)
    })

    it('requires at least one asset', async () => {
      await expect(
        runOperation(moveAssetsOp, as(owner), { assetIds: [], newParentId: rootFolderId }),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects a reviewer without moving anything', async () => {
      const dest = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'dest',
      })
      const a = await runOperation(createFolderOp, as(owner), { parent: rootFolderId, name: 'a' })

      await expect(
        runOperation(moveAssetsOp, as(reviewer), { assetIds: [a.id], newParentId: dest.id }),
      ).rejects.toMatchObject({ status: 403 })
      const row = await prisma.asset.findUniqueOrThrow({ where: { id: a.id } })
      expect(row.parentId).toBe(rootFolderId)
    })
  })

  describe('delete_asset', () => {
    it('trashes the asset and audits with the context captured before deletion', async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'trash-me',
      })

      const result = await runOperation(deleteAssetOp, as(owner, 'agent'), { assetId: folder.id })

      expect(result).toEqual({ deletedAssetId: folder.id })
      const row = await prisma.asset.findUniqueOrThrow({ where: { id: folder.id } })
      expect(row.isDeleted).toBe(true)
      const [audit] = await auditRows(AuditAction.folder_delete)
      expect(audit).toMatchObject({ itemId: folder.id, teamId, projectId, via: 'agent' })
    })

    it('rejects a reviewer without deleting', async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'keep-me',
      })

      await expect(
        runOperation(deleteAssetOp, as(reviewer), { assetId: folder.id }),
      ).rejects.toMatchObject({ status: 403 })
      const row = await prisma.asset.findUniqueOrThrow({ where: { id: folder.id } })
      expect(row.isDeleted).toBe(false)
    })

    it('returns 404 for an unknown asset', async () => {
      await expect(
        runOperation(deleteAssetOp, as(owner), { assetId: 'missing' }),
      ).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('list_projects', () => {
    it("lists the caller's projects with their root folder", async () => {
      const result = await runOperation(listProjectsOp, as(reviewer), {})
      expect(result.data).toEqual([{ id: projectId, name: 'Ops Project', teamId, rootFolderId }])
    })

    it('returns nothing for a user outside every team', async () => {
      const result = await runOperation(listProjectsOp, as(outsider), {})
      expect(result.data).toEqual([])
    })
  })

  describe('assetService.getAssetMeta', () => {
    it('returns type and team context without building AssetInfo', async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'meta',
      })

      await expect(assetService.getAssetMeta(folder.id)).resolves.toEqual({
        id: folder.id,
        name: 'meta',
        type: 'folder',
        teamId,
        projectId,
      })
    })

    it('throws a 404 for an unknown asset', async () => {
      await expect(assetService.getAssetMeta('missing')).rejects.toMatchObject({ status: 404 })
    })
  })
})
