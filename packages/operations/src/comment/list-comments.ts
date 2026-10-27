import { z } from 'zod'
import { defineOperation } from '../define'
import { MAX_PAGE_SIZE, pageInfoSchema } from '../schemas'

const commentAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const commentFields = {
  id: z.string(),
  message: z.string(),
  author: commentAuthorSchema,
  /** Timecode in seconds on a video or audio file (the viewing angle for 3D models). */
  second: z.number().nullable(),
  /** Whether markup was drawn on the frame or page. */
  hasMarkup: z.boolean(),
  attachmentCount: z.number(),
  createdAt: z.string(),
}

export const commentReplySchema = z.object(commentFields)

export const commentThreadSchema = z.object({
  ...commentFields,
  resolved: z.boolean(),
  replies: z.array(commentReplySchema),
})
export type CommentThread = z.infer<typeof commentThreadSchema>

export const listComments = defineOperation({
  name: 'list_comments',
  title: 'List Comments',
  description:
    'List the review comments on a file, oldest first, each with its replies. For a version ' +
    'stack, lists the comments on its latest version. "second" is the timecode on a video or ' +
    'audio file. Results are paginated: when pageInfo.hasNextPage is true, call again with ' +
    'after set to pageInfo.endCursor.',
  input: z.object({
    assetId: z.string().min(1).describe('The file or version stack ID.'),
    first: z
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .describe(`Maximum number of comment threads to return (at most ${MAX_PAGE_SIZE}).`),
    after: z
      .string()
      .optional()
      .describe('Cursor from a previous response (pageInfo.endCursor) to fetch the next page.'),
  }),
  output: z.object({
    data: z.array(commentThreadSchema),
    pageInfo: pageInfoSchema,
    total: z.number(),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false, idempotent: true },
  cli: {
    command: ['comment', 'ls'],
    description: 'List the comments on a file, with their replies.',
    positional: ['assetId'],
    defaults: { first: MAX_PAGE_SIZE },
    format: (output) => {
      if (output.data.length === 0) return 'No comments.'
      const lines: string[] = []
      for (const thread of output.data) {
        const at = thread.second !== null ? ` @${thread.second}s` : ''
        const status = thread.resolved ? ' [resolved]' : ''
        lines.push(`${thread.id}${at}${status} ${thread.author.name}: ${thread.message}`)
        for (const reply of thread.replies) {
          lines.push(`  ↳ ${reply.id} ${reply.author.name}: ${reply.message}`)
        }
      }
      return lines.join('\n')
    },
  },
})
