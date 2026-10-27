import { z } from 'zod'
import { defineOperation } from '../define'
import { assetSummarySchema } from '../schemas'

export const createVersionStack = defineOperation({
  name: 'create_version_stack',
  title: 'Create Version Stack',
  description:
    'Stack existing files in the same folder as versions of one asset, e.g. "cut_v1.mp4" and ' +
    '"cut_v2.mp4". The first file in fileIds becomes the current (latest) version. To add a ' +
    'newly uploaded file as a version, use create_version instead.',
  input: z.object({
    fileIds: z
      .array(z.string().min(1))
      .min(2)
      .describe(
        'IDs of the files to stack (at least two, all in the same folder), latest version first.',
      ),
  }),
  output: assetSummarySchema,
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false },
  cli: {
    command: ['version', 'stack'],
    description: 'Stack files in the same folder as versions; the first file is the latest.',
    positional: ['fileIds'],
    format: (output) => `Created version stack ${output.id}`,
  },
})
