import { removeVersion } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { versionStackService } from '@shumai/core/src/versionStack/versionStack'
import { asBadRequest, badRequest } from '../errors'
import { implementOperation } from '../implement'

export const removeVersionOp = implementOperation(removeVersion, {
  // Editing the version means editing its stack: both are in the same project.
  authz: (input) => [
    { permission: Permission.Edit, type: ResourceType.Asset, id: input.versionId },
  ],
  prepare: async (input) => {
    const version = await assetService.getAssetMeta(input.versionId)
    const stack = version.parentId ? await assetService.getAssetMeta(version.parentId) : null
    if (stack?.type !== 'version_stack') throw badRequest('This file is not in a version stack')
    return { stackId: stack.id }
  },
  execute: async (input, _ctx, { stackId }) => {
    await asBadRequest(() =>
      versionStackService.removeVersionFromStack({ stackId, fileId: input.versionId }),
    )
    return { versionId: input.versionId, stackId }
  },
  audit: (input, output) => [
    {
      action: AuditAction.version_stack_update,
      itemId: output.stackId,
      contextAssetId: input.versionId,
    },
  ],
})
