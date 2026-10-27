import { createVersion } from '@shumai/operations'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { badRequest } from '../errors'
import { implementOperation } from '../implement'
import { assertCreationMetadata, startUpload } from './start-upload'

export const createVersionOp = implementOperation(createVersion, {
  authz: (input) => [{ permission: Permission.Edit, type: ResourceType.Asset, id: input.parent }],
  prepare: async (input, ctx) => {
    const parent = await assetService.getAssetMeta(input.parent)
    if (parent.type !== 'file' && parent.type !== 'version_stack') {
      throw badRequest(
        'parent must be a file or a version stack. To upload a new file, use create_file.',
      )
    }
    await assertCreationMetadata(ctx.userId, parent.projectId, input.metadata)
  },
  execute: (input, ctx) => startUpload('version', input, ctx),
})
