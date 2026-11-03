import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  AssetStatus,
  AssetType,
  prisma,
  WorkflowTaskStatus,
  WorkflowTaskType,
  type User,
} from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { projectService } from '@shumai/core/src/project/project'
import { assetService } from './asset'
import { searchService } from '../search/search'
import { resetArchiveStorageServiceForTests, getArchiveStorageService } from '../s3/archive-storage'

describe('AssetService Archive & Restore', () => {
  setupTestDbHooks()

  const archiveRoot = path.join(process.cwd(), 'data-test-asset-archive')
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
      data: { name: 'Archive Owner', email: 'archive-owner@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'Archive Team' } })
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
  })

  async function createProcessedFile(params: {
    name: string
    parentId?: string
    key: string
    media?: Partial<PrismaJson.MediaInfo>
    isArchived?: boolean
    status?: AssetStatus
  }) {
    const asset = await assetService.createAsset({
      name: params.name,
      type: 'file',
      parentId: params.parentId ?? rootFolderId,
      projectId,
      key: params.key,
      sizeByte: 1024,
      contentType: 'video/mp4',
      creatorId: owner.id,
    })

    if (params.isArchived) {
      await prisma.storageKey.update({
        where: { key: params.key },
        data: { isArchived: true },
      })
    }

    const fullMedia: PrismaJson.MediaInfo | undefined = params.media
      ? {
          duration: 0,
          filesize: 1024,
          frames: 0,
          finishedAt: '2026-01-01T00:00:00Z',
          metadata: null,
          original: null,
          imageTranscodes: [],
          videoTranscodes: [],
          ...params.media,
        }
      : undefined

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: params.status ?? (params.isArchived ? AssetStatus.archived : AssetStatus.processed),
        ...(fullMedia ? { media: fullMedia } : {}),
      },
    })

    return prisma.asset.findUniqueOrThrow({
      where: { id: asset.id },
      include: { storageKey: true },
    })
  }

  it('rejects archive and restore when ARCHIVE_STORAGE_BACKEND is not configured', async () => {
    delete process.env.ARCHIVE_STORAGE_BACKEND
    resetArchiveStorageServiceForTests()

    const file = await createProcessedFile({
      name: 'clip.mp4',
      key: 'files/01TEST/clip.mp4',
    })

    await expect(assetService.archiveAssets([file.id])).rejects.toMatchObject({
      status: 400,
      message: 'Archive storage is not configured',
    })
    await expect(assetService.restoreArchivedAssets([file.id])).rejects.toMatchObject({
      status: 400,
      message: 'Archive storage is not configured',
    })
  })

  it('archives and restores standalone files, deduplicating shared StorageKey across copies and updating all copies', async () => {
    const file = await createProcessedFile({
      name: 'shared.mp4',
      key: 'files/01SHARED/shared.mp4',
    })

    const subFolder = await assetService.createAsset({
      name: 'Copies',
      type: 'folder',
      parentId: rootFolderId,
      projectId,
      creatorId: owner.id,
    })
    const [copiedId] = await assetService.copyAssets({
      assetIds: [file.id],
      newParentId: subFolder.id,
      creatorId: owner.id,
      withComments: false,
    })

    // Archive original -> both original and copy share the StorageKey, so both transition to 'archiving' with 1 WorkflowTask
    const archiveRes = await assetService.archiveAssets([file.id, copiedId])
    expect(archiveRes.archivedAssetIds.sort()).toEqual([file.id, copiedId].sort())
    expect(archiveRes.taskIds).toHaveLength(1)
    expect(archiveRes.skippedCount).toBe(0)

    const updatedRows = await prisma.asset.findMany({
      where: { id: { in: [file.id, copiedId] } },
    })
    expect(updatedRows.map((r) => r.status)).toEqual([AssetStatus.archiving, AssetStatus.archiving])

    const task = await prisma.workflowTask.findUniqueOrThrow({
      where: { id: archiveRes.taskIds[0] },
    })
    expect(task.type).toBe(WorkflowTaskType.archive_asset)
    expect(task.payload?.archive?.storageKeyId).toBe(file.storageKeyId)

    // Simulate workflow completion -> StorageKey.isArchived = true, Asset.status = 'archived'
    await prisma.storageKey.update({
      where: { id: file.storageKeyId! },
      data: { isArchived: true },
    })
    await prisma.asset.updateMany({
      where: { storageKeyId: file.storageKeyId! },
      data: { status: AssetStatus.archived },
    })
    await prisma.workflowTask.update({
      where: { id: task.id },
      data: { status: WorkflowTaskStatus.completed },
    })

    // Restore from archive via the copy -> both transition to 'restoring' with 1 restore_asset task
    const restoreRes = await assetService.restoreArchivedAssets([copiedId])
    expect(restoreRes.restoredAssetIds.sort()).toEqual([file.id, copiedId].sort())
    expect(restoreRes.taskIds).toHaveLength(1)

    const restoringRows = await prisma.asset.findMany({
      where: { id: { in: [file.id, copiedId] } },
    })
    expect(restoringRows.map((r) => r.status)).toEqual([
      AssetStatus.restoring,
      AssetStatus.restoring,
    ])
  })

  it('recursively archives and restores folders and version stacks without mutating folder or version_stack DB status', async () => {
    const folder = await assetService.createAsset({
      name: 'Shoot Day 1',
      type: 'folder',
      parentId: rootFolderId,
      projectId,
      creatorId: owner.id,
    })

    const v1 = await createProcessedFile({
      name: 'cut_v1.mp4',
      parentId: folder.id,
      key: 'files/01V1/cut_v1.mp4',
    })
    const v2 = await createProcessedFile({
      name: 'cut_v2.mp4',
      parentId: folder.id,
      key: 'files/01V2/cut_v2.mp4',
    })

    // Stack v2 onto v1 to create a version_stack inside folder
    await assetService.reparentAssets({
      assetIds: [v2.id],
      newParentId: v1.id,
      creatorId: owner.id,
    })

    const v1Reloaded = await prisma.asset.findUniqueOrThrow({ where: { id: v1.id } })
    const stackId = v1Reloaded.parentId!
    const stackRowBefore = await prisma.asset.findUniqueOrThrow({ where: { id: stackId } })
    expect(stackRowBefore.type).toBe(AssetType.version_stack)
    expect(stackRowBefore.status).toBe(AssetStatus.uploaded)

    // Archive the parent folder
    const archiveRes = await assetService.archiveAssets([folder.id])
    expect(archiveRes.archivedAssetIds.sort()).toEqual([v1.id, v2.id].sort())
    expect(archiveRes.taskIds).toHaveLength(2)

    // Verify folder and version_stack DB statuses remain 'uploaded'
    const folderAfter = await prisma.asset.findUniqueOrThrow({ where: { id: folder.id } })
    const stackAfter = await prisma.asset.findUniqueOrThrow({ where: { id: stackId } })
    expect(folderAfter.status).toBe(AssetStatus.uploaded)
    expect(stackAfter.status).toBe(AssetStatus.uploaded)

    // Mark both versions as 'archived' and verify version_stack AssetInfo reflects latestVersion status ('archived')
    await prisma.storageKey.updateMany({
      where: { id: { in: [v1.storageKeyId!, v2.storageKeyId!] } },
      data: { isArchived: true },
    })
    await prisma.asset.updateMany({
      where: { id: { in: [v1.id, v2.id] } },
      data: { status: AssetStatus.archived },
    })

    const stackInfo = await assetService.getAsset({ assetId: stackId })
    expect(stackInfo.status).toBe(AssetStatus.archived)
    expect(stackInfo.versionStack?.versions.map((v) => v.status)).toEqual([
      AssetStatus.archived,
      AssetStatus.archived,
    ])
  })

  it('omits original.url and native PDF pdfTranscode.url when archived, while keeping Office proxy.pdf url', async () => {
    const nativePdf = await createProcessedFile({
      name: 'script.pdf',
      key: 'files/01PDF/script.pdf',
      isArchived: true,
      media: {
        proxyType: 'pdf',
        original: { key: 'files/01PDF/script.pdf', filesizeInBytes: 1024, codec: '' },
        pdfTranscode: { key: 'files/01PDF/script.pdf' },
        videoTranscodes: [],
        imageTranscodes: [],
      },
    })

    const officeDoc = await createProcessedFile({
      name: 'deck.pptx',
      key: 'files/01PPTX/deck.pptx',
      isArchived: true,
      media: {
        proxyType: 'pdf',
        original: { key: 'files/01PPTX/deck.pptx', filesizeInBytes: 2048, codec: '' },
        pdfTranscode: { key: 'files/01PPTX/proxy.pdf' },
        videoTranscodes: [],
        imageTranscodes: [],
      },
    })

    const nativePdfInfo = await assetService.getAsset({ assetId: nativePdf.id })
    expect(nativePdfInfo.media?.original?.key).toBe('files/01PDF/script.pdf')
    expect(nativePdfInfo.media?.pdfTranscode?.url).toBeUndefined()

    const officeDocInfo = await assetService.getAsset({ assetId: officeDoc.id })
    expect(officeDocInfo.media?.original?.key).toBe('files/01PPTX/deck.pptx')
    expect(officeDocInfo.media?.pdfTranscode?.url).toBeDefined()
  })

  it('blocks original file download via getDownloadUrl with 409 when archived, while allowing proxy keys, and skips archived files in getDownloadLinks', async () => {
    const archivedVideo = await createProcessedFile({
      name: 'archived.mp4',
      key: 'files/01VID/archived.mp4',
      isArchived: true,
      media: {
        proxyType: 'video',
        original: { key: 'files/01VID/archived.mp4', filesizeInBytes: 1024, codec: 'h264' },
        videoTranscodes: [
          {
            resolution: '720p',
            key: 'files/01VID/archived-720p.mp4',
            width: 1280,
            height: 720,
          },
        ],
        imageTranscodes: [],
      },
    })
    const hotVideo = await createProcessedFile({
      name: 'hot.mp4',
      key: 'files/01HOT/hot.mp4',
      isArchived: false,
    })

    // Original key is blocked with 409
    await expect(
      assetService.getDownloadUrl(archivedVideo.id, 'files/01VID/archived.mp4'),
    ).rejects.toMatchObject({
      status: 409,
    })

    // Proxy key in same asset folder is allowed
    const proxyUrl = await assetService.getDownloadUrl(
      archivedVideo.id,
      'files/01VID/archived-720p.mp4',
    )
    expect(proxyUrl).toContain('archived-720p.mp4')

    // Batch getDownloadLinks skips archivedVideo and returns hotVideo + skippedArchivedCount = 1
    const links = await assetService.getDownloadLinks([archivedVideo.id, hotVideo.id])
    expect(links.files).toHaveLength(1)
    expect(links.files[0].id).toBe(hotVideo.id)
    expect(links.skippedArchivedCount).toBe(1)
  })

  it('preserves archived status when restoring from Trash and when copying assets, and purges archive storage during GC', async () => {
    const archivedFile = await createProcessedFile({
      name: 'cold.mp4',
      key: 'files/01COLD/cold.mp4',
      isArchived: true,
    })

    // Write physical file into local archive storage
    const archiveStorage = getArchiveStorageService()
    await archiveStorage.uploadStream(
      'files/01COLD/cold.mp4',
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('cold bytes'))
          c.close()
        },
      }),
      10,
      'video/mp4',
    )

    // Copy archived asset -> new copy has status 'archived'
    const targetFolder = await assetService.createAsset({
      name: 'Target',
      type: 'folder',
      parentId: rootFolderId,
      projectId,
      creatorId: owner.id,
    })
    const [copiedId] = await assetService.copyAssets({
      assetIds: [archivedFile.id],
      newParentId: targetFolder.id,
      creatorId: owner.id,
      withComments: false,
    })
    const copiedRow = await prisma.asset.findUniqueOrThrow({ where: { id: copiedId } })
    expect(copiedRow.status).toBe(AssetStatus.archived)

    // Delete and restore from Trash -> status returns to 'archived' (not 'processed')
    await assetService.deleteAssets([archivedFile.id])
    const trashedRow = await prisma.asset.findUniqueOrThrow({ where: { id: archivedFile.id } })
    expect(trashedRow.status).toBe(AssetStatus.trashed)

    await assetService.restoreAssets([archivedFile.id])
    const restoredFromTrash = await prisma.asset.findUniqueOrThrow({
      where: { id: archivedFile.id },
    })
    expect(restoredFromTrash.status).toBe(AssetStatus.archived)

    // Filter via SearchService with isArchived condition
    const archivedSearch = await searchService.search(rootFolderId, {
      operator: 'AND',
      conditions: [{ field: 'isArchived', operator: 'eq', value: true }],
      recursively: true,
      isSemantic: false,
    })
    expect(archivedSearch.data.map((d) => d.id).sort()).toEqual([archivedFile.id, copiedId].sort())

    const unarchivedSearch = await searchService.search(rootFolderId, {
      operator: 'AND',
      conditions: [{ field: 'isArchived', operator: 'eq', value: false }],
      recursively: true,
      isSemantic: false,
    })
    expect(unarchivedSearch.data.map((d) => d.id)).toEqual([])

    // Purge both assets and run GC -> file is deleted from archive storage too
    await assetService.deleteAssets([archivedFile.id, copiedId])
    await prisma.storageKey.update({
      where: { id: archivedFile.storageKeyId! },
      data: { createdAt: new Date(Date.now() - 60_000) },
    })
    await assetService.emptyTrash(projectId)

    await expect(archiveStorage.headObject('files/01COLD/cold.mp4')).rejects.toThrow(/NoSuchKey/)
    const skAfter = await prisma.storageKey.findUnique({
      where: { id: archivedFile.storageKeyId! },
    })
    expect(skAfter).toBeNull()
  })

  it('refuses to archive when a sibling copy sharing storageKeyId is processing or has an active task', async () => {
    const originalFile = await createProcessedFile({
      name: 'original.mp4',
      key: 'files/01SIB/original.mp4',
    })

    // Sibling copy sharing the same storageKeyId
    const siblingFile = await prisma.asset.create({
      data: {
        name: 'sibling.mp4',
        type: AssetType.file,
        status: AssetStatus.processing,
        storageKeyId: originalFile.storageKeyId,
        projectId,
        parentId: rootFolderId,
        creatorId: owner.id,
      },
    })

    // Trying to archive originalFile when siblingFile is processing throws 409
    await expect(assetService.archiveAssets([originalFile.id])).rejects.toMatchObject({
      status: 409,
      message: 'Only processed assets can be archived',
    })

    // Now set sibling to processed, but give it an active workflowTask
    await prisma.asset.update({
      where: { id: siblingFile.id },
      data: { status: AssetStatus.processed },
    })
    const activeTask = await prisma.workflowTask.create({
      data: {
        assetId: siblingFile.id,
        type: WorkflowTaskType.transcode,
        status: WorkflowTaskStatus.processing,
        projectId,
        teamId,
      },
    })

    await expect(assetService.archiveAssets([originalFile.id])).rejects.toMatchObject({
      status: 409,
      message: 'Cannot archive asset while a workflow task is in progress',
    })

    // Once task completes, archive succeeds
    await prisma.workflowTask.update({
      where: { id: activeTask.id },
      data: { status: WorkflowTaskStatus.completed },
    })
    const res = await assetService.archiveAssets([originalFile.id])
    expect(res.archivedAssetIds.sort()).toEqual([originalFile.id, siblingFile.id].sort())
  })

  it('ignores symlinks inside folders during recursive folder archiving', async () => {
    const folder = await assetService.createAsset({
      name: 'archive-folder',
      type: 'folder',
      parentId: rootFolderId,
      projectId,
      creatorId: owner.id,
    })

    const realFile = await createProcessedFile({
      name: 'nested-real.mp4',
      key: 'files/01NEST/nested-real.mp4',
      parentId: folder.id,
    })

    // External target file
    const externalFile = await createProcessedFile({
      name: 'external.mp4',
      key: 'files/01EXT/external.mp4',
      parentId: rootFolderId,
    })

    // Create a symlink inside the folder pointing to externalFile
    await prisma.asset.create({
      data: {
        name: 'symlink-inside.mp4',
        type: AssetType.symlink,
        status: AssetStatus.processed,
        projectId,
        parentId: folder.id,
        targetId: externalFile.id,
        creatorId: owner.id,
      },
    })

    const res = await assetService.archiveAssets([folder.id])
    // Only realFile should be archived, NOT externalFile
    expect(res.archivedAssetIds).toEqual([realFile.id])

    const extRow = await prisma.asset.findUniqueOrThrow({ where: { id: externalFile.id } })
    expect(extRow.status).toBe(AssetStatus.processed)
  })
})
