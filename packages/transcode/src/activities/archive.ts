import { AssetStatus, prisma, WorkflowTaskStatus } from '@shumai/db'
import { logger } from '@shumai/core/src/logger'
import { revertArchiveStateForStorageKey } from '@shumai/core/src/asset/asset-archive'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  getArchiveStorageService,
  isColdStorageRestoreError,
  type ArchiveStorageService,
} from '@shumai/core/src/s3/archive-storage'
import { ApplicationFailure, defineStep } from '@shumai/workflow-core'

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const record = err as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name : ''
  const code = typeof record.code === 'string' ? record.code : ''
  const msg = typeof record.message === 'string' ? record.message : ''
  const metadata = record.$metadata as { httpStatusCode?: number } | undefined
  return (
    name === 'NotFound' ||
    name === 'NoSuchKey' ||
    code === 'NotFound' ||
    code === 'NoSuchKey' ||
    code === 'ENOENT' ||
    metadata?.httpStatusCode === 404 ||
    msg.includes('NoSuchKey') ||
    msg.includes('NotFound')
  )
}

async function tryHeadMainObject(
  bucket: string,
  key: string,
): Promise<{ exists: boolean; size?: number }> {
  try {
    const info = await s3Service.headObject(bucket, key)
    return { exists: true, size: info.size }
  } catch (err) {
    if (isNotFoundError(err)) {
      return { exists: false }
    }
    throw err
  }
}

async function tryHeadArchiveObject(
  archiveStorage: ArchiveStorageService,
  key: string,
): Promise<{ exists: boolean; size?: number }> {
  try {
    const info = await archiveStorage.headObject(key)
    return { exists: true, size: info.size }
  } catch (err) {
    if (isNotFoundError(err)) {
      return { exists: false }
    }
    throw err
  }
}

export interface PrepareArchiveOrRestoreParams {
  taskId: string
  assetId?: string | null
  storageKeyId?: string | null
  mode: 'archive' | 'restore'
}

export interface PrepareArchiveOrRestoreResult {
  noop: boolean
  storageKeyId: string
  key: string
  expectedSize: number
  contentType: string
}

export const prepareArchiveOrRestoreActivity = defineStep(
  async function prepareArchiveOrRestoreActivity(
    params: PrepareArchiveOrRestoreParams,
  ): Promise<PrepareArchiveOrRestoreResult> {
    let storageKeyId = params.storageKeyId ?? null
    if (!storageKeyId && params.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: params.assetId },
        select: { storageKeyId: true },
      })
      storageKeyId = asset?.storageKeyId ?? null
    }

    if (!storageKeyId) {
      throw ApplicationFailure.create({
        message: `StorageKey not found for ${params.mode} task ${params.taskId}`,
        nonRetryable: true,
      })
    }

    const sk = await prisma.storageKey.findUnique({
      where: { id: storageKeyId },
      include: {
        assets: {
          where: { deletedAt: null, type: 'file' },
          select: {
            id: true,
            status: true,
            sizeByte: true,
            mediaType: true,
          },
        },
      },
    })

    if (
      !sk ||
      sk.status === 'purging' ||
      sk.assets.length === 0 ||
      sk.assets.every(
        (a) => a.status === AssetStatus.trashed || a.status === AssetStatus.pending_purge,
      )
    ) {
      logger.info(
        { taskId: params.taskId, storageKeyId, mode: params.mode },
        'Skipping archive/restore task because storage key or all referencing assets are purged/trashed',
      )
      return {
        noop: true,
        storageKeyId,
        key: sk?.key || '',
        expectedSize: 0,
        contentType: 'application/octet-stream',
      }
    }

    if (params.mode === 'archive' && sk.isArchived) {
      await prisma.asset.updateMany({
        where: {
          storageKeyId: sk.id,
          deletedAt: null,
          type: 'file',
          status: { notIn: [AssetStatus.trashed, AssetStatus.pending_purge] },
        },
        data: { status: AssetStatus.archived },
      })
      return {
        noop: true,
        storageKeyId: sk.id,
        key: sk.key,
        expectedSize: 0,
        contentType: 'application/octet-stream',
      }
    }

    if (params.mode === 'restore' && !sk.isArchived) {
      await prisma.asset.updateMany({
        where: {
          storageKeyId: sk.id,
          deletedAt: null,
          type: 'file',
          status: { notIn: [AssetStatus.trashed, AssetStatus.pending_purge] },
        },
        data: { status: AssetStatus.processed },
      })
      return {
        noop: true,
        storageKeyId: sk.id,
        key: sk.key,
        expectedSize: 0,
        contentType: 'application/octet-stream',
      }
    }

    const primaryAsset =
      sk.assets.find((a) => a.id === params.assetId) ||
      sk.assets.find((a) => a.sizeByte !== null && Number(a.sizeByte) > 0) ||
      sk.assets[0]

    const expectedSize = primaryAsset?.sizeByte ? Number(primaryAsset.sizeByte) : 0
    const contentType = primaryAsset?.mediaType || 'application/octet-stream'

    return {
      noop: false,
      storageKeyId: sk.id,
      key: sk.key,
      expectedSize,
      contentType,
    }
  },
)

