import { z } from 'zod'
import { defineOperation } from '../define'
import { assetSummarySchema, MAX_PAGE_SIZE, pageInfoSchema } from '../schemas'

/** Operators the search supports (`is` in the web app's list has no search behavior). */
export const SEARCH_CONDITION_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'notContains',
  'isEmpty',
  'isNotEmpty',
  'in',
  'notIn',
  'hasAny',
  'hasAll',
  'hasNone',
  'isWithin',
] as const

const conditionSchema = z.object({
  field: z
    .string()
    .min(1)
    .describe(
      'Metadata field key from list_metadata_fields (e.g. "status"), or one of "name", ' +
        '"sizeByte", "createdAt", "updatedAt".',
    ),
  operator: z
    .enum(SEARCH_CONDITION_OPERATORS)
    .describe(
      'Comparison: eq/neq for exact values (text, toggle, or a select option id), ' +
        'gt/gte/lt/lte for numbers and dates, contains/notContains for text, in/notIn for ' +
        'one of a list, hasAny/hasAll/hasNone for selectMulti fields, isWithin for a date ' +
        'range, isEmpty/isNotEmpty (no value needed).',
    ),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional()
    .describe(
      'Value to compare with. For select fields use option IDs from list_metadata_fields; ' +
        'for in/notIn/hasAny/hasAll/hasNone pass a list.',
    ),
})

export const searchAssets = defineOperation({
  name: 'search_assets',
  title: 'Search Assets',
  description:
    'Search for files (or folders) under a folder and all of its subfolders, by name, by ' +
    'meaning ("semantic": e.g. "sunset over the sea", when the team has AI search enabled), ' +
    'and/or by metadata conditions (e.g. status is "approved"). When semantic search is used, ' +
    'each result includes a `similarity` score representing Cosine Similarity (ranging from -1 ' +
    'to 1). Higher values indicate greater similarity in embedding space. Results are ' +
    'paginated: when pageInfo.hasNextPage is true, call again with after set to ' +
    'pageInfo.endCursor.',
  input: z.object({
    parent: z
      .string()
      .min(1)
      .describe("The folder to search in, e.g. a project's rootFolderId to search everything."),
    query: z.string().optional().describe('Text to search for in names (or by meaning).'),
    semantic: z
      .boolean()
      .optional()
      .describe(
        'Search by meaning instead of by name (default false). Needs a query and AI search ' +
          'enabled for the team.',
      ),
    type: z
      .enum(['file', 'folder'])
      .optional()
      .describe("Search 'file' (default; includes version stacks) or 'folder'."),
    recursive: z
      .boolean()
      .optional()
      .describe('Search subfolders too (default true). Set false for the folder itself only.'),
    conditions: z
      .array(conditionSchema)
      .optional()
      .describe('Metadata filters. Combined with AND unless matchAny is true.'),
    matchAny: z
      .boolean()
      .optional()
      .describe('Match assets meeting any condition instead of all of them (default false).'),
    first: z
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .describe(`Maximum number of results to return (at most ${MAX_PAGE_SIZE}).`),
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
    command: ['search'],
    description: 'Search for files under a folder by name or by meaning (--semantic).',
    positional: ['query'],
    flags: { parent: ['-p', '--parent'] },
    // Metadata conditions are structured; agents pass them, the CLI searches by name. The CLI
    // always searches subfolders (a boolean flag could only turn on the default).
    omit: ['conditions', 'matchAny', 'recursive'],
    defaults: { first: MAX_PAGE_SIZE },
  },
})
