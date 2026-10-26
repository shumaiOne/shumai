import { z } from 'zod'
import { defineOperation } from '../define'
import { assetSummarySchema, MAX_PAGE_SIZE, pageInfoSchema } from '../schemas'

export const listAssets = defineOperation({
  name: 'list_assets',
  title: 'List Assets',
  description:
    'List the assets (files and folders) inside a parent folder. Results are paginated: when ' +
    'pageInfo.hasNextPage is true, call again with after set to pageInfo.endCursor.',
  input: z.object({
    parent: z.string().min(1).describe('The parent folder ID to list assets from.'),
    type: z
      .enum(['file', 'folder', 'all'])
      .optional()
      .describe("Filter assets by type: 'file', 'folder', or 'all'. Default is 'all'."),
    first: z
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .describe(`Maximum number of assets to return. Default is 20, maximum ${MAX_PAGE_SIZE}.`),
    after: z
      .string()
      .optional()
      .describe('Cursor from a previous response (pageInfo.endCursor) to fetch the next page.'),
  }),
  output: z.object({
    data: z.array(assetSummarySchema),
    pageInfo: pageInfoSchema,
    total: z.number(),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false, idempotent: true },
  cli: {
    command: ['ls'],
    flags: { parent: ['-p', '--parent'] },
  },
})
