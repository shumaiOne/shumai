import { z } from 'zod'
import { defineOperation } from '../define'

export const restoreArchivedAssets = defineOperation({
  name: 'restore_archived_assets',
  title: 'Restore Archived Assets',
  description:
    'Restore the original raw file(s) of one or more archived assets (files, version stacks, or ' +
    'folders) from cold archive storage back to main storage.',
  input: z.object({
    assetIds: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        'The IDs of the archived assets (files, version stacks, or folders) to restore back to main storage.',
      ),
  }),
  output: z.object({
    restoredAssetIds: z
      .array(z.string())
      .describe('IDs of the file assets queued for restoration.'),
    taskIds: z.array(z.string()).describe('IDs of the restore workflow tasks created.'),
    skippedCount: z
      .number()
      .describe('Number of candidate files skipped (e.g. not archived or already restoring).'),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false, idempotent: true },
  cli: {
    command: ['unarchive'],
    aliases: ['restore-archive'],
    positional: ['assetIds'],
    format: (output) =>
      `Queued ${output.restoredAssetIds.length} asset(s) for restoration from archive (${output.skippedCount} skipped)`,
  },
})
