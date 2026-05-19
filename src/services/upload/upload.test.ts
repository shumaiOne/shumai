import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { uploadService } from './upload'
import { AssetStatus, AssetType, WorkflowTaskType } from '@/generated/prisma/client'

vi.mock('@/services/s3/s3', () => ({
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
        projectId,
        parentId,
        status: AssetStatus.uploading,
        key: 'test-key',
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
      videoStrategy: 'single',
      sprite: true,
      poster: true,
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
        projectId,
        parentId,
        status: AssetStatus.uploading,
        key: 'test-key',
        mediaType: 'image/png',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode },
    })
    expect(workflowTask).toBeDefined()
    expect(workflowTask?.payload).toEqual({
      imageStrategy: 'single',
      thumbnail: true,
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
        projectId,
        parentId,
        status: AssetStatus.uploading,
        key: 'test-key',
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
})
