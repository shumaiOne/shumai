import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { AssetStatus, prisma, WorkflowTaskType, WorkflowTaskStatus, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { projectService } from '@shumai/core/src/project/project'
import { assetService } from './asset'
import { resetArchiveStorageServiceForTests } from '../s3/archive-storage'
import {
  AutoArchiveJobService,
  autoArchiveJobService,
  getAutoArchiveIntervalMs,
} from './auto-archive-job'

describe('AutoArchiveJobService', () => {
  setupTestDbHooks()

  const archiveRoot = path.join(process.cwd(), 'data-test-auto-archive')
  let originalEnv: NodeJS.ProcessEnv
  let owner: User
  let teamId: string
  let projectId: string
  let rootFolderId: string

  beforeEach(async () => {
    originalEnv = { ...process.env }
    process.env.ARCHIVE_STORAGE_BACKEND = 'local'
    process.env.ARCHIVE_LOCAL_ROOT = archiveRoot
    resetArchiveStorageServiceForTests()

    if (fs.existsSync(archiveRoot)) {
      fs.rmSync(archiveRoot, { recursive: true, force: true })
    }

    owner = await prisma.user.create({
      data: { name: 'Auto Archive Owner', email: 'auto-archive-owner@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({
      data: {
        name: 'Auto Archive Team',
        settings: {
          autoArchive: {
            enabled: true,
            method: 'not_updated',
            days: 30,
            postRestoreGraceDays: 30,
          },
        },
      },
    })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, userId: owner.id, role: 'owner' } })

    const project = await projectService.createProject(owner, { teamId, name: 'Archive Project' })
    projectId = project.id
    rootFolderId = project.rootFolder!
  })

  afterEach(() => {
    process.env = originalEnv
    resetArchiveStorageServiceForTests()
    if (fs.existsSync(archiveRoot)) {
      fs.rmSync(archiveRoot, { recursive: true, force: true })
    }
    autoArchiveJobService.stop()
  })

  async function createTestFile(params: {
    name: string
    key: string
    createdAt?: Date
    updatedAt?: Date
    status?: AssetStatus
  }) {
    const asset = await assetService.createAsset({
      name: params.name,
      type: 'file',
      parentId: rootFolderId,
      projectId,
      key: params.key,
      sizeByte: 2048,
      contentType: 'video/mp4',
      creatorId: owner.id,
    })

    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: params.status ?? AssetStatus.processed,
        createdAt: params.createdAt ?? new Date(),
        updatedAt: params.updatedAt ?? new Date(),
      },
      include: { storageKey: true },
    })

    return updated
  }

  describe('getAutoArchiveIntervalMs', () => {
    it('returns default 1 hour (3600000ms) when env not specified', () => {
      delete process.env.AUTO_ARCHIVE_INTERVAL_MINUTES
      expect(getAutoArchiveIntervalMs()).toBe(3600000)
    })

    it('parses integer minute strings', () => {
      process.env.AUTO_ARCHIVE_INTERVAL_MINUTES = '30'
      expect(getAutoArchiveIntervalMs()).toBe(1800000)
    })

    it('parses decimal floating point minute strings', () => {
      process.env.AUTO_ARCHIVE_INTERVAL_MINUTES = '0.02'
      expect(getAutoArchiveIntervalMs()).toBe(1200)
    })
  })

  it('skips scan when archive storage is not configured', async () => {
    delete process.env.ARCHIVE_STORAGE_BACKEND
    resetArchiveStorageServiceForTests()

    const job = new AutoArchiveJobService()
    const res = await job.processAutoArchive()
    expect(res.archivedCount).toBe(0)
  })

  it('skips teams where autoArchive is disabled', async () => {
    await prisma.team.update({
      where: { id: teamId },
      data: {
        settings: {
          autoArchive: {
            enabled: false,
            method: 'not_updated',
            days: 30,
            postRestoreGraceDays: 30,
          },
        },
      },
    })

    const oldDate = new Date(Date.now() - 40 * 86_400_000)
    await createTestFile({
      name: 'old-file.mp4',
      key: 'files/test/old-file.mp4',
      updatedAt: oldDate,
    })

    const job = new AutoArchiveJobService()
    const res = await job.processAutoArchive()
    expect(res.archivedCount).toBe(0)
  })

  it('archives assets exceeding not_updated threshold while leaving recent assets untouched', async () => {
    const oldDate = new Date(Date.now() - 35 * 86_400_000)
    const recentDate = new Date(Date.now() - 5 * 86_400_000)

    const oldFile = await createTestFile({
      name: 'old-file.mp4',
      key: 'files/test/old-file.mp4',
      updatedAt: oldDate,
    })

    const recentFile = await createTestFile({
      name: 'recent-file.mp4',
      key: 'files/test/recent-file.mp4',
      updatedAt: recentDate,
    })

    const job = new AutoArchiveJobService()
    const res = await job.processAutoArchive()

    expect(res.archivedCount).toBe(1)

    const refreshedOld = await prisma.asset.findUniqueOrThrow({ where: { id: oldFile.id } })
    const refreshedRecent = await prisma.asset.findUniqueOrThrow({ where: { id: recentFile.id } })

    expect(refreshedOld.status).toBe(AssetStatus.archiving)
    expect(refreshedRecent.status).toBe(AssetStatus.processed)

    const task = await prisma.workflowTask.findFirst({
      where: { assetId: oldFile.id, type: WorkflowTaskType.archive_asset },
    })
    expect(task).not.toBeNull()
    expect(task?.status).toBe(WorkflowTaskStatus.pending)
  })

  it('archives assets exceeding after_created threshold and respects postRestoreGraceDays', async () => {
    await prisma.team.update({
      where: { id: teamId },
      data: {
        settings: {
          autoArchive: {
            enabled: true,
            method: 'after_created',
            days: 30,
            postRestoreGraceDays: 14,
          },
        },
      },
    })

    const oldCreatedDate = new Date(Date.now() - 45 * 86_400_000)
    const recentlyRestoredDate = new Date(Date.now() - 2 * 86_400_000)
    const oldRestoredDate = new Date(Date.now() - 20 * 86_400_000)

    // Old creation, but restored 2 days ago (within 14-day grace period) -> should NOT archive
    const restoredRecently = await createTestFile({
      name: 'restored-recently.mp4',
      key: 'files/test/restored-recently.mp4',
      createdAt: oldCreatedDate,
      updatedAt: recentlyRestoredDate,
    })

    // Old creation, restored 20 days ago (> 14-day grace period) -> SHOULD archive
    const restoredLongAgo = await createTestFile({
      name: 'restored-long-ago.mp4',
      key: 'files/test/restored-long-ago.mp4',
      createdAt: oldCreatedDate,
      updatedAt: oldRestoredDate,
    })

    const job = new AutoArchiveJobService()
    const res = await job.processAutoArchive()

    expect(res.archivedCount).toBe(1)

    const refreshedRecently = await prisma.asset.findUniqueOrThrow({
      where: { id: restoredRecently.id },
    })
    const refreshedLongAgo = await prisma.asset.findUniqueOrThrow({
      where: { id: restoredLongAgo.id },
    })

    expect(refreshedRecently.status).toBe(AssetStatus.processed)
    expect(refreshedLongAgo.status).toBe(AssetStatus.archiving)
  })

  it('skips storage key if any sibling file sharing the key was recently modified', async () => {
    const oldDate = new Date(Date.now() - 40 * 86_400_000)
    const recentDate = new Date()

    const sharedKey = 'files/test/shared-video.mp4'

    const primaryFile = await createTestFile({
      name: 'primary.mp4',
      key: sharedKey,
      updatedAt: oldDate,
    })

    // Create a sibling copy sharing the same storageKeyId but modified recently
    const siblingCopy = await assetService.createAsset({
      name: 'sibling-copy.mp4',
      type: 'file',
      parentId: rootFolderId,
      projectId,
      key: sharedKey,
      sizeByte: 2048,
      contentType: 'video/mp4',
      creatorId: owner.id,
    })

    await prisma.asset.update({
      where: { id: siblingCopy.id },
      data: {
        status: AssetStatus.processed,
        updatedAt: recentDate,
      },
    })

    const job = new AutoArchiveJobService()
    const res = await job.processAutoArchive()

    expect(res.archivedCount).toBe(0)

    const refreshedPrimary = await prisma.asset.findUniqueOrThrow({
      where: { id: primaryFile.id },
    })
    expect(refreshedPrimary.status).toBe(AssetStatus.processed)
  })

  it('handles race conditions: concurrent archive attempts cleanly serialize without duplicate tasks', async () => {
    const oldDate = new Date(Date.now() - 50 * 86_400_000)
    const file = await createTestFile({
      name: 'concurrent-test.mp4',
      key: 'files/test/concurrent-test.mp4',
      updatedAt: oldDate,
    })

    const job = new AutoArchiveJobService()

    // Trigger auto-archive and manual archive concurrently
    const [jobRes, manualRes] = await Promise.all([
      job.processAutoArchive(),
      assetService.archiveAssets([file.id], { suppressBusyErrors: true }),
    ])

    // Together they should archive the asset exactly once
    const totalArchived = jobRes.archivedCount + manualRes.archivedAssetIds.length
    expect(totalArchived).toBeGreaterThanOrEqual(1)

    // Verify exactly ONE WorkflowTask was created
    const tasks = await prisma.workflowTask.findMany({
      where: { assetId: file.id, type: WorkflowTaskType.archive_asset },
    })
    expect(tasks).toHaveLength(1)

    const refreshedFile = await prisma.asset.findUniqueOrThrow({ where: { id: file.id } })
    expect(refreshedFile.status).toBe(AssetStatus.archiving)
  })

  it('can start and stop without errors', () => {
    const job = new AutoArchiveJobService()
    job.start(1000, 5000)
    job.stop()
  })
})
