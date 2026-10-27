import { createFile } from '@shumai/operations'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { badRequest } from '../errors'
import { implementOperation } from '../implement'
import { assertCreationMetadata, startUpload } from './start-upload'

export const createFileOp = implementOperation(createFile, {
  authz: (input) => [{ permission: Permission.Edit, type: ResourceType.Asset, id: input.parent }],
  prepare: async (input, ctx) => {
    const parent = await assetService.getAssetMeta(input.parent)
    if (parent.type !== 'folder' && parent.type !== 'root') {
      throw badRequest(
        'parent must be a folder. To upload a new version of a file, use create_version.',
      )
    }
    await assertCreationMetadata(ctx.userId, parent.projectId, input.metadata)
  },
  execute: (input, ctx) => startUpload('file', input, ctx),
})
