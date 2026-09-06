import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { prisma, type User } from '@shumai/db'
import { AuditAction } from '@shumai/dtos'

const deleteAssetSchema = Type.Object(
  {
    assetId: Type.String({
      description:
        'The ID of the single asset (file or folder) to delete. This parameter is required.',
    }),
  },
  { additionalProperties: false },
)

export function createDeleteAssetTool(
  userId: string,
  agentContext?: { teamId?: string; agentId?: string },
): AgentTool<typeof deleteAssetSchema> {
  return {
    name: 'delete_asset',
    label: 'Delete Asset',
    description:
      'Delete a single asset (file or folder) by its ID. Can only delete one asset at a time.',
    parameters: deleteAssetSchema,
    execute: async (_toolCallId, params) => {
      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: params.assetId,
      })

      const asset = await prisma.asset.findUnique({
        where: { id: params.assetId },
        select: { id: true, type: true, projectId: true },
      })
      if (!asset) {
        throw new Error('Asset not found')
      }

      const ctx = await assetService.getAssetContext(params.assetId).catch(() => ({
        teamId: agentContext?.teamId || '',
        projectId: asset.projectId ?? undefined,
      }))

      await assetService.deleteAssets([params.assetId])

      if (agentContext?.teamId) {
        await auditLogService.logAction({
          action: asset.type === 'folder' ? AuditAction.folder_delete : AuditAction.file_delete,
          teamId: agentContext.teamId || ctx.teamId,
          userId,
          agentId: agentContext.agentId,
          projectId: ctx.projectId ?? asset.projectId ?? undefined,
          itemId: params.assetId,
        })
      }

      const result = {
        success: true,
        deletedAssetId: params.assetId,
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: {},
      }
    },
  }
}
