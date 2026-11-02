import { z } from 'zod'
import { defineOperation } from '../define'

export const archiveAssets = defineOperation({
  name: 'archive_assets',
  title: 'Archive Assets',
  description:
    'Move the original raw file(s) of one or more assets (files, version stacks, or folders) to ' +
    'cold archive storage. All transcoded proxies, previews, and thumbnails remain in main ' +
    'storage so assets stay viewable, while original raw file downloads are disabled until restored.',
  input: z.object({
    assetIds: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        'The IDs of the assets (files, version stacks, or folders) to archive. Archiving a folder or version stack archives all eligible files inside it.',
      ),
  }),
  output: z.object({
    archivedAssetIds: z.array(z.string()).describe('IDs of the file assets queued for archiving.'),
    taskIds: z.array(z.string()).describe('IDs of the archive workflow tasks created.'),
    skippedCount: z
      .number()
      .describe(
        'Number of candidate files skipped (e.g. already archived or currently archiving).',
      ),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false, idempotent: true },
  cli: {
    command: ['archive'],
    positional: ['assetIds'],
    format: (output) =>
      `Queued ${output.archivedAssetIds.length} asset(s) for archiving (${output.skippedCount} skipped)`,
  },
})
