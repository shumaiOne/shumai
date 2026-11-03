import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetStatus, prisma, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  getArchiveStorageService,
  resetArchiveStorageServiceForTests,
} from '@shumai/core/src/s3/archive-storage'
import { archiveAssetWorkflow } from '../workflows/archive-asset'
import { restoreAssetWorkflow } from '../workflows/restore-asset'
import { copyOriginalToArchiveStorageActivity } from './archive'

describe('Archive & Restore Workflows and Activities', () => {
  setupTestDbHooks()

  let tmpArchiveRoot: string
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of [
      'ARCHIVE_STORAGE_BACKEND',
      'ARCHIVE_LOCAL_ROOT',
      'ARCHIVE_RESTORE_POLL_INTERVAL_MS',
    ]) {
      savedEnv[k] = process.env[k]
    }
    tmpArchiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shumai-wf-archive-'))
    process.env.ARCHIVE_STORAGE_BACKEND = 'local'
    process.env.ARCHIVE_LOCAL_ROOT = tmpArchiveRoot
    process.env.ARCHIVE_RESTORE_POLL_INTERVAL_MS = '10'
    resetArchiveStorageServiceForTests()
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) {
        delete process.env[k]
      } else {
        process.env[k] = v
      }
    }
    resetArchiveStorageServiceForTests()
    vi.restoreAllMocks()
    fs.rmSync(tmpArchiveRoot, { recursive: true, force: true })
  })

  it('archives an asset original to local archive storage, syncs shared copies, and deletes main original', async () => {
    const key = 'files/wf-test/clip.mp4'
    const payloadBytes = Buffer.from('raw-video-content-bytes-12345')
    const bucket = process.env.S3_BUCKET || 'shumai'

    await s3Service.putObject(bucket, key, payloadBytes, payloadBytes.length, 'video/mp4')

    const sk = await prisma.storageKey.create({
      data: { key, isArchived: false },
    })
    const asset1 = await prisma.asset.create({
      data: {
        name: 'clip.mp4',
        type: 'file',
        status: AssetStatus.archiving,
        sizeByte: BigInt(payloadBytes.length),
        mediaType: 'video/mp4',
        storageKeyId: sk.id,
      },
    })
    const asset2Copy = await prisma.asset.create({
      data: {
        name: 'clip-copy.mp4',
        type: 'file',
        status: AssetStatus.archiving,
        sizeByte: BigInt(payloadBytes.length),
        mediaType: 'video/mp4',
        storageKeyId: sk.id,
      },
    })
    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset1.id,
        type: WorkflowTaskType.archive_asset,
        status: WorkflowTaskStatus.pending,
        payload: { projectId: 'proj-1', archive: { storageKeyId: sk.id } },
      },
    })

    await archiveAssetWorkflow(task)

    const archiveStorage = getArchiveStorageService()!
    const archHead = await archiveStorage.headObject(key)
    expect(archHead.size).toBe(payloadBytes.length)

    await expect(s3Service.headObject(bucket, key)).rejects.toThrow('NoSuchKey')

    const updatedSk = await prisma.storageKey.findUniqueOrThrow({ where: { id: sk.id } })
    expect(updatedSk.isArchived).toBe(true)

    const updatedA1 = await prisma.asset.findUniqueOrThrow({ where: { id: asset1.id } })
    const updatedA2 = await prisma.asset.findUniqueOrThrow({ where: { id: asset2Copy.id } })
    expect(updatedA1.status).toBe(AssetStatus.archived)
    expect(updatedA2.status).toBe(AssetStatus.archived)

    const updatedTask = await prisma.workflowTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(updatedTask.status).toBe(WorkflowTaskStatus.completed)
  })

  it('restores an archived asset back to main storage, polls cold storage when needed, and deletes archive copy', async () => {
    const key = 'files/wf-test/restore-me.mp4'
    const payloadBytes = Buffer.from('restored-video-bytes-987654')
    const bucket = process.env.S3_BUCKET || 'shumai'

    const archiveStorage = getArchiveStorageService()!
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(payloadBytes))
        controller.close()
      },
    })
    await archiveStorage.uploadStream(key, webStream, payloadBytes.length, 'video/mp4')

    // Simulate one cold-storage 'restoring' poll iteration before 'ready'
    let pollCalls = 0
    vi.spyOn(archiveStorage, 'checkOrInitiateObjectRestore').mockImplementation(async () => {
      pollCalls++
      return pollCalls === 1 ? { status: 'restoring' } : { status: 'ready' }
    })

    const sk = await prisma.storageKey.create({
      data: { key, isArchived: true },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'restore-me.mp4',
        type: 'file',
        status: AssetStatus.restoring,
        sizeByte: BigInt(payloadBytes.length),
        mediaType: 'video/mp4',
        storageKeyId: sk.id,
      },
    })
    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        type: WorkflowTaskType.restore_asset,
        status: WorkflowTaskStatus.pending,
        payload: { projectId: 'proj-1', archive: { storageKeyId: sk.id } },
      },
    })

    await restoreAssetWorkflow(task)

    expect(pollCalls).toBe(2)

    const mainHead = await s3Service.headObject(bucket, key)
    expect(mainHead.size).toBe(payloadBytes.length)

    await expect(archiveStorage.headObject(key)).rejects.toThrow('NoSuchKey')

    const updatedSk = await prisma.storageKey.findUniqueOrThrow({ where: { id: sk.id } })
    expect(updatedSk.isArchived).toBe(false)

    const updatedAsset = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(updatedAsset.status).toBe(AssetStatus.processed)

    // Clean up main storage object
    await s3Service.deleteObject(bucket, key)
  })

  it('reverts asset status back to processed when archive workflow fails before commit', async () => {
    const sk = await prisma.storageKey.create({
      data: { key: 'files/wf-test/missing-in-main.mp4', isArchived: false },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'missing-in-main.mp4',
        type: 'file',
        status: AssetStatus.archiving,
        sizeByte: BigInt(500),
        mediaType: 'video/mp4',
        storageKeyId: sk.id,
      },
    })
    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        type: WorkflowTaskType.archive_asset,
        status: WorkflowTaskStatus.pending,
        payload: { projectId: 'proj-1', archive: { storageKeyId: sk.id } },
      },
    })

    await expect(archiveAssetWorkflow(task)).rejects.toThrow('Original file not found')

    const updatedAsset = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(updatedAsset.status).toBe(AssetStatus.processed)

    const updatedTask = await prisma.workflowTask.findUniqueOrThrow({ where: { id: task.id } })
    expect(updatedTask.status).toBe(WorkflowTaskStatus.failed)
  })

  it('freshly overwrites destination even if a file of matching size already exists in archive storage', async () => {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const key = 'files/wf-test/overwrite-test.mp4'
    const originalContent = 'fresh-content-12345'
    const staleContent = 'stale-content-99999'
    expect(originalContent.length).toBe(staleContent.length)

    // Put stale content into archive storage directly
    const archiveStorage = getArchiveStorageService()
    await archiveStorage.uploadStream(
      key,
      Readable.toWeb(
        Readable.from(Buffer.from(staleContent)),
      ) as unknown as ReadableStream<Uint8Array>,
      staleContent.length,
      'video/mp4',
    )

    // Put fresh content into main storage
    await s3Service.uploadStream({
      bucket,
      key,
      stream: Readable.toWeb(
        Readable.from(Buffer.from(originalContent)),
      ) as unknown as ReadableStream<Uint8Array>,
      contentLength: originalContent.length,
      contentType: 'video/mp4',
    })

    const sk = await prisma.storageKey.create({
      data: { key, isArchived: false },
    })

    await copyOriginalToArchiveStorageActivity({
      storageKeyId: sk.id,
      key,
      expectedSize: originalContent.length,
      contentType: 'video/mp4',
    })

    const { stream } = await archiveStorage.getObjectStream(key)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readStream = Readable.fromWeb(stream as any)
    const chunks: Buffer[] = []
    for await (const chunk of readStream) {
      chunks.push(Buffer.from(chunk))
    }
    const finalArchivedContent = Buffer.concat(chunks).toString('utf-8')
    expect(finalArchivedContent).toBe(originalContent)

    // Clean up
    await s3Service.deleteObject(bucket, key)
    await archiveStorage.deleteObject(key)
  })
})
