import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { projectService } from '@shumai/core/src/project/project'
import { s3Service } from '@shumai/core/src/s3/s3'
import { pendingUploadService } from '@shumai/core/src/upload/pending-upload'
import { completeUploadOp, createFileOp, createFolderOp, createVersionOp } from './index'
import { runOperation } from './run'
import type { OperationContext } from './context'

/** Real-database and real-storage tests for create_file, create_version, and complete_upload. */
describe('upload Operations', () => {
  setupTestDbHooks()

  const bucket = 'shumai-test-upload-ops'
  const originalBucket = process.env.S3_BUCKET

  let owner: User
  let reviewer: User
  let teamId: string
  let projectId: string
  let rootFolderId: string

  const as = (user: User, via: OperationContext['via'] = 'mcp', agentId?: string) => ({
    userId: user.id,
    via,
    agentId,
  })

  /** Uploads bytes the way a client would after create_file / create_version. */
  async function upload(uploadId: string, user: User, content = 'hello world') {
    const { key } = pendingUploadService.read(uploadId, user.id)
    await s3Service.putObject(bucket, key, Buffer.from(content), Buffer.byteLength(content))
    return key
  }

  async function auditRows(action: AuditAction) {
    return prisma.auditLog.findMany({ where: { action, teamId }, orderBy: { id: 'asc' } })
  }

  beforeAll(() => {
    process.env.S3_BUCKET = bucket
  })

  afterAll(async () => {
    if (originalBucket === undefined) delete process.env.S3_BUCKET
    else process.env.S3_BUCKET = originalBucket
    await s3Service.deletePrefix(bucket, '').catch(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(async () => {
    owner = await prisma.user.create({
      data: { name: 'Owner', email: 'upload-owner@test.com', password: 'pw' },
    })
    reviewer = await prisma.user.create({
      data: { name: 'Reviewer', email: 'upload-reviewer@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'Upload Team' } })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, userId: owner.id, role: 'owner' } })
    await prisma.teamMember.create({ data: { teamId, userId: reviewer.id, role: 'reviewer' } })
    const project = await projectService.createProject(owner, { teamId, name: 'Upload Project' })
    projectId = project.id
    rootFolderId = project.rootFolder!
  })

  describe('create_file + complete_upload', () => {
    it('creates nothing until the upload completes, then creates the file once', async () => {
      const started = await runOperation(createFileOp, as(owner), {
        parent: rootFolderId,
        name: 'notes.bin',
      })

      expect(started).toEqual({
        uploadId: expect.any(String),
        uploadUrl: expect.stringContaining('/api/upload/local?'),
        method: 'PUT',
        expiresAt: expect.any(String),
      })
      expect(new Date(started.expiresAt).getTime()).toBeGreaterThan(Date.now())
      expect(await prisma.asset.count({ where: { name: 'notes.bin', projectId } })).toBe(0)

      // Completing before the bytes are uploaded fails and can be retried
      await expect(
        runOperation(completeUploadOp, as(owner), { uploadId: started.uploadId }),
      ).rejects.toMatchObject({ status: 409 })

      const key = await upload(started.uploadId, owner)
      const file = await runOperation(completeUploadOp, as(owner), {
        uploadId: started.uploadId,
      })

      expect(file).toEqual({
        id: expect.any(String),
        name: 'notes.bin',
        type: 'file',
        size: 11,
        projectId,
      })
      const row = await prisma.asset.findUniqueOrThrow({
        where: { id: file.id },
        include: { storageKey: true },
      })
      expect(row).toMatchObject({ parentId: rootFolderId, creatorId: owner.id })
      expect(row.storageKey?.key).toBe(key)

      const [audit] = await auditRows(AuditAction.file_create)
      expect(audit).toMatchObject({ itemId: file.id, teamId, projectId, via: 'mcp' })

      // Completing again returns the same file without another asset or audit entry
      const again = await runOperation(completeUploadOp, as(owner), {
        uploadId: started.uploadId,
      })
      expect(again.id).toBe(file.id)
      expect(await prisma.asset.count({ where: { name: 'notes.bin', projectId } })).toBe(1)
      expect(await auditRows(AuditAction.file_create)).toHaveLength(1)
    })

    it('records Creation Context metadata and attributes the file to the agent', async () => {
      const prompt = await metadataService.createProjectField(projectId, {
        config: { name: 'Prompt', type: 'text', autofillSource: 'CREATION_CONTEXT' },
        description: '',
      })
      const agentUser = await prisma.user.create({
        data: { name: 'Bot', type: 'agent', email: 'upload-bot@test.com' },
      })
      const agent = await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId,
          type: 'chat',
          config: { provider: 'test', model: 'test' },
        },
      })

      const started = await runOperation(createFileOp, as(owner, 'agent', agent.id), {
        parent: rootFolderId,
        name: 'gen.bin',
        metadata: { [prompt.key]: 'a red fox' },
      })
      // The built-in agent writes straight to storage, so it gets the key
      expect(started.key).toMatch(/^files\/.+\/gen\.bin$/)

      await upload(started.uploadId, owner)
      const file = await runOperation(completeUploadOp, as(owner, 'agent', agent.id), {
        uploadId: started.uploadId,
      })

      const row = await prisma.asset.findUniqueOrThrow({ where: { id: file.id } })
      expect(row.agentId).toBe(agent.id)
      const value = await prisma.assetMetadataValue.findFirstOrThrow({
        where: { assetId: file.id, fieldKey: prompt.key },
      })
      expect(value.stringValue).toBe('a red fox')
      const [audit] = await auditRows(AuditAction.file_create)
      expect(audit).toMatchObject({ itemId: file.id, agentId: agent.id, via: 'agent' })
    })

    it('rejects metadata that is not a Creation Context field before uploading', async () => {
      const notes = await metadataService.createProjectField(projectId, {
        config: { name: 'Notes', type: 'text' },
        description: '',
      })

      await expect(
        runOperation(createFileOp, as(owner), {
          parent: rootFolderId,
          name: 'a.bin',
          metadata: { [notes.key]: 'x' },
        }),
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining(notes.key) })
    })

    it('rejects a parent that is not a folder', async () => {
      const started = await runOperation(createFileOp, as(owner), {
        parent: rootFolderId,
        name: 'a.bin',
      })
      await upload(started.uploadId, owner)
      const file = await runOperation(completeUploadOp, as(owner), { uploadId: started.uploadId })

      await expect(
        runOperation(createFileOp, as(owner), { parent: file.id, name: 'b.bin' }),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects a reviewer without starting an upload', async () => {
      const presign = vi.spyOn(s3Service, 'presign')
      await expect(
        runOperation(createFileOp, as(reviewer), { parent: rootFolderId, name: 'nope.bin' }),
      ).rejects.toMatchObject({ status: 403 })
      expect(presign).not.toHaveBeenCalled()
    })

    it('stops an upload if the user lost access before completing it', async () => {
      const folder = await runOperation(createFolderOp, as(owner), {
        parent: rootFolderId,
        name: 'inbox',
      })
      const editor = await prisma.user.create({
        data: { name: 'Editor', email: 'upload-editor@test.com', password: 'pw' },
      })
      await prisma.teamMember.create({ data: { teamId, userId: editor.id, role: 'editor' } })
      const started = await runOperation(createFileOp, as(editor), {
        parent: folder.id,
        name: 'late.bin',
      })
      await upload(started.uploadId, editor)

      await prisma.teamMember.update({
        where: { teamIdUserId: { teamId, userId: editor.id } },
        data: { role: 'reviewer' },
      })

      await expect(
        runOperation(completeUploadOp, as(editor), { uploadId: started.uploadId }),
      ).rejects.toMatchObject({ status: 403 })
      expect(await prisma.asset.count({ where: { name: 'late.bin', projectId } })).toBe(0)
    })

    it('only lets the user who started an upload complete it', async () => {
      const started = await runOperation(createFileOp, as(owner), {
        parent: rootFolderId,
        name: 'mine.bin',
      })
      await upload(started.uploadId, owner)

      await expect(
        runOperation(completeUploadOp, as(reviewer), { uploadId: started.uploadId }),
      ).rejects.toMatchObject({ status: 403 })
      expect(await prisma.asset.count({ where: { name: 'mine.bin', projectId } })).toBe(0)
    })

    it('rejects a tampered or expired upload ID', async () => {
      const started = await runOperation(createFileOp, as(owner), {
        parent: rootFolderId,
        name: 'a.bin',
      })
      const [payload, signature] = started.uploadId.split('.')
      const forged = Buffer.from(
        JSON.stringify({
          ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
          parentId: 'elsewhere',
        }),
      ).toString('base64url')

      await expect(
        runOperation(completeUploadOp, as(owner), { uploadId: `${forged}.${signature}` }),
      ).rejects.toMatchObject({ status: 400 })
      await expect(
        runOperation(completeUploadOp, as(owner), { uploadId: 'not-an-upload' }),
      ).rejects.toMatchObject({ status: 400 })

      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60 * 60 * 1000)
      await expect(
        runOperation(completeUploadOp, as(owner), { uploadId: started.uploadId }),
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('expired') })
    })
  })

  describe('create_version + complete_upload', () => {
    it('adds the upload as the current version of a file', async () => {
      const first = await runOperation(createFileOp, as(owner), {
        parent: rootFolderId,
        name: 'cut_v1.bin',
      })
      await upload(first.uploadId, owner)
      const v1 = await runOperation(completeUploadOp, as(owner), { uploadId: first.uploadId })

      const second = await runOperation(createVersionOp, as(owner), {
        parent: v1.id,
        name: 'cut_v2.bin',
      })
      await upload(second.uploadId, owner, 'version two')
      const v2 = await runOperation(completeUploadOp, as(owner), { uploadId: second.uploadId })

      expect(v2).toMatchObject({ name: 'cut_v2.bin', type: 'file', size: 11 })
      const stackId = (await prisma.asset.findUniqueOrThrow({ where: { id: v2.id } })).parentId!
      const stack = await prisma.asset.findUniqueOrThrow({ where: { id: stackId } })
      expect(stack.type).toBe('version_stack')
      expect(await assetService.resolveLatestVersionId(stackId)).toBe(v2.id)
      expect(await auditRows(AuditAction.file_create)).toHaveLength(2)
    })

    it('rejects a folder as the parent', async () => {
      await expect(
        runOperation(createVersionOp, as(owner), { parent: rootFolderId, name: 'v.bin' }),
      ).rejects.toMatchObject({ status: 400 })
    })
  })
})
