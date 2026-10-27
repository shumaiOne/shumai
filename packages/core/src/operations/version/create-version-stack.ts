import { createVersionStack } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { versionStackService } from '@shumai/core/src/versionStack/versionStack'
import { asBadRequest, badRequest } from '../errors'
import { implementOperation } from '../implement'
import { toAssetSummary } from '../asset/to-asset-summary'

export const createVersionStackOp = implementOperation(createVersionStack, {
  authz: (input) =>
    [...new Set(input.fileIds)].map((id) => ({
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id,
    })),
  // The stack belongs to the files' project.
  prepare: async (input) => {
    if (new Set(input.fileIds).size !== input.fileIds.length) {
      throw badRequest('fileIds must not contain the same file twice')
    }
    const first = await assetService.getAssetMeta(input.fileIds[0])
    if (!first.projectId) throw badRequest('The files do not belong to a project')
    return { projectId: first.projectId }
  },
  execute: async (input, ctx, { projectId }) => {
    const stack = await asBadRequest(() =>
      versionStackService.createVersionStack({
        fileIds: input.fileIds,
        projectId,
        creatorId: ctx.userId,
      }),
    )
    return toAssetSummary(await assetService.getAsset({ assetId: stack.id }))
  },
  audit: (_input, output) => [
    { action: AuditAction.version_stack_create, itemId: output.id, contextAssetId: output.id },
  ],
})