export interface CopyOriginalToArchiveParams {
  storageKeyId: string
  key: string
  expectedSize: number
  contentType: string
}

export const copyOriginalToArchiveStorageActivity = defineStep(
  async function copyOriginalToArchiveStorageActivity(
    params: CopyOriginalToArchiveParams,
  ): Promise<{ copiedSize: number }> {
    const archiveStorage = getArchiveStorageService()
    if (!archiveStorage) {
      throw ApplicationFailure.create({
        message: 'Archive storage is not configured',
        nonRetryable: true,
      })
    }

    const sk = await prisma.storageKey.findUnique({
      where: { id: params.storageKeyId },
      select: { status: true },
    })
    if (!sk || sk.status === 'purging') {
      throw ApplicationFailure.create({
        message: `StorageKey ${params.storageKeyId} is missing or purging`,
        nonRetryable: true,
      })
    }

    const bucket = process.env.S3_BUCKET || 'shumai'

    if (archiveStorage.isSameS3Target) {
      if (
        !archiveStorage.storageClass ||
        archiveStorage.storageClass.toUpperCase() === 'STANDARD'
      ) {
        throw ApplicationFailure.create({
          message:
            'Same-bucket S3 archive requires a non-STANDARD ARCHIVE_S3_STORAGE_CLASS to tier objects in place',
          nonRetryable: true,
        })
      }

      let objectSize = params.expectedSize
      if (objectSize <= 0) {
        const mainHead = await tryHeadMainObject(bucket, params.key)
        if (!mainHead.exists) {
          throw ApplicationFailure.create({
            message: `Original file not found in main storage: ${params.key}`,
            nonRetryable: true,
          })
        }
        objectSize = mainHead.size ?? 0
      }

      await archiveStorage.rewriteObjectStorageClassInPlace(
        params.key,
        archiveStorage.storageClass,
        objectSize,
        params.contentType,
      )

      const verifyHead = await tryHeadArchiveObject(archiveStorage, params.key)
      if (!verifyHead.exists) {
        throw ApplicationFailure.create({
          message: `Failed to verify in-place archived object in S3: ${params.key}`,
          nonRetryable: false,
        })
      }

      return { copiedSize: verifyHead.size ?? objectSize }
    }

    // Separate bucket or local archive storage:
    const mainHead = await tryHeadMainObject(bucket, params.key)
    if (!mainHead.exists) {
      throw ApplicationFailure.create({
        message: `Original file not found in main storage: ${params.key}`,
        nonRetryable: true,
      })
    }

    const resolvedExpectedSize =
      params.expectedSize > 0 ? params.expectedSize : (mainHead.size ?? 0)
    const {
      stream,
      contentLength,
      contentType: sourceContentType,
    } = await s3Service.getObjectStream(bucket, params.key)

    const uploadSize = contentLength ?? resolvedExpectedSize
    await archiveStorage.uploadStream(
      params.key,
      stream,
      uploadSize,
      sourceContentType || params.contentType,
    )

    const verifyHead = await tryHeadArchiveObject(archiveStorage, params.key)
    if (!verifyHead.exists) {
      throw ApplicationFailure.create({
        message: `Archive upload verification failed: object ${params.key} not found in archive storage`,
        nonRetryable: false,
      })
    }
    if (
      resolvedExpectedSize > 0 &&
      verifyHead.size !== undefined &&
      verifyHead.size !== resolvedExpectedSize
    ) {
      throw ApplicationFailure.create({
        message: `Archive upload size mismatch for ${params.key}: expected ${resolvedExpectedSize}, got ${verifyHead.size}`,
        nonRetryable: false,
      })
    }

    return { copiedSize: verifyHead.size ?? uploadSize }
  },
)

