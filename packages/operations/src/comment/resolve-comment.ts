import { z } from 'zod'
import { defineOperation } from '../define'

export const resolveComment = defineOperation({
  name: 'resolve_comment',
  title: 'Resolve Comment',
  description:
    'Mark a comment thread as resolved (done), e.g. after addressing the feedback in a new ' +
    'version. Set reopen to true to mark it as unresolved again.',
  input: z.object({
    commentId: z.string().min(1).describe('The comment ID (from list_comments).'),
    reopen: z
      .boolean()
      .optional()
      .describe('Mark the comment as unresolved again instead (default false).'),
  }),
  output: z.object({
    commentId: z.string(),
    resolved: z.boolean(),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false, idempotent: true },
  cli: {
    command: ['comment', 'resolve'],
    description: 'Mark a comment as resolved, or unresolved again with --reopen.',
    positional: ['commentId'],
    format: (output) =>
      `Comment ${output.commentId} is ${output.resolved ? 'resolved' : 'unresolved'}`,
  },
})
