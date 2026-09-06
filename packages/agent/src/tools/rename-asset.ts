import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { type User } from '@shumai/db'
import { AuditAction } from '@shumai/dtos'

const renameAssetSchema = Type.Object({
  assetId: Type.String({
    description: 'The ID of the asset (file or folder) to rename. This parameter is required.',
  }),
  name: Type.String({
    description: 'The new name for the asset. This parameter is required.',
  }),
})

export function createRenameAssetTool(
  userId: string,
  agentContext?: { teamId?: string; agentId?: string },
): AgentTool<typeof renameAssetSchema> {
  return {
    name: 'rename_asset',
    label: 'Rename Asset',
    description: 'Rename an existing asset (file or folder).',
    parameters: renameAssetSchema,
    execute: async (_toolCallId, params) => {
      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: params.assetId,
      })

      const updatedAsset = await assetService.updateAssetName({
        id: params.assetId,
        name: params.name,
      })

      if (agentContext?.teamId) {
        const ctx = await assetService.getAssetContext(params.assetId).catch(() => ({
          teamId: agentContext.teamId!,
          projectId: updatedAsset.projectId ?? undefined,
        }))
        await auditLogService.logAction({
          action:
            updatedAsset.type === 'folder' ? AuditAction.folder_update : AuditAction.file_update,
          teamId: agentContext.teamId || ctx.teamId,
          userId,
          agentId: agentContext.agentId,
          projectId: ctx.projectId ?? updatedAsset.projectId ?? undefined,
          itemId: params.assetId,
        })
      }

      const result = {
        id: updatedAsset.id,
        name: updatedAsset.name,
        type: updatedAsset.type,
        size: Number(updatedAsset.sizeByte),
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: {},
      }
    },
  }
}
