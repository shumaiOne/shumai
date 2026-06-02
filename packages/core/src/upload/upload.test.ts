import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { uploadService } from './upload'
import { s3Service } from '@shumai/core/src/s3/s3'
import { AssetStatus, AssetType, WorkflowTaskType } from '@shumai/db'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    presign: vi.fn().mockResolvedValue('http://presigned-url.com'),
    getObjectSize: vi.fn().mockResolvedValue(100),
  },
}))

describe('UploadService', () => {
  setupTestDbHooks()

  let userId: string
  let teamId: string
  let projectId: string
  let parentId: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: 'test', email: 'test-upload@example.com' },
    })
    userId = user.id
    const team = await prisma.team.create({ data: { name: 'team' } })
    teamId = team.id
    const project = await prisma.project.create({
      data: { name: 'project', teamId },
    })
    projectId = project.id

    const parent = await prisma.asset.create({
      data: {
        name: 'parent',
        type: AssetType.folder,
        projectId,
        status: AssetStatus.uploaded,
      },
    })
    parentId = parent.id
  })

  it('should create an upload task', async () => {
    const req = {
      parentId: parentId,
      files: [
        {
          name: 'file1.txt',
          id: '1',
          size: 100,
          type: 'file',
          mediaType: 'video/mp4',
          children: [],
        },
        {
          name: 'folder1',
          id: '2',
          type: 'folder',
          size: 0,
          children: [
            {
              name: 'file2.txt',
              id: '3',
              size: 200,
              type: 'file',
              mediaType: 'image/png',
              children: [],
            },
          ],
        },
        { name: '.hidden', id: '4', size: 100, type: 'file', children: [] },
      ],
    }

    const resp = await uploadService.createUploadTask(userId, req)
    expect(resp.taskId).toBeDefined()
    expect(resp.presignedUrls).toHaveLength(2)

    const task = await prisma.task.findUnique({ where: { id: resp.taskId } })
    expect(task?.name).toBe('2 Items')
    expect(task?.total).toBe(2)

    const file1 = await prisma.asset.findFirst({ where: { name: 'file1.txt' } })
    expect(file1?.mediaType).toBe('video/mp4')

    const file2 = await prisma.asset.findFirst({ where: { name: 'file2.txt' } })
    expect(file2?.mediaType).toBe('image/png')

    const hidden = await prisma.asset.findFirst({ where: { name: '.hidden' } })
    expect(hidden).toBeNull()
  })

  it('should confirm file upload and create transcode tasks for video', async () => {
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'video.mp4',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: parentId } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'test-key' },
            create: { key: 'test-key' },
          },
        },
        mediaType: 'video/mp4',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
    // For video/image, status remains 'uploaded' while transcoding is pending
    expect(updatedAsset?.status).toBe(AssetStatus.uploaded)

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode },
    })
    expect(workflowTask).toBeDefined()
    expect(workflowTask?.payload).toEqual({
      projectId: projectId,
      transcode: {
        videoStrategy: 'best_match',
        sprite: true,
        poster: true,
      },
    })
  })

  it('should confirm file upload and create transcode tasks for image', async () => {
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'image.png',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: parentId } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'test-key' },
            create: { key: 'test-key' },
          },
        },
        mediaType: 'image/png',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode },
    })
    expect(workflowTask).toBeDefined()
    expect(workflowTask?.payload).toEqual({
      projectId: projectId,
      transcode: {
        thumbnail: true,
      },
    })
  })

  it('should confirm file upload for non-media files', async () => {
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'file.txt',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: parentId } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'test-key' },
            create: { key: 'test-key' },
          },
        },
        mediaType: 'text/plain',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
    expect(updatedAsset?.status).toBe(AssetStatus.processed)

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode },
    })
    expect(workflowTask).toBeNull()
  })

  it('should create a version stack when parentId is a file', async () => {
    // Create an existing file
    const fileA = await prisma.asset.create({
      data: {
        name: 'fileA.txt',
        type: AssetType.file,
        projectId,
        parentId,
        status: AssetStatus.processed,
        sizeByte: 1000,
      },
    })

    const req = {
      parentId: fileA.id,
      files: [
        {
          name: 'fileA_v2.txt',
          id: 'v2',
          size: 2000,
          type: 'file' as const,
          mediaType: 'text/plain',
          children: [],
        },
      ],
    }

    const resp = await uploadService.createUploadTask(userId, req)
    expect(resp.taskId).toBeDefined()

    // Should have created a version stack
    const stack = await prisma.asset.findFirst({
      where: { type: AssetType.version_stack, parentId },
    })
    expect(stack).toBeDefined()
    expect(stack?.fileCount).toBe(1) // Only fileA is "uploaded", the new one is still "uploading"
    expect(stack?.sizeByte).toBe(1000)

    // The new asset should be inside the stack
    const newAsset = await prisma.asset.findFirst({
      where: { taskId: resp.taskId, parentId: stack!.id },
    })
    expect(newAsset).toBeDefined()
    expect(newAsset?.status).toBe(AssetStatus.uploading)
  })

  it('should correctly update counts when confirming a version in a stack', async () => {
    // Create a stack with one existing file
    const stack = await prisma.asset.create({
      data: {
        name: '',
        type: AssetType.version_stack,
        projectId,
        parentId,
        status: AssetStatus.uploaded,
        fileCount: 1,
        sizeByte: 1000,
      },
    })
    await prisma.asset.create({
      data: {
        name: 'v1.txt',
        type: AssetType.file,
        projectId,
        parentId: stack.id,
        status: AssetStatus.processed,
        sizeByte: 1000,
      },
    })

    // Create an uploading asset in that stack
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const fileV2 = await prisma.asset.create({
      data: {
        name: 'v2.txt',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: stack.id } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'v2-key' },
            create: { key: 'v2-key' },
          },
        },
        sizeByte: 2000,
      },
    })

    vi.spyOn(s3Service, 'getObjectSize').mockResolvedValue(2000)

    // Manually set parent folder size to match initial stack size for realistic aggregation
    await prisma.asset.update({
      where: { id: parentId },
      data: { sizeByte: 1000 },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: fileV2.id })

    const updatedStack = await prisma.asset.findUnique({ where: { id: stack.id } })
    expect(updatedStack?.fileCount).toBe(2)
    expect(updatedStack?.sizeByte).toBe(3000)

    // Verify parent folder size (initially 1000 from stack)
    const parentFolder = await prisma.asset.findUnique({ where: { id: parentId } })
    expect(parentFolder?.sizeByte).toBe(3000)
  })

  it('should list upload tasks', async () => {
    const task = await prisma.task.create({
      data: {
        creatorId: userId,
        total: 3,
        uploaded: 1,
        type: 'upload',
        name: 'test-upload-task',
      },
    })

    const result = await uploadService.listUploadTasks(userId, { first: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe(task.id)
    expect(result.data[0].name).toBe('test-upload-task')
  })
})
