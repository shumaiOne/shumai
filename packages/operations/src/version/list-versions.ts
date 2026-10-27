import { z } from 'zod'
import { defineOperation } from '../define'

export const versionSummarySchema = z.object({
  id: z.string().describe('The file ID of this version.'),
  version: z.number().describe('Version number; the highest is the latest.'),
  name: z.string(),
  current: z.boolean().describe('Whether this is the current (latest) version.'),
  createdAt: z.string(),
  creator: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  agent: z
    .object({ id: z.string(), name: z.string() })
    .nullable()
    .describe('The AI agent that created this version, if any.'),
})

export const listVersions = defineOperation({
  name: 'list_versions',
  title: 'List Versions',
  description:
    'List the versions in a version stack, latest first. Each version is a file: pass its ID ' +
    'to read_asset or list_comments to look at an older version.',
  input: z.object({
    stackId: z.string().min(1).describe('The version stack ID.'),
  }),
  output: z.object({
    versions: z.array(versionSummarySchema),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false, idempotent: true },
  cli: {
    command: ['version', 'ls'],
    description: 'List the versions in a version stack, latest first.',
    positional: ['stackId'],
    format: (output) =>
      output.versions
        .map((v) => `v${v.version}${v.current ? ' (current)' : ''}  ${v.id}  ${v.name}`)
        .join('\n'),
  },
})
