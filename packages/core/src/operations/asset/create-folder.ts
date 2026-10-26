import { createFolder } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'
import { toAssetSummary } from './to-asset-summary'

export const createFolderOp = implementOperation(createFolder, {
  authz: (input) => [{ permission: Permission.Edit, type: ResourceType.Asset, id: input.parent }],
  execute: async (input, ctx) =>
    toAssetSummary(
      await assetService.createAsset({
        name: input.name,
        parentId: input.parent,
        type: 'folder',
        creatorId: ctx.userId,
        agentId: ctx.agentId,
      }),
    ),
  audit: (_input, output) => [
    { action: AuditAction.folder_create, itemId: output.id, contextAssetId: output.id },
  ],
})
