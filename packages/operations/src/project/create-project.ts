import { z } from 'zod'
import { defineOperation } from '../define'
import { projectSummarySchema } from '../schemas'

export const createProject = defineOperation({
  name: 'create_project',
  title: 'Create Project',
  description:
    'Create a new project in the team. Returns the created project, including its rootFolderId ' +
    'to use as the parent for asset operations.',
  input: z.object({
    name: z.string().trim().min(1).describe('The name of the new project to create.'),
    teamId: z
      .string()
      .min(1)
      .optional()
      .describe('Optional team ID. Uses the active or sole team when omitted.'),
    coverImageKey: z
      .string()
      .min(1)
      .optional()
      .describe('Optional S3 storage key for the project cover image.'),
    enableNotification: z
      .boolean()
      .optional()
      .describe('Whether project notifications are enabled (defaults to true).'),
  }),
  output: projectSummarySchema,
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false },
  cli: {
    command: ['project', 'create'],
    description: 'Create a new project.',
    positional: ['name'],
    flags: { teamId: ['-t', '--team'] },
    omit: ['coverImageKey', 'enableNotification'],
    format: (output) =>
      `Created project "${output.name}" (ID: ${output.id}, rootFolderId: ${output.rootFolderId ?? ''})`,
  },
})
