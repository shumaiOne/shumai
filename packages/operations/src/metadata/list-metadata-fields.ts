import { z } from 'zod'
import { defineOperation } from '../define'

export const METADATA_FIELD_TYPES = [
  'text',
  'longText',
  'select',
  'selectMulti',
  'rating',
  'number',
  'toggle',
  'date',
  'user',
  'userMulti',
] as const

export const metadataFieldSchema = z.object({
  key: z.string().describe('Key to use in update_asset_metadata, search_assets, and metadata.'),
  name: z.string(),
  type: z.string().describe(`One of: ${METADATA_FIELD_TYPES.join(', ')}.`),
  description: z.string(),
  readOnly: z.boolean().describe('Set by Shumai; cannot be changed.'),
  creationContext: z
    .boolean()
    .describe(
      'A Creation Context field: whoever creates a file records it (e.g. the prompt or model ' +
        'used), through the metadata of create_file and create_version.',
    ),
  options: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .optional()
    .describe('Choices of a select or selectMulti field: values use the option id.'),
})
export type MetadataFieldSummary = z.infer<typeof metadataFieldSchema>

export const listMetadataFields = defineOperation({
  name: 'list_metadata_fields',
  title: 'List Metadata Fields',
  description:
    "List a project's metadata fields (e.g. status, rating, tags, custom fields), with their " +
    'type and choices. Use the keys with update_asset_metadata, as search_assets conditions, ' +
    'and for the Creation Context metadata of create_file and create_version.',
  input: z.object({
    projectId: z.string().min(1).describe('The project ID (from list_projects).'),
  }),
  output: z.object({
    fields: z.array(metadataFieldSchema),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false, idempotent: true },
  cli: {
    command: ['field', 'ls'],
    description: "List a project's metadata fields.",
    positional: ['projectId'],
    format: (output) =>
      output.fields
        .map((f) => {
          const flags = [f.type, f.readOnly ? 'read-only' : '', f.creationContext ? 'creation' : '']
            .filter(Boolean)
            .join(', ')
          const options = f.options?.length
            ? ` [${f.options.map((o) => `${o.id}=${o.name}`).join(', ')}]`
            : ''
          return `${f.key}  ${f.name} (${flags})${options}`
        })
        .join('\n'),
  },
})