export const commitArchiveDbStateActivity = defineStep(
  async function commitArchiveDbStateActivity(params: { storageKeyId: string }): Promise<void> {
    await prisma.$transaction([
      prisma.storageKey.update({
        where: { id: params.storageKeyId },
        data: { isArchived: true },
      }),
      prisma.asset.updateMany({
        where: {
          storageKeyId: params.storageKeyId,
          deletedAt: null,
          type: 'file',
          status: AssetStatus.archiving,
        },
        data: { status: AssetStatus.archived },
      }),
    ])
  },
)

export const deleteMainOriginalAfterArchiveActivity = defineStep(
  async function deleteMainOriginalAfterArchiveActivity(params: { key: string }): Promise<void> {
    const archiveStorage = getArchiveStorageService()
    if (archiveStorage.isSameS3Target) {
      return
    }
    const bucket = process.env.S3_BUCKET || 'shumai'
    await s3Service.deleteObject(bucket, params.key)
  },
)

export const checkOrInitiateColdRestoreActivity = defineStep(
  async function checkOrInitiateColdRestoreActivity(params: {
    key: string
  }): Promise<{ status: 'ready' | 'restoring' }> {
    const archiveStorage = getArchiveStorageService()
    if (!archiveStorage) {
      throw ApplicationFailure.create({
        message: 'Archive storage is not configured',
        nonRetryable: true,
      })
    }
    return await archiveStorage.checkOrInitiateObjectRestore(params.key)
  },
)

export interface CopyOriginalFromArchiveToMainParams {
  storageKeyId: string
  key: string
  expectedSize: number
  contentType: string
}

