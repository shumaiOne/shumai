import { z } from 'zod'
import { defineOperation } from '../define'

export const moveAssets = defineOperation({
  name: 'move_assets',
  title: 'Move Assets',
  description:
    'Move one or more assets (files or folders) to a specified parent folder. Note: All assets ' +
    'to be moved must belong to the same current parent folder.',
  input: z.object({
    assetIds: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        'The IDs of the assets to move. All assets must belong to the same parent folder. At least one asset ID is required.',
      ),
    newParentId: z
      .string()
      .min(1)
      .describe('The destination parent folder ID to move the assets into.'),
  }),
  output: z.object({
    movedAssetIds: z.array(z.string()),
    newParentId: z.string(),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false, idempotent: true },
  cli: {
    command: ['move'],
    aliases: ['mv'],
    positional: ['assetIds'],
    flags: { newParentId: ['-p', '--parent'] },
    format: (output) =>
      `Moved ${output.movedAssetIds.length} asset(s) to parent ${output.newParentId}`,
  },
})
