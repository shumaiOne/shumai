import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { uploadService } from './upload'
import { gotenbergService } from '@shumai/core/src/gotenberg/gotenberg'
import { getStorageBackend, s3Service } from '@shumai/core/src/s3/s3'
import { AssetStatus, AssetType, TaskStatus, WorkflowTaskType } from '@shumai/db'

vi.mock('@shumai/core/src/s3/s3', () => ({
  getStorageBackend: vi.fn().mockReturnValue('s3'),
  s3Service: {
    presign: vi.fn().mockResolvedValue('http://presigned-url.com'),
    getObjectSize: vi.fn().mockResolvedValue(100),
    presignMultipart: vi.fn().mockResolvedValue({ url: 'http://signed-multipart-url.com' }),
    abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
    deleteObject: vi.fn().mockResolvedValue(1),
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

  it('completes a task that has no files to upload instead of leaving it pending', async () => {
    const resp = await uploadService.createUploadTask(userId, {
      parentId,
      files: [
        { name: 'empty-folder', id: '1', size: 0, type: 'folder', children: [] },
        { name: '.DS_Store', id: '2', size: 10, type: 'file', children: [] },
      ],
    })
    const task = await prisma.task.findUnique({ where: { id: resp.taskId } })
    expect(task?.total).toBe(0)
    expect(task?.status).toBe(TaskStatus.completed)
  })

  it('should correctly increment fileCount for parent folders when uploading folders', async () => {
    const req = {
      parentId: parentId,
      files: [
        {
          name: 'folder1',
          id: '1',
          type: 'folder' as const,
          size: 0,
          children: [
            {
              name: 'folder2',
              id: '2',
              type: 'folder' as const,
              size: 0,
              children: [],
            },
            {
              name: 'file1.txt',
              id: '3',
              type: 'file' as const,
              size: 100,
              mediaType: 'text/plain',
              children: [],
            },
          ],
        },
      ],
    }

    await uploadService.createUploadTask(userId, req)

    // parentId folder should have folder1 as a direct child
    const parent = await prisma.asset.findUnique({ where: { id: parentId } })
    expect(parent?.fileCount).toBe(1)

    // folder1 should have folder2 and file1.txt as direct children
    // folder2 is a folder, so it is counted immediately.
    // file1.txt is a file, so it is counted after confirmFileUpload.
    const folder1 = await prisma.asset.findFirst({ where: { name: 'folder1' } })
    expect(folder1?.parentId).toBe(parentId)
    expect(folder1?.fileCount).toBe(1)

    const folder2 = await prisma.asset.findFirst({ where: { name: 'folder2' } })
    expect(folder2?.parentId).toBe(folder1?.id)
    expect(folder2?.fileCount).toBe(0)

    const file1 = await prisma.asset.findFirst({ where: { name: 'file1.txt' } })
    expect(file1?.parentId).toBe(folder1?.id)
    expect(file1?.status).toBe(AssetStatus.uploading)

    // Confirm upload for file1.txt
    const task = await prisma.task.findFirst({ where: { total: 1 } })
    await uploadService.confirmFileUpload(userId, task!.id, {
      fileId: file1!.id,
    })

    const folder1After = await prisma.asset.findUnique({ where: { id: folder1!.id } })
    expect(folder1After?.fileCount).toBe(2)
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
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_video },
    })
    expect(workflowTask).toBeDefined()
    expect(workflowTask?.payload).toEqual({
      projectId: projectId,
      transcode: {
        videoStrategy: 'best_match',
        hardwareAcceleration: 'off',
        threads: 0,
        sprite: true,
        poster: true,
        hlsEnabled: false,
      },
    })
  })

  it('should pass custom transcode.threads and videoResolutions from team settings to transcode task', async () => {
    await prisma.team.update({
      where: { id: teamId },
      data: {
        settings: {
          transcode: {
            videoStrategy: 'multi',
            videoResolutions: ['720p', '1080p'],
            hardwareAcceleration: 'auto',
            threads: 12,
          },
        },
      },
    })

    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'video-custom-threads.mp4',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: parentId } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'test-key-threads' },
            create: { key: 'test-key-threads' },
          },
        },
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_video },
    })
    expect(workflowTask).toBeDefined()
    expect(workflowTask?.payload).toEqual({
      projectId: projectId,
      transcode: {
        videoStrategy: 'multi',
        videoResolutions: ['720p', '1080p'],
        hardwareAcceleration: 'auto',
        threads: 12,
        sprite: true,
        poster: true,
        hlsEnabled: false,
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
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_image },
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
        name: 'file.json',
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
        mediaType: 'application/json',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
    expect(updatedAsset?.status).toBe(AssetStatus.processed)

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_video },
    })
    expect(workflowTask).toBeNull()
  })

  it('should confirm file upload and create transcode_pdf for office document when Gotenberg is available', async () => {
    vi.spyOn(gotenbergService, 'isAvailable').mockResolvedValue(true)
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'document.docx',
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
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_pdf },
    })
    expect(workflowTask).toBeDefined()
  })

  it('should mark asset processed without creating transcode_pdf for office document when Gotenberg is unavailable', async () => {
    vi.spyOn(gotenbergService, 'isAvailable').mockResolvedValue(false)
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'document.docx',
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
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
    expect(updatedAsset?.status).toBe(AssetStatus.processed)

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_pdf },
    })
    expect(workflowTask).toBeNull()
  })

  it('should confirm file upload and create transcode_pdf for HTML document when Gotenberg is available', async () => {
    vi.spyOn(gotenbergService, 'isAvailable').mockResolvedValue(true)
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'index.html',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: parentId } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'test-key-html-1' },
            create: { key: 'test-key-html-1' },
          },
        },
        mediaType: 'text/html',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_pdf },
    })
    expect(workflowTask).toBeDefined()
  })

  it('should mark asset processed without creating transcode_pdf for HTML document when Gotenberg is unavailable', async () => {
    vi.spyOn(gotenbergService, 'isAvailable').mockResolvedValue(false)
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'index.html',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: parentId } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'test-key-html-2' },
            create: { key: 'test-key-html-2' },
          },
        },
        mediaType: 'text/html',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
    expect(updatedAsset?.status).toBe(AssetStatus.processed)

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_pdf },
    })
    expect(workflowTask).toBeNull()
  })

  it('should confirm file upload and resolve empty mediaType using Bun resolver for audio', async () => {
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'audio.mp3',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: parentId } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'test-key-audio-empty' },
            create: { key: 'test-key-audio-empty' },
          },
        },
        mediaType: '',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
    expect(updatedAsset?.mediaType).toBe('audio/mpeg')
    expect(updatedAsset?.status).toBe(AssetStatus.uploaded)

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_video },
    })
    expect(workflowTask).toBeDefined()
  })

  it('should confirm file upload and resolve application/octet-stream mediaType using Bun resolver for audio', async () => {
    const task = await prisma.task.create({
      data: { creatorId: userId, total: 1, uploaded: 0, type: 'upload' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'song.wav',
        type: AssetType.file,
        project: { connect: { id: projectId } },
        parent: { connect: { id: parentId } },
        status: AssetStatus.uploading,
        storageKey: {
          connectOrCreate: {
            where: { key: 'test-key-audio-octet' },
            create: { key: 'test-key-audio-octet' },
          },
        },
        mediaType: 'application/octet-stream',
      },
    })

    await uploadService.confirmFileUpload(userId, task.id, { fileId: asset.id })

    const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } })
    expect(updatedAsset?.mediaType).toBe('audio/x-wav')
    expect(updatedAsset?.status).toBe(AssetStatus.uploaded)

    const workflowTask = await prisma.workflowTask.findFirst({
      where: { assetId: asset.id, type: WorkflowTaskType.transcode_video },
    })
    expect(workflowTask).toBeDefined()
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
    expect(Number(stack?.sizeByte)).toBe(1000)

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
    expect(Number(updatedStack?.sizeByte)).toBe(3000)

    // Verify parent folder size (initially 1000 from stack)
    const parentFolder = await prisma.asset.findUnique({ where: { id: parentId } })
    expect(Number(parentFolder?.sizeByte)).toBe(3000)
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

  it('reports a task the stale sweep gave up on as failed', async () => {
    await prisma.task.create({
      data: {
        creatorId: userId,
        total: 2,
        uploaded: 0,
        type: 'upload',
        name: 'stale-upload-task',
        status: TaskStatus.failed,
      },
    })

    const result = await uploadService.listUploadTasks(userId, { first: 10 })
    expect(result.data[0].status).toBe('failed')
  })

  it('should correct the mediaType for .wma files that browser incorrectly reports as video', async () => {
    const req = {
      parentId: parentId,
      files: [
        {
          name: 'song.wma',
          id: '1',
          size: 100,
          type: 'file' as const,
          mediaType: 'video/x-ms-wma',
          children: [],
        },
        {
          name: 'other_song.WMA',
          id: '2',
          size: 200,
          type: 'file' as const,
          mediaType: 'video/x-ms-asf',
          children: [],
        },
      ],
    }

    const resp = await uploadService.createUploadTask(userId, req)
    expect(resp.taskId).toBeDefined()

    const song1 = await prisma.asset.findFirst({ where: { name: 'song.wma' } })
    expect(song1?.mediaType).toBe('audio/x-ms-wma')

    const song2 = await prisma.asset.findFirst({ where: { name: 'other_song.WMA' } })
    expect(song2?.mediaType).toBe('audio/x-ms-asf')
  })

  describe('signS3Upload', () => {
    it('should sign multipart request and store uploadId on asset', async () => {
      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/test/video.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'video.mp4',
          type: AssetType.file,
          projectId,
          storageKeyId: storageKey.id,
          status: AssetStatus.uploading,
        },
      })

      const res = await uploadService.signS3Upload(teamId, userId, {
        key: 'files/test/video.mp4',
        method: 'PUT',
        uploadId: 'upload-id-xyz',
        partNumber: 1,
        fileId: asset.id,
      })

      expect(res.url).toBe('http://signed-multipart-url.com')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.uploadId).toBe('upload-id-xyz')
    })

    it('should reject signing if requested key does not match asset storage key', async () => {
      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/test/video.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'video.mp4',
          type: AssetType.file,
          projectId,
          storageKeyId: storageKey.id,
          status: AssetStatus.uploading,
        },
      })

      await expect(
        uploadService.signS3Upload(teamId, userId, {
          key: 'files/unauthorized/other.mp4',
          method: 'PUT',
          fileId: asset.id,
        }),
      ).rejects.toThrow('Requested key does not match asset storage key')
    })

    it('should reject signing if asset is not in uploading status', async () => {
      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/test/video.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'video.mp4',
          type: AssetType.file,
          projectId,
          storageKeyId: storageKey.id,
          status: AssetStatus.uploaded,
        },
      })

      await expect(
        uploadService.signS3Upload(teamId, userId, {
          key: 'files/test/video.mp4',
          method: 'PUT',
          fileId: asset.id,
        }),
      ).rejects.toThrow('Asset is not currently uploading')
    })

    it('should reject signing if asset belongs to another team', async () => {
      const otherTeam = await prisma.team.create({ data: { name: 'other-team' } })
      const otherProject = await prisma.project.create({
        data: { name: 'other-project', teamId: otherTeam.id },
      })
      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/test/other.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'other.mp4',
          type: AssetType.file,
          projectId: otherProject.id,
          storageKeyId: storageKey.id,
          status: AssetStatus.uploading,
        },
      })

      await expect(
        uploadService.signS3Upload(teamId, userId, {
          key: 'files/test/other.mp4',
          method: 'PUT',
          fileId: asset.id,
        }),
      ).rejects.toThrow('Asset does not belong to team')
    })
  })

  describe('abortUpload', () => {
    it('should abort multipart upload, delete asset, and fail task', async () => {
      const task = await prisma.task.create({
        data: {
          creatorId: userId,
          type: 'upload',
          name: 'task-1',
          total: 1,
          status: TaskStatus.uploading,
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/test/abort.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'abort.mp4',
          type: AssetType.file,
          projectId,
          storageKeyId: storageKey.id,
          taskId: task.id,
          uploadId: 'upload-abc',
          status: AssetStatus.uploading,
        },
      })

      const res = await uploadService.abortUpload(teamId, userId, task.id, {
        fileId: asset.id,
        uploadId: 'upload-abc',
        key: 'files/test/abort.mp4',
      })

      expect(res.success).toBe(true)
      expect(s3Service.abortMultipartUpload).toHaveBeenCalledWith(
        expect.anything(),
        'files/test/abort.mp4',
        'upload-abc',
      )

      const deletedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(deletedAsset).toBeNull()

      const updatedTask = await prisma.task.findUnique({
        where: { id: task.id },
      })
      expect(updatedTask?.status).toBe(TaskStatus.failed)
    })

    it('should reject aborting if asset taskId does not match', async () => {
      const task = await prisma.task.create({
        data: {
          creatorId: userId,
          type: 'upload',
          name: 'task-1',
          total: 1,
          status: TaskStatus.uploading,
        },
      })

      const otherTask = await prisma.task.create({
        data: {
          creatorId: userId,
          type: 'upload',
          name: 'other-task',
          total: 1,
          status: TaskStatus.uploading,
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/test/abort-mismatch.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'abort-mismatch.mp4',
          type: AssetType.file,
          projectId,
          storageKeyId: storageKey.id,
          taskId: otherTask.id,
          uploadId: 'upload-abc',
          status: AssetStatus.uploading,
        },
      })

      await expect(
        uploadService.abortUpload(teamId, userId, task.id, {
          fileId: asset.id,
          uploadId: 'upload-abc',
          key: 'files/test/abort-mismatch.mp4',
        }),
      ).rejects.toThrow('Asset does not belong to specified task')
    })

    it('should delete object from storage when aborting single/local upload without uploadId', async () => {
      const task = await prisma.task.create({
        data: {
          creatorId: userId,
          type: 'upload',
          name: 'task-2',
          total: 1,
          status: TaskStatus.uploading,
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/test/single.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'single.mp4',
          type: AssetType.file,
          projectId,
          storageKeyId: storageKey.id,
          taskId: task.id,
          status: AssetStatus.uploading,
        },
      })

      const res = await uploadService.abortUpload(teamId, userId, task.id, {
        fileId: asset.id,
        key: 'files/test/single.mp4',
      })

      expect(res.success).toBe(true)
      expect(s3Service.deleteObject).toHaveBeenCalledWith(
        expect.anything(),
        'files/test/single.mp4',
      )

      const deletedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(deletedAsset).toBeNull()
    })
  })

  describe('files over the request body limit', () => {
    const GIB = 1024 ** 3
    const file = (name: string, size: number) => ({
      name,
      id: name,
      size,
      type: 'file' as const,
      mediaType: 'video/quicktime',
      children: [],
    })

    it('refuses the whole upload with local storage, naming the files, before creating anything', async () => {
      vi.mocked(getStorageBackend).mockReturnValue('local')
      try {
        await expect(
          uploadService.createUploadTask(userId, {
            parentId,
            files: [
              file('small.mov', GIB),
              {
                ...file('trip', 0),
                type: 'folder' as const,
                children: [file('DSCF1253.MOV', 26_762_885_120)],
              },
            ],
          }),
        ).rejects.toMatchObject({
          status: 413,
          message: expect.stringContaining('DSCF1253.MOV (24.9 GiB)'),
        })
        expect(await prisma.task.count()).toBe(0)
        expect(await prisma.asset.count({ where: { name: 'small.mov' } })).toBe(0)
      } finally {
        vi.mocked(getStorageBackend).mockReturnValue('s3')
      }
    })

    it('lets the same file through to S3, which uploads it in parts', async () => {
      const res = await uploadService.createUploadTask(userId, {
        parentId,
        files: [file('DSCF1253.MOV', 26_762_885_120)],
      })
      expect(res.createdAssets).toHaveLength(1)
    })
  })

  describe('abandonStaleUploads', () => {
    const HOUR = 60 * 60 * 1000
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * HOUR)

    const uploadTask = (name: string, status: TaskStatus = TaskStatus.pending) =>
      prisma.task.create({ data: { creatorId: userId, type: 'upload', name, total: 2, status } })

    const placeholder = async (
      name: string,
      taskId: string,
      status: AssetStatus = AssetStatus.uploading,
    ) => {
      const storageKey = await prisma.storageKey.create({ data: { key: `files/stale/${name}` } })
      return prisma.asset.create({
        data: {
          name,
          type: AssetType.file,
          projectId,
          parentId,
          storageKeyId: storageKey.id,
          taskId,
          status,
        },
      })
    }

    const age = async (table: 'assets' | 'tasks', id: string, when: Date) => {
      if (table === 'assets') {
        await prisma.$executeRaw`UPDATE assets SET updated_at = ${when} WHERE id = ${id}`
      } else {
        await prisma.$executeRaw`UPDATE tasks SET updated_at = ${when} WHERE id = ${id}`
      }
    }

    it('discards files of an upload that stopped a day ago and fails its task', async () => {
      const task = await uploadTask('stopped')
      const done = await placeholder('done.jpg', task.id, AssetStatus.uploaded)
      const stuck = await placeholder('huge.mov', task.id)
      for (const id of [done.id, stuck.id]) await age('assets', id, daysAgo(2))
      await age('tasks', task.id, daysAgo(2))

      expect(await uploadService.abandonStaleUploads(24)).toEqual({ files: 1, tasks: 1 })

      expect(await prisma.asset.findUnique({ where: { id: stuck.id } })).toBeNull()
      expect(await prisma.asset.findUnique({ where: { id: done.id } })).not.toBeNull()
      expect(s3Service.deleteObject).toHaveBeenCalledWith(expect.anything(), 'files/stale/huge.mov')
      const after = await prisma.task.findUnique({ where: { id: task.id } })
      expect(after?.status).toBe(TaskStatus.failed)
    })

    it('leaves an old file alone while its task is still making progress', async () => {
      const task = await uploadTask('busy', TaskStatus.uploading)
      const waiting = await placeholder('queued.raf', task.id)
      await age('assets', waiting.id, daysAgo(2))

      expect(await uploadService.abandonStaleUploads(24)).toEqual({ files: 0, tasks: 0 })
      expect(await prisma.asset.findUnique({ where: { id: waiting.id } })).not.toBeNull()
    })

    it('spares a multipart upload that keeps asking for part URLs', async () => {
      const task = await uploadTask('big-multipart', TaskStatus.uploading)
      const part = await placeholder('big.mov', task.id)
      await age('assets', part.id, daysAgo(2))
      await age('tasks', task.id, daysAgo(2))

      await uploadService.signS3Upload(teamId, userId, {
        key: 'files/stale/big.mov',
        method: 'PUT',
        uploadId: 'up-1',
        partNumber: 7,
        fileId: part.id,
      })

      expect(await uploadService.abandonStaleUploads(24)).toEqual({ files: 0, tasks: 0 })
      const after = await prisma.asset.findUnique({ where: { id: part.id } })
      expect(after).not.toBeNull()
      expect(after!.updatedAt.getTime()).toBeGreaterThan(Date.now() - HOUR)
    })

    it('never fails a task that has no files (total 0)', async () => {
      const task = await prisma.task.create({
        data: {
          creatorId: userId,
          type: 'upload',
          name: 'folders only',
          total: 0,
          status: TaskStatus.pending,
        },
      })
      await age('tasks', task.id, daysAgo(3))

      expect(await uploadService.abandonStaleUploads(24)).toEqual({ files: 0, tasks: 0 })
      expect((await prisma.task.findUnique({ where: { id: task.id } }))?.status).toBe(
        TaskStatus.pending,
      )
    })

    it('fails an idle task that never got any files', async () => {
      const empty = await uploadTask('empty')
      const fresh = await uploadTask('fresh')
      await age('tasks', empty.id, daysAgo(3))

      expect(await uploadService.abandonStaleUploads(24)).toEqual({ files: 0, tasks: 1 })
      expect((await prisma.task.findUnique({ where: { id: empty.id } }))?.status).toBe(
        TaskStatus.failed,
      )
      expect((await prisma.task.findUnique({ where: { id: fresh.id } }))?.status).toBe(
        TaskStatus.pending,
      )
    })
  })

  describe('confirmFileUpload with errorMessage', () => {
    it('should abort multipart upload in S3 and delete asset on failure', async () => {
      const task = await prisma.task.create({
        data: {
          creatorId: userId,
          type: 'upload',
          name: 'task-err',
          total: 1,
          status: TaskStatus.uploading,
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/test/fail.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'fail.mp4',
          type: AssetType.file,
          projectId,
          storageKeyId: storageKey.id,
          taskId: task.id,
          uploadId: 'upload-fail-id',
          status: AssetStatus.uploading,
        },
      })

      await uploadService.confirmFileUpload(userId, task.id, {
        fileId: asset.id,
        errorMessage: 'Network failed',
      })

      expect(s3Service.abortMultipartUpload).toHaveBeenCalledWith(
        expect.anything(),
        'files/test/fail.mp4',
        'upload-fail-id',
      )

      const deletedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(deletedAsset).toBeNull()
    })
  })
})