export const copyOriginalFromArchiveToMainActivity = defineStep(
  async function copyOriginalFromArchiveToMainActivity(
    params: CopyOriginalFromArchiveToMainParams,
  ): Promise<{ status: 'copied' | 'restoring'; copiedSize?: number }> {
    const archiveStorage = getArchiveStorageService()
    if (!archiveStorage) {
      throw ApplicationFailure.create({
        message: 'Archive storage is not configured',
        nonRetryable: true,
      })
    }

    const sk = await prisma.storageKey.findUnique({
      where: { id: params.storageKeyId },
      select: { status: true },
    })
    if (!sk || sk.status === 'purging') {
      throw ApplicationFailure.create({
        message: `StorageKey ${params.storageKeyId} is missing or purging`,
        nonRetryable: true,
      })
    }

    const bucket = process.env.S3_BUCKET || 'shumai'

    try {
      if (archiveStorage.isSameS3Target) {
        let objectSize = params.expectedSize
        if (objectSize <= 0) {
          const archiveHead = await tryHeadArchiveObject(archiveStorage, params.key)
          if (!archiveHead.exists) {
            throw ApplicationFailure.create({
              message: `Archived file not found in S3: ${params.key}`,
              nonRetryable: true,
            })
          }
          objectSize = archiveHead.size ?? 0
        }

        await archiveStorage.rewriteObjectStorageClassInPlace(
          params.key,
          'STANDARD',
          objectSize,
          params.contentType,
        )

        const verifyHead = await tryHeadMainObject(bucket, params.key)
        if (!verifyHead.exists) {
          throw ApplicationFailure.create({
            message: `Failed to verify restored object in S3: ${params.key}`,
            nonRetryable: false,
          })
        }

        return { status: 'copied', copiedSize: verifyHead.size ?? objectSize }
      }

      // Separate bucket or local archive storage:
      const archiveHead = await tryHeadArchiveObject(archiveStorage, params.key)
      if (!archiveHead.exists) {
        throw ApplicationFailure.create({
          message: `Archived original file not found in archive storage: ${params.key}`,
          nonRetryable: true,
        })
      }

      const resolvedExpectedSize =
        params.expectedSize > 0 ? params.expectedSize : (archiveHead.size ?? 0)
      const {
        stream,
        contentLength,
        contentType: archiveContentType,
      } = await archiveStorage.getObjectStream(params.key)

      const uploadSize = contentLength ?? resolvedExpectedSize
      await s3Service.uploadStream({
        bucket,
        key: params.key,
        stream,
        contentLength: uploadSize,
        contentType: archiveContentType || params.contentType,
      })

      const verifyMainHead = await tryHeadMainObject(bucket, params.key)
      if (!verifyMainHead.exists) {
        throw ApplicationFailure.create({
          message: `Restore upload verification failed: object ${params.key} not found in main storage`,
          nonRetryable: false,
        })
      }
      if (
        resolvedExpectedSize > 0 &&
        verifyMainHead.size !== undefined &&
        verifyMainHead.size !== resolvedExpectedSize
      ) {
        throw ApplicationFailure.create({
          message: `Restore upload size mismatch for ${params.key}: expected ${resolvedExpectedSize}, got ${verifyMainHead.size}`,
          nonRetryable: false,
        })
      }

      return { status: 'copied', copiedSize: verifyMainHead.size ?? uploadSize }
    } catch (err) {
      if (isColdStorageRestoreError(err)) {
        logger.info(
          { key: params.key },
          'Encountered cold storage InvalidObjectState during restore copy; initiating RestoreObject polling',
        )
        await archiveStorage.initiateObjectRestoreExplicitly(params.key)
        return { status: 'restoring' }
      }
      throw err
    }
  },
)

export const commitRestoreDbStateActivity = defineStep(
  async function commitRestoreDbStateActivity(params: { storageKeyId: string }): Promise<void> {
    await prisma.$transaction([
      prisma.storageKey.update({
        where: { id: params.storageKeyId },
        data: { isArchived: false },
      }),
      prisma.asset.updateMany({
        where: {
          storageKeyId: params.storageKeyId,
          deletedAt: null,
          type: 'file',
          status: AssetStatus.restoring,
        },
        data: { status: AssetStatus.processed },
      }),
    ])
  },
)

export const deleteArchiveOriginalAfterRestoreActivity = defineStep(
  async function deleteArchiveOriginalAfterRestoreActivity(params: { key: string }): Promise<void> {
    const archiveStorage = getArchiveStorageService()
    if (archiveStorage.isSameS3Target) {
      return
    }
    await archiveStorage.deleteObject(params.key)
  },
)

export const revertArchiveOrRestoreStatusOnFailureActivity = defineStep(
  async function revertArchiveOrRestoreStatusOnFailureActivity(params: {
    taskId: string
    storageKeyId?: string | null
    assetId?: string | null
    errorMessage: string
  }): Promise<void> {
    let storageKeyId = params.storageKeyId ?? null
    if (!storageKeyId && params.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: params.assetId },
        select: { storageKeyId: true },
      })
      storageKeyId = asset?.storageKeyId ?? null
    }

    if (storageKeyId) {
      await revertArchiveStateForStorageKey(storageKeyId)
    }

    await prisma.workflowTask.update({
      where: { id: params.taskId },
      data: {
        status: WorkflowTaskStatus.failed,
        output: { error: params.errorMessage },
      },
    })
  },
  { runOnCancel: true },
)
