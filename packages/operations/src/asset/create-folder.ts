import { z } from 'zod'
import { defineOperation } from '../define'
import { assetSummarySchema } from '../schemas'

export const createFolder = defineOperation({
  name: 'create_folder',
  title: 'Create Folder',
  description: 'Create a new folder in a specified parent folder.',
  input: z.object({
    parent: z
      .string()
      .min(1)
      .describe('The parent folder ID under which to create the new folder.'),
    name: z.string().min(1).describe('The name of the new folder to create.'),
  }),
  output: assetSummarySchema,
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false },
  cli: {
    command: ['mkdir'],
    positional: ['name'],
    flags: { parent: ['-p', '--parent'] },
    format: (output) => `Created folder with ID: ${output.id}`,
  },
})
