import { z } from 'zod'
import { defineOperation } from '../define'
import { assetSummarySchema } from '../schemas'

export const renameAsset = defineOperation({
  name: 'rename_asset',
  title: 'Rename Asset',
  description: 'Rename an existing asset (file or folder).',
  input: z.object({
    assetId: z.string().min(1).describe('The ID of the asset (file or folder) to rename.'),
    name: z.string().min(1).describe('The new name for the asset.'),
  }),
  output: assetSummarySchema,
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false, idempotent: true },
  cli: {
    command: ['rename'],
    positional: ['assetId', 'name'],
    format: (output) => `Renamed asset ${output.id} to "${output.name}"`,
  },
})
