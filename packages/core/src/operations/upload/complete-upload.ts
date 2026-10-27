import { HTTPException } from 'hono/http-exception'
import { completeUpload } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { pendingUploadService } from '@shumai/core/src/upload/pending-upload'
import { asBadRequest } from '../errors'
import { implementOperation } from '../implement'
import { toAssetSummary } from '../asset/to-asset-summary'

export const completeUploadOp = implementOperation(completeUpload, {
  // The upload ID is signed and names its parent; Edit on it is still checked here, so
  // losing access between starting and finishing an upload stops it.
  authz: (input, ctx) => {
    const pending = pendingUploadService.read(input.uploadId, ctx.userId)
    return [{ permission: Permission.Edit, type: ResourceType.Asset, id: pending.parentId }]
  },
  prepare: async (input, ctx) => {
    const pending = pendingUploadService.read(input.uploadId, ctx.userId)
    // Completing the same upload again returns the file it already created.
    const existing = await assetService.findAssetByStorageKey(pending.key)
    if (existing && existing.creatorId !== ctx.userId) {
      throw new HTTPException(409, { message: 'This upload was already used.' })
    }
    return { pending, existingId: existing?.id }
  },
  execute: async (_input, ctx, { pending, existingId }) => {
    if (existingId) {
      return toAssetSummary(await assetService.getAsset({ assetId: existingId }))
    }

    const size = await pendingUploadService.uploadedSize(pending.key)
    if (size === null) {
      throw new HTTPException(409, {
        message:
          'The file has not been uploaded yet: PUT its bytes to uploadUrl first, then call complete_upload again.',
      })
    }

    const params = {
      parentId: pending.parentId,
      name: pending.name,
      key: pending.key,
      sizeByte: size,
      contentType: pending.contentType,
      creatorId: ctx.userId,
      agentId: ctx.agentId,
      metadata: pending.metadata,
    }
    const asset = await asBadRequest(() =>
      pending.kind === 'file'
        ? assetService.createFile(params)
        : assetService.createVersion(params),
    )
    return toAssetSummary(asset)
  },
  audit: (_input, output, _ctx, { existingId }) =>
    existingId
      ? []
      : [{ action: AuditAction.file_create, itemId: output.id, contextAssetId: output.id }],
})
