import { z } from 'zod'
import { defineOperation } from '../define'

/** Describes metadata values; shared with the Creation Context metadata of uploads. */
export const METADATA_VALUES_DESCRIPTION =
  'Values keyed by field key (from list_metadata_fields). Text fields take a string, ' +
  'number and rating fields a number, toggle fields a boolean, date fields an ISO date ' +
  'string, select fields an option id, and selectMulti fields a list of option ids. To add a ' +
  'new choice to a select field, pass {"newOption": {"value": "Name"}} instead of an id. ' +
  'Use null to clear a value.'

export const updateAssetMetadata = defineOperation({
  name: 'update_asset_metadata',
  title: 'Update Asset Metadata',
  description:
    'Set metadata values on a file, e.g. its status, rating, tags, or custom fields. Only the ' +
    'given fields change. Call list_metadata_fields first to get the field keys and choices. ' +
    'For a version stack, the values are set on its latest version.',
  input: z.object({
    assetId: z.string().min(1).describe('The file or version stack ID.'),
    values: z.record(z.string(), z.unknown()).describe(METADATA_VALUES_DESCRIPTION),
  }),
  output: z.object({
    assetId: z.string(),
    updatedKeys: z.array(z.string()),
  }),
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: false, destructive: false, idempotent: true },
  cli: {
    command: ['meta', 'set'],
    description:
      'Set metadata values on a file, as JSON keyed by field key, e.g. --values \'{"status":"approved"}\'.',
    positional: ['assetId'],
    format: (output) => `Updated ${output.updatedKeys.join(', ')} on ${output.assetId}`,
  },
})
