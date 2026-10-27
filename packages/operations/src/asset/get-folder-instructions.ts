import { z } from 'zod'
import { defineOperation } from '../define'

export const getFolderInstructions = defineOperation({
  name: 'get_folder_instructions',
  title: 'Get Folder Instructions',
  description:
    "Read a folder's instructions for AI agents (its AGENTS.md): conventions such as naming " +
    'rules, deliverable specs, or how the team reviews work in that folder. Check them before ' +
    'adding or changing files in a folder. Returns null content when the folder has none.',
  input: z.object({
    folderId: z.string().min(1).describe("The folder ID (e.g. a project's rootFolderId)."),
  }),
  output: z.object({
    folderId: z.string(),
    content: z.string().nullable().describe('The instructions (Markdown), or null when unset.'),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false, idempotent: true },
  cli: {
    command: ['instructions'],
    description: "Show a folder's instructions for AI agents (AGENTS.md).",
    positional: ['folderId'],
    format: (output) => output.content ?? '(This folder has no instructions.)',
  },
})
