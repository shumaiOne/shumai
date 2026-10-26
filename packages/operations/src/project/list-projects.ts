import { z } from 'zod'
import { defineOperation } from '../define'
import { MAX_PAGE_SIZE, projectSummarySchema } from '../schemas'

export const listProjects = defineOperation({
  name: 'list_projects',
  title: 'List Projects',
  description:
    'List the projects the user can access across all of their teams, newest first. ' +
    "Use a project's rootFolderId as the parent for asset operations.",
  input: z.object({
    first: z
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .describe(`Maximum number of projects to return. Default and maximum is ${MAX_PAGE_SIZE}.`),
  }),
  output: z.object({
    data: z.array(projectSummarySchema),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false, idempotent: true },
  cli: {
    command: ['project', 'ls'],
  },
})
