import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { type User } from '@shumai/db'
import { AuditAction } from '@shumai/dtos'

const moveAssetsSchema = Type.Object({
  assetIds: Type.Array(Type.String(), {
    description:
      'The IDs of the assets to move. All assets must belong to the same parent folder. At least one asset ID is required.',
    minItems: 1,
  }),
  newParentId: Type.String({
    description:
      'The destination parent folder ID to move the assets into. This parameter is required.',
  }),
})

export function createMoveAssetsTool(
  userId: string,
  agentContext?: { teamId?: string; agentId?: string },
): AgentTool<typeof moveAssetsSchema> {
  return {
    name: 'move_assets',
    label: 'Move Assets',
    description:
      'Move one or more assets (files or folders) to a specified parent folder. Note: All assets to be moved must belong to the same current parent folder.',
    parameters: moveAssetsSchema,
    execute: async (_toolCallId, params) => {
      // Check Edit permission on destination folder
      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: params.newParentId,
      })

      // Check Edit permission on all source assets
      for (const assetId of params.assetIds) {
        await authzService.hasPermission({
          user: { id: userId } as User,
          permission: Permission.Edit,
          type: ResourceType.Asset,
          id: assetId,
        })
      }

      await assetService.reparentAssets({
        assetIds: params.assetIds,
        newParentId: params.newParentId,
        creatorId: userId,
      })

      if (agentContext?.teamId) {
        const ctx = await assetService
          .getAssetContext(params.newParentId)
          .catch(() => ({ teamId: agentContext.teamId!, projectId: undefined }))
        for (const assetId of params.assetIds) {
          await auditLogService.logAction({
            action: AuditAction.asset_reparent,
            teamId: agentContext.teamId || ctx.teamId,
            userId,
            agentId: agentContext.agentId,
            projectId: ctx.projectId,
            itemId: assetId,
          })
        }
      }

      const result = {
        success: true,
        movedAssetIds: params.assetIds,
        newParentId: params.newParentId,
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: {},
      }
    },
  }
}
