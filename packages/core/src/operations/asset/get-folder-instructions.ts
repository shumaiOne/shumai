import { getFolderInstructions } from '@shumai/operations'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { asBadRequest } from '../errors'
import { implementOperation } from '../implement'

export const getFolderInstructionsOp = implementOperation(getFolderInstructions, {
  authz: (input) => [{ permission: Permission.Read, type: ResourceType.Asset, id: input.folderId }],
  execute: async (input) => ({
    folderId: input.folderId,
    content: await asBadRequest(() => assetService.getAgentsMd(input.folderId)),
  }),
})
