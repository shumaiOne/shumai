import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { projectService } from '@shumai/core/src/project/project'
import { textEmbeddingService } from '@shumai/core/src/search/text-embedding'
import {
  copyAssetsOp,
  createCommentOp,
  createFolderOp,
  createVersionStackOp,
  getFolderInstructionsOp,
  listCommentsOp,
  listMetadataFieldsOp,
  listVersionsOp,
  removeVersionOp,
  resolveCommentOp,
  searchAssetsOp,
  updateAssetMetadataOp,
} from './index'
import { runOperation } from './run'
import type { OperationContext } from './context'

/**
 * Real-database tests for the search, copy, folder instruction, comment, metadata, and version
 * Operations: success, permission denial without side effects, and audit entries.
 */
describe('collaboration Operations', () => {
  setupTestDbHooks()

  let owner: User
  let reviewer: User
  let outsider: User
  let teamId: string
  let projectId: string
  let rootFolderId: string

  const as = (user: User, via: OperationContext['via'] = 'mcp', agentId?: string) => ({
    userId: user.id,
    via,
    agentId,
  })

  /** A file without a preview type, so creating it doesn't start transcoding. */
  async function createFile(name: string, parentId = rootFolderId) {
    const asset = await assetService.createFile({
      parentId,
      name,
      key: `files/test/${name}-${Math.random().toString(36).slice(2)}`,
      sizeByte: 10,
      contentType: 'application/octet-stream',
      creatorId: owner.id,
    })
    return asset.id
  }

  async function auditRows(action: AuditAction) {
    return prisma.auditLog.findMany({ where: { action, teamId }, orderBy: { id: 'asc' } })
  }

  beforeEach(async () => {
    owner = await prisma.user.create({
      data: { name: 'Owner', email: 'collab-owner@test.com', password: 'pw' },
    })
    reviewer = await prisma.user.create({
      data: { name: 'Reviewer', email: 'collab-reviewer@test.com', password: 'pw' },
    })
    outsider = await prisma.user.create({
      data: { name: 'Outsider', email: 'collab-outsider@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'Collab Team' } })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, userId: owner.id, role: 'owner' } })
    await prisma.teamMember.create({ data: { teamId, userId: reviewer.id, role: 'reviewer' } })
    const project = await projectService.createProject(owner, { teamId, name: 'Collab Project' })
    projectId = project.id
    rootFolderId = project.rootFolder!
  })

  describe('search_assets', () => {
    it('finds files by name in subfolders and pages through results', async () => {
      const sub = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'shots',
      })
      await createFile('sunset-a.bin', sub.id)
      await createFile('sunset-b.bin', rootFolderId)
      await createFile('night.bin', rootFolderId)

      const page1 = await runOperation(searchAssetsOp, as(reviewer), {
        parent: rootFolderId,
        query: 'sunset',
        first: 1,
      })
      expect(page1.total).toBe(2)
      expect(page1.data).toHaveLength(1)
      expect(page1.pageInfo.hasNextPage).toBe(true)

      const page2 = await runOperation(searchAssetsOp, as(reviewer), {
        parent: rootFolderId,
        query: 'sunset',
        first: 1,
        after: page1.pageInfo.endCursor!,
      })
      const names = [...page1.data, ...page2.data].map((a) => a.name).sort()
      expect(names).toEqual(['sunset-a.bin', 'sunset-b.bin'])
    })

    it('searches only the folder itself when recursive is false', async () => {
      const sub = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'shots',
      })
      await createFile('sunset-a.bin', sub.id)

      const result = await runOperation(searchAssetsOp, as(owner), {
        parent: rootFolderId,
        query: 'sunset',
        recursive: false,
      })
      expect(result.data).toEqual([])
    })

    it('filters by metadata conditions', async () => {
      const field = await metadataService.createProjectField(projectId, {
        config: { name: 'Approved', type: 'toggle' },
        description: '',
      })
      const approved = await createFile('approved.bin')
      await createFile('pending.bin')
      await metadataService.updateAssetMetadata(approved, [{ key: field.key, value: true }])

      const result = await runOperation(searchAssetsOp, as(owner), {
        parent: rootFolderId,
        conditions: [{ field: field.key, operator: 'eq', value: true }],
      })
      expect(result.data.map((a) => a.id)).toEqual([approved])
    })

    it('reports an unsupported operator for a field as a bad request', async () => {
      await expect(
        runOperation(searchAssetsOp, as(owner), {
          parent: rootFolderId,
          conditions: [{ field: 'name', operator: 'gt', value: 'a' }],
        }),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('returns similarity score when semantic is true', async () => {
      const botUser = await prisma.user.create({
        data: { name: 'Emb Bot', email: 'emb-bot@example.com', type: 'agent' },
      })
      const provider = await prisma.provider.create({
        data: {
          name: 'google',
          teamId,
          config: { api: 'google', apiKey: 'key' } as unknown as PrismaJson.ProviderConfig,
        },
      })
      const model = await prisma.model.create({
        data: {
          modelId: 'gemini',
          name: 'Gemini',
          providerId: provider.id,
          config: {
            reasoning: false,
            input: ['text'],
            contextWindow: 1000,
            maxTokens: 1000,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          } as unknown as PrismaJson.ModelConfig,
        },
      })
      await prisma.agent.create({
        data: {
          id: botUser.id,
          teamId,
          type: 'embedding',
          enabled: true,
          providerId: provider.id,
          modelId: model.id,
          config: { provider: 'google', model: 'gemini' },
        },
      })

      const file = await createFile('cat.bin')
      const vector = Array(768).fill(0)
      vector[0] = 1.0
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding_768, created_at, updated_at)
        VALUES ('emb-chunk-1', ${file}, ${JSON.stringify(vector)}::vector, NOW(), NOW())
      `

      const spy = vi.spyOn(textEmbeddingService, 'generateEmbedding').mockResolvedValue({
        embedding: vector,
      })

      try {
        const result = await runOperation(searchAssetsOp, as(owner), {
          parent: rootFolderId,
          query: 'cat',
          semantic: true,
        })
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(file)
        expect(result.data[0].similarity).toBeCloseTo(1.0, 4)
      } finally {
        spy.mockRestore()
      }
    })

    it('rejects a non-member', async () => {
      await expect(
        runOperation(searchAssetsOp, as(outsider), { parent: rootFolderId, query: 'x' }),
      ).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('copy_assets', () => {
    it('copies assets, returns the copies in order, and audits each source', async () => {
      const dest = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'dest',
      })
      const a = await createFile('a.bin')
      const b = await createFile('b.bin')

      const result = await runOperation(copyAssetsOp, as(owner), {
        assetIds: [a, b],
        newParentId: dest.id,
      })

      expect(result.newParentId).toBe(dest.id)
      expect(result.copiedAssetIds).toHaveLength(2)
      const copies = await prisma.asset.findMany({
        where: { id: { in: result.copiedAssetIds } },
      })
      const byId = new Map(copies.map((c) => [c.id, c]))
      expect(result.copiedAssetIds.map((id) => byId.get(id)?.name)).toEqual(['a.bin', 'b.bin'])
      expect(copies.every((c) => c.parentId === dest.id && c.creatorId === owner.id)).toBe(true)

      const audits = await auditRows(AuditAction.asset_copy)
      expect(audits.map((r) => r.itemId).sort()).toEqual([a, b].sort())
      expect(audits.every((r) => r.teamId === teamId && r.projectId === projectId)).toBe(true)
      expect(audits.every((r) => r.via === 'mcp')).toBe(true)
    })

    it('rejects a reviewer without copying', async () => {
      const a = await createFile('a.bin')

      await expect(
        runOperation(copyAssetsOp, as(reviewer), { assetIds: [a], newParentId: rootFolderId }),
      ).rejects.toMatchObject({ status: 403 })
      expect(await prisma.asset.count({ where: { name: 'a.bin', projectId } })).toBe(1)
      expect(await auditRows(AuditAction.asset_copy)).toHaveLength(0)
    })

    it('reports copying a folder into itself as a bad request', async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'loop',
      })
      await expect(
        runOperation(copyAssetsOp, as(owner), { assetIds: [folder.id], newParentId: folder.id }),
      ).rejects.toMatchObject({ status: 400 })
    })
  })

  describe('get_folder_instructions', () => {
    it("returns the folder's AGENTS.md, or null", async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'deliverables',
      })
      await expect(
        runOperation(getFolderInstructionsOp, as(reviewer), { folderId: folder.id }),
      ).resolves.toEqual({ folderId: folder.id, content: null })

      await assetService.updateAgentsMd(folder.id, '# Name files <shot>_v<n>')
      await expect(
        runOperation(getFolderInstructionsOp, as(reviewer), { folderId: folder.id }),
      ).resolves.toEqual({ folderId: folder.id, content: '# Name files <shot>_v<n>' })
    })

    it('rejects a file as a bad request and a non-member as forbidden', async () => {
      const file = await createFile('a.bin')
      await expect(
        runOperation(getFolderInstructionsOp, as(owner), { folderId: file }),
      ).rejects.toMatchObject({ status: 400 })
      await expect(
        runOperation(getFolderInstructionsOp, as(outsider), { folderId: rootFolderId }),
      ).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('comments', () => {
    it('lets a reviewer comment, reply, list, and resolve, with audit entries', async () => {
      const file = await createFile('cut.bin')

      const comment = await runOperation(createCommentOp, as(reviewer), {
        assetId: file,
        message: 'Too dark at the start',
        second: 2.5,
      })
      expect(comment).toEqual({ id: expect.any(String), assetId: file, replyToId: null })

      const reply = await runOperation(createCommentOp, as(owner, 'agent', undefined), {
        assetId: file,
        message: 'Brightened in v2',
        replyToId: comment.id,
      })
      expect(reply.replyToId).toBe(comment.id)

      const listed = await runOperation(listCommentsOp, as(reviewer), { assetId: file })
      expect(listed.total).toBe(1)
      expect(listed.data).toEqual([
        expect.objectContaining({
          id: comment.id,
          message: 'Too dark at the start',
          author: { id: reviewer.id, name: 'Reviewer' },
          second: 2.5,
          resolved: false,
          replies: [
            expect.objectContaining({
              id: reply.id,
              message: 'Brightened in v2',
              author: { id: owner.id, name: 'Owner' },
            }),
          ],
        }),
      ])

      await expect(
        runOperation(resolveCommentOp, as(reviewer), { commentId: comment.id }),
      ).resolves.toEqual({ commentId: comment.id, resolved: true })
      await expect(
        runOperation(resolveCommentOp, as(reviewer), { commentId: comment.id, reopen: true }),
      ).resolves.toEqual({ commentId: comment.id, resolved: false })

      const created = await auditRows(AuditAction.comment_create)
      expect(created.map((r) => r.itemId)).toEqual([comment.id, reply.id])
      expect(created.every((r) => r.teamId === teamId && r.projectId === projectId)).toBe(true)
      const completed = await auditRows(AuditAction.comment_complete)
      expect(completed).toHaveLength(2)
      expect(completed[0]).toMatchObject({ itemId: comment.id, userId: reviewer.id, via: 'mcp' })
    })

    it('notifies the team about a new comment', async () => {
      const file = await createFile('cut.bin')
      await runOperation(createCommentOp, as(reviewer), { assetId: file, message: 'Nice' })

      await expect
        .poll(() => prisma.notification.count({ where: { type: 'comment_created', teamId } }))
        .toBeGreaterThan(0)
    })

    it('does not start agent runs from comments written by the built-in agent', async () => {
      const file = await createFile('cut.bin')
      await runOperation(createCommentOp, as(owner, 'agent'), {
        assetId: file,
        message: '<@default> please review',
      })
      expect(await prisma.workflowTask.count({ where: { type: 'chat', projectId } })).toBe(0)

      await runOperation(createCommentOp, as(owner, 'mcp'), {
        assetId: file,
        message: '<@default> please review',
      })
      expect(await prisma.workflowTask.count({ where: { type: 'chat', projectId } })).toBe(1)
    })

    it('lists the comments of a version stack, counting them on its latest version', async () => {
      const v2 = await createFile('v2.bin')
      const v1 = await createFile('v1.bin')
      const stack = await runOperation(createVersionStackOp, as(owner), { fileIds: [v2, v1] })
      await runOperation(createCommentOp, as(owner), { assetId: stack.id, message: 'On v2' })

      const listed = await runOperation(listCommentsOp, as(owner), { assetId: stack.id })
      expect(listed.data.map((c) => c.message)).toEqual(['On v2'])
      expect(listed.total).toBe(1)
    })

    it('rejects commenting without access, and replies to threads the caller cannot see', async () => {
      const file = await createFile('cut.bin')
      await expect(
        runOperation(createCommentOp, as(outsider), { assetId: file, message: 'hi' }),
      ).rejects.toMatchObject({ status: 403 })
      expect(await prisma.assetComment.count({ where: { assetId: file } })).toBe(0)

      // A thread in another team's project
      const otherTeam = await prisma.team.create({ data: { name: 'Other' } })
      await prisma.teamMember.create({
        data: { teamId: otherTeam.id, userId: outsider.id, role: 'owner' },
      })
      const otherProject = await projectService.createProject(outsider, {
        teamId: otherTeam.id,
        name: 'Other Project',
      })
      const otherFile = await assetService.createFile({
        parentId: otherProject.rootFolder!,
        name: 'secret.bin',
        key: 'files/test/secret.bin',
        sizeByte: 1,
        contentType: 'application/octet-stream',
        creatorId: outsider.id,
      })
      const otherThread = await runOperation(createCommentOp, as(outsider), {
        assetId: otherFile.id,
        message: 'private',
      })

      await expect(
        runOperation(createCommentOp, as(owner), {
          assetId: file,
          message: 'sneaky',
          replyToId: otherThread.id,
        }),
      ).rejects.toMatchObject({ status: 403 })
      expect(await prisma.assetComment.count({ where: { message: 'sneaky', assetId: file } })).toBe(
        0,
      )
    })

    it('rejects resolving a comment without access, and 404s an unknown one', async () => {
      const file = await createFile('cut.bin')
      const comment = await runOperation(createCommentOp, as(owner), {
        assetId: file,
        message: 'x',
      })
      await expect(
        runOperation(resolveCommentOp, as(outsider), { commentId: comment.id }),
      ).rejects.toMatchObject({ status: 403 })
      const row = await prisma.assetComment.findUniqueOrThrow({ where: { id: comment.id } })
      expect(row.isCompleted).toBe(false)
    })
  })

  describe('metadata', () => {
    it('lists fields with choices and the Creation Context flag', async () => {
      const status = await metadataService.createProjectField(projectId, {
        config: {
          name: 'Review',
          type: 'select',
          select: { options: [{ id: 'approved', displayName: 'Approved', color: '#fff' }] },
        },
        description: 'Review status',
      })
      const prompt = await metadataService.createProjectField(projectId, {
        config: { name: 'Prompt', type: 'text', autofillSource: 'CREATION_CONTEXT' },
        description: '',
      })

      const { fields } = await runOperation(listMetadataFieldsOp, as(reviewer), { projectId })

      expect(fields).toContainEqual({
        key: status.key,
        name: 'Review',
        type: 'select',
        description: 'Review status',
        readOnly: false,
        creationContext: false,
        options: [{ id: 'approved', name: 'Approved' }],
      })
      expect(fields).toContainEqual(
        expect.objectContaining({ key: prompt.key, creationContext: true }),
      )
    })

    it('rejects a non-member listing fields', async () => {
      await expect(
        runOperation(listMetadataFieldsOp, as(outsider), { projectId }),
      ).rejects.toMatchObject({ status: 403 })
    })

    it('sets values, adds a new select option, and audits a file update', async () => {
      const review = await metadataService.createProjectField(projectId, {
        config: { name: 'Review', type: 'select', select: { options: [] } },
        description: '',
      })
      const notes = await metadataService.createProjectField(projectId, {
        config: { name: 'Notes', type: 'text' },
        description: '',
      })
      const file = await createFile('a.bin')

      const result = await runOperation(updateAssetMetadataOp, as(owner, 'agent', undefined), {
        assetId: file,
        values: { [review.key]: { newOption: { value: 'Approved' } }, [notes.key]: 'Looks good' },
      })

      expect(result).toEqual({ assetId: file, updatedKeys: [review.key, notes.key] })
      const values = await prisma.assetMetadataValue.findMany({ where: { assetId: file } })
      expect(values.find((v) => v.fieldKey === review.key)?.stringValue).toBe('approved')
      expect(values.find((v) => v.fieldKey === notes.key)?.stringValue).toBe('Looks good')

      const [audit] = await auditRows(AuditAction.file_update)
      expect(audit).toMatchObject({ itemId: file, teamId, projectId, via: 'agent' })
    })

    it('rejects unknown and read-only fields before writing anything', async () => {
      const notes = await metadataService.createProjectField(projectId, {
        config: { name: 'Notes', type: 'text' },
        description: '',
      })
      await prisma.metadataField.update({ where: { key: notes.key }, data: { readOnly: true } })
      const file = await createFile('a.bin')

      await expect(
        runOperation(updateAssetMetadataOp, as(owner), {
          assetId: file,
          values: { nope: 'x' },
        }),
      ).rejects.toMatchObject({ status: 400 })
      await expect(
        runOperation(updateAssetMetadataOp, as(owner), {
          assetId: file,
          values: { [notes.key]: 'x' },
        }),
      ).rejects.toMatchObject({ status: 422 })
      expect(await prisma.assetMetadataValue.count({ where: { assetId: file } })).toBe(0)
    })

    it('rejects a reviewer without writing', async () => {
      const notes = await metadataService.createProjectField(projectId, {
        config: { name: 'Notes', type: 'text' },
        description: '',
      })
      const file = await createFile('a.bin')

      await expect(
        runOperation(updateAssetMetadataOp, as(reviewer), {
          assetId: file,
          values: { [notes.key]: 'x' },
        }),
      ).rejects.toMatchObject({ status: 403 })
      expect(await prisma.assetMetadataValue.count({ where: { assetId: file } })).toBe(0)
      expect(await auditRows(AuditAction.file_update)).toHaveLength(0)
    })
  })

  describe('version stacks', () => {
    it('stacks files, lists versions latest first, and unstacks one', async () => {
      const v2 = await createFile('cut_v2.bin')
      const v1 = await createFile('cut_v1.bin')

      const stack = await runOperation(createVersionStackOp, as(owner), { fileIds: [v2, v1] })
      expect(stack).toMatchObject({ type: 'version_stack', projectId })

      const { versions } = await runOperation(listVersionsOp, as(reviewer), { stackId: stack.id })
      expect(versions.map((v) => [v.id, v.version, v.current])).toEqual([
        [v2, 2, true],
        [v1, 1, false],
      ])

      await expect(runOperation(removeVersionOp, as(owner), { versionId: v1 })).resolves.toEqual({
        versionId: v1,
        stackId: stack.id,
      })
      const removed = await prisma.asset.findUniqueOrThrow({ where: { id: v1 } })
      expect(removed.parentId).toBe(rootFolderId)
      expect(removed.isDeleted).toBe(false)

      const [created] = await auditRows(AuditAction.version_stack_create)
      expect(created).toMatchObject({ itemId: stack.id, teamId, projectId, via: 'mcp' })
      const [updated] = await auditRows(AuditAction.version_stack_update)
      expect(updated).toMatchObject({ itemId: stack.id, teamId, projectId })
    })

    it('rejects stacking files from different folders as a bad request', async () => {
      const sub = await runOperation(createFolderOp, as(owner), { parent: rootFolderId, name: 's' })
      const a = await createFile('a.bin')
      const b = await createFile('b.bin', sub.id)

      await expect(
        runOperation(createVersionStackOp, as(owner), { fileIds: [a, b] }),
      ).rejects.toMatchObject({ status: 400 })
      expect(await prisma.asset.count({ where: { type: 'version_stack', projectId } })).toBe(0)
    })

    it('rejects a reviewer stacking or unstacking without changes', async () => {
      const v2 = await createFile('v2.bin')
      const v1 = await createFile('v1.bin')

      await expect(
        runOperation(createVersionStackOp, as(reviewer), { fileIds: [v2, v1] }),
      ).rejects.toMatchObject({ status: 403 })
      expect(await prisma.asset.count({ where: { type: 'version_stack', projectId } })).toBe(0)

      const stack = await runOperation(createVersionStackOp, as(owner), { fileIds: [v2, v1] })
      await expect(
        runOperation(removeVersionOp, as(reviewer), { versionId: v1 }),
      ).rejects.toMatchObject({ status: 403 })
      const row = await prisma.asset.findUniqueOrThrow({ where: { id: v1 } })
      expect(row.parentId).toBe(stack.id)
    })

    it('reports a file outside a stack and a non-stack as bad requests', async () => {
      const file = await createFile('lonely.bin')
      await expect(
        runOperation(removeVersionOp, as(owner), { versionId: file }),
      ).rejects.toMatchObject({ status: 400 })
      await expect(
        runOperation(listVersionsOp, as(owner), { stackId: file }),
      ).rejects.toMatchObject({ status: 400 })
    })
  })
})
