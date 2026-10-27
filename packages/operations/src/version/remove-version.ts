import { z } from 'zod'
import { defineOperation } from '../define'

export const removeVersion = defineOperation({
  name: 'remove_version',
  title: 'Remove Version',
  description:
    'Take a version out of its version stack. The file is not deleted: it goes back into the ' +
    'folder next to the stack as a separate file.',
  input: z.object({
    versionId: z.string().min(1).describe('The file ID of the version (from list_versions).'),
  }),
  output: z.object({
    versionId: z.string(),
    stackId: z.string().describe('The stack the version was removed from.'),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false },
  cli: {
    command: ['version', 'unstack'],
    description: 'Take a version out of its version stack (the file is kept).',
    positional: ['versionId'],
    format: (output) => `Removed ${output.versionId} from version stack ${output.stackId}`,
  },
})
