import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { type User } from '@shumai/db'

const createFolderSchema = Type.Object({
  parent: Type.String({
    description:
      'The parent folder ID under which to create the new folder. This parameter is required.',
  }),
  name: Type.String({
    description: 'The name of the new folder to create. This parameter is required.',
  }),
})

export function createCreateFolderTool(userId: string): AgentTool<typeof createFolderSchema> {
  return {
    name: 'create_folder',
    label: 'Create Folder',
    description: 'Create a new folder in a specified parent folder.',
    parameters: createFolderSchema,
    execute: async (_toolCallId, params) => {
      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: params.parent,
      })

      const newFolder = await assetService.createAsset({
        name: params.name,
        parentId: params.parent,
        type: 'folder',
        creatorId: userId,
      })

      const result = {
        id: newFolder.id,
        name: newFolder.name,
        type: newFolder.type,
        size: Number(newFolder.sizeByte),
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: result,
      }
    },
  }
}
