import { z } from 'zod'
import { defineOperation } from '../define'

export const copyAssets = defineOperation({
  name: 'copy_assets',
  title: 'Copy Assets',
  description:
    'Copy one or more files or folders (with everything inside them) into a folder of the ' +
    'same team, e.g. into another project. The originals are left unchanged. Returns the IDs ' +
    'of the copies, in the same order as assetIds.',
  input: z.object({
    assetIds: z
      .array(z.string().min(1))
      .min(1)
      .describe('The IDs of the files or folders to copy. At least one asset ID is required.'),
    newParentId: z.string().min(1).describe('The destination folder ID to copy the assets into.'),
    withComments: z
      .boolean()
      .optional()
      .describe('Also copy the comments on the files (default false).'),
  }),
  output: z.object({
    copiedAssetIds: z.array(z.string()).describe('IDs of the copies, in the order of assetIds.'),
    newParentId: z.string(),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false },
  cli: {
    command: ['copy'],
    aliases: ['cp'],
    positional: ['assetIds'],
    flags: { newParentId: ['-p', '--parent'] },
    format: (output) =>
      `Copied ${output.copiedAssetIds.length} asset(s) to parent ${output.newParentId}: ${output.copiedAssetIds.join(', ')}`,
  },
})
