import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { AssetStatus, prisma, WorkflowTaskStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueArchive } from '@shumai/workflow-core'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { assetService } from '@shumai/core/src/asset/asset'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  getArchiveStorageService,
  resetArchiveStorageServiceForTests,
} from '@shumai/core/src/s3/archive-storage'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

describe('Workflow E2E - archiveAssetWorkflow & restoreAssetWorkflow', () => {
  setupTestDbHooks()

  const bucket = 'shumai-e2e-test-bucket-archive'
  let archiveRootDir: string

  beforeAll(async () => {
    archiveRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shumai-e2e-archive-'))
    process.env.S3_BUCKET = bucket
    process.env.ARCHIVE_STORAGE_BACKEND = 'local'
    process.env.ARCHIVE_LOCAL_ROOT = archiveRootDir
    resetArchiveStorageServiceForTests()

    initTranscodeWorkflows()
    await workflowService.startWorkers(TaskQueueArchive)
  })

  afterAll(async () => {
    await workflowService.shutdownWorkers()
    workflowService.close()
    vi.restoreAllMocks()
    resetArchiveStorageServiceForTests()
    delete process.env.ARCHIVE_STORAGE_BACKEND
    delete process.env.ARCHIVE_LOCAL_ROOT
    try {
      await s3Service.deletePrefix(bucket, '')
    } catch {
      // ignore cleanup errors
    }
    if (archiveRootDir && fs.existsSync(archiveRootDir)) {
      fs.rmSync(archiveRootDir, { recursive: true, force: true })
    }
  })

  async function waitForTaskCompletion(taskId: string, timeoutMs = 15000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const task = await prisma.workflowTask.findUnique({ where: { id: taskId } })
      if (task?.status === WorkflowTaskStatus.completed) return task
      if (task?.status === WorkflowTaskStatus.failed) {
        throw new Error(`Workflow task ${taskId} failed: ${JSON.stringify(task.output)}`)
      }
      await new Promise((r) => setTimeout(r, 150))
    }
    throw new Error(`Timed out waiting for workflow task ${taskId}`)
  }

  it('archives an asset and its shared-StorageKey copy via DBOS workflow, keeps proxy in main storage, and restores back to main storage', async () => {
    const team = await prisma.team.create({
      data: { name: 'E2E Archive Team' },
    })
    const rootFolder = await prisma.asset.create({
      data: { name: 'root', type: 'root', status: 'uploaded' },
    })
    const project = await prisma.project.create({
      data: { name: 'E2E Archive Project', teamId: team.id, rootFolderId: rootFolder.id },
    })
    await prisma.asset.update({
      where: { id: rootFolder.id },
      data: { projectId: project.id },
    })

    const originalKey = 'files/e2e-arch-1/master.mp4'
    const proxyKey = 'files/e2e-arch-1/proxy-720p.mp4'
    const originalBytes = Buffer.from('original-raw-video-bytes-for-e2e-archive-workflow')
    const proxyBytes = Buffer.from('proxy-720p-video-bytes')

    await s3Service.putObject(bucket, originalKey, originalBytes, originalBytes.length, 'video/mp4')
    await s3Service.putObject(bucket, proxyKey, proxyBytes, proxyBytes.length, 'video/mp4')

    const storageKey = await prisma.storageKey.create({
      data: { key: originalKey, isArchived: false },
    })

    const asset1 = await prisma.asset.create({
      data: {
        name: 'master.mp4',
        type: 'file',
        mediaType: 'video/mp4',
        status: AssetStatus.processed,
        sizeByte: BigInt(originalBytes.length),
        projectId: project.id,
        parentId: rootFolder.id,
        storageKeyId: storageKey.id,
        media: {
          duration: 5,
          filesize: originalBytes.length,
          frames: 150,
          finishedAt: new Date().toISOString(),
          proxyType: 'video',
          imageTranscodes: [],
          videoTranscodes: [
            {
              key: proxyKey,
              width: 1280,
              height: 720,
              resolution: '720p',
            },
          ],
          metadata: null,
          original: {
            key: originalKey,
            filesizeInBytes: originalBytes.length,
            codec: 'h264',
          },
        },
      },
    })

    const asset2Copy = await prisma.asset.create({
      data: {
        name: 'master-copy.mp4',
        type: 'file',
        mediaType: 'video/mp4',
        status: AssetStatus.processed,
        sizeByte: BigInt(originalBytes.length),
        projectId: project.id,
        parentId: rootFolder.id,
        storageKeyId: storageKey.id,
      },
    })

    // 1. Trigger archive via assetService.archiveAssets
    const archiveRes = await assetService.archiveAssets([asset1.id])
    expect(archiveRes.archivedAssetIds.sort()).toEqual([asset1.id, asset2Copy.id].sort())
    expect(archiveRes.taskIds).toHaveLength(1)

    await waitForTaskCompletion(archiveRes.taskIds[0])

    // Verify original moved to archive storage and removed from main storage
    const archiveStorage = getArchiveStorageService()!
    const archivedHead = await archiveStorage.headObject(originalKey)
    expect(archivedHead.size).toBe(originalBytes.length)
    await expect(s3Service.headObject(bucket, originalKey)).rejects.toThrow('NoSuchKey')

    // Verify proxy remains intact in main storage
    const proxyHead = await s3Service.headObject(bucket, proxyKey)
    expect(proxyHead.size).toBe(proxyBytes.length)

    // Verify DB states for StorageKey and both Asset rows
    const skAfterArchive = await prisma.storageKey.findUniqueOrThrow({
      where: { id: storageKey.id },
    })
    expect(skAfterArchive.isArchived).toBe(true)

    const a1AfterArchive = await prisma.asset.findUniqueOrThrow({ where: { id: asset1.id } })
    const a2AfterArchive = await prisma.asset.findUniqueOrThrow({ where: { id: asset2Copy.id } })
    expect(a1AfterArchive.status).toBe(AssetStatus.archived)
    expect(a2AfterArchive.status).toBe(AssetStatus.archived)

    // 2. Trigger restore via assetService.restoreArchivedAssets
    const restoreRes = await assetService.restoreArchivedAssets([asset2Copy.id])
    expect(restoreRes.restoredAssetIds.sort()).toEqual([asset1.id, asset2Copy.id].sort())
    expect(restoreRes.taskIds).toHaveLength(1)

    await waitForTaskCompletion(restoreRes.taskIds[0])

    // Verify original moved back to main storage and removed from archive storage
    const restoredMainHead = await s3Service.headObject(bucket, originalKey)
    expect(restoredMainHead.size).toBe(originalBytes.length)
    await expect(archiveStorage.headObject(originalKey)).rejects.toThrow('NoSuchKey')

    // Verify DB states after restore
    const skAfterRestore = await prisma.storageKey.findUniqueOrThrow({
      where: { id: storageKey.id },
    })
    expect(skAfterRestore.isArchived).toBe(false)

    const a1AfterRestore = await prisma.asset.findUniqueOrThrow({ where: { id: asset1.id } })
    const a2AfterRestore = await prisma.asset.findUniqueOrThrow({ where: { id: asset2Copy.id } })
    expect(a1AfterRestore.status).toBe(AssetStatus.processed)
    expect(a2AfterRestore.status).toBe(AssetStatus.processed)
  })
})
