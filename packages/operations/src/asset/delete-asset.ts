import { z } from 'zod'
import { defineOperation } from '../define'

export const deleteAsset = defineOperation({
  name: 'delete_asset',
  title: 'Delete Asset',
  description:
    'Delete a single asset (file or folder) by its ID. Can only delete one asset at a time. ' +
    'Deleted assets are moved to the project trash.',
  input: z.object({
    assetId: z.string().min(1).describe('The ID of the single asset (file or folder) to delete.'),
  }),
  output: z.object({
    deletedAssetId: z.string(),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: true },
  cli: {
    command: ['delete'],
    aliases: ['rm'],
    positional: ['assetId'],
    format: (output) => `Deleted asset ${output.deletedAssetId}`,
  },
})
