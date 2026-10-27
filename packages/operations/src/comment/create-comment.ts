import { z } from 'zod'
import { defineOperation } from '../define'

export const createComment = defineOperation({
  name: 'create_comment',
  title: 'Create Comment',
  description:
    'Post a review comment on a file, or reply to an existing comment thread. The comment is ' +
    'posted as you, and the people involved are notified. For a video or audio file, set ' +
    '"second" to pin the comment to a timecode. For a version stack, the comment goes on its ' +
    'latest version.',
  input: z.object({
    assetId: z.string().min(1).describe('The file or version stack to comment on.'),
    message: z.string().trim().min(1).max(10_000).describe('The comment text.'),
    replyToId: z
      .string()
      .min(1)
      .optional()
      .describe('ID of the comment to reply to (from list_comments). Omit for a new thread.'),
    second: z
      .number()
      .min(0)
      .optional()
      .describe('Timecode in seconds on a video or audio file. Omit for other files.'),
  }),
  output: z.object({
    id: z.string().describe('The new comment ID.'),
    assetId: z.string().describe('The file the comment is on (the latest version for a stack).'),
    replyToId: z.string().nullable().describe('The thread it replies to, if any.'),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false },
  cli: {
    command: ['comment', 'add'],
    description: 'Comment on a file, or reply to a comment with --reply-to.',
    positional: ['assetId', 'message'],
    flags: { replyToId: ['--reply-to'], second: ['-t', '--at'] },
    format: (output) => `Posted comment ${output.id}`,
  },
})
