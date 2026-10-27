import { z } from 'zod'
import { defineOperation } from '../define'
import { assetSummarySchema } from '../schemas'

export const completeUpload = defineOperation({
  name: 'complete_upload',
  title: 'Complete Upload',
  description:
    'Finish an upload started with create_file or create_version, after the file bytes were ' +
    'PUT to its uploadUrl. Creates the file (or the new version) and starts processing it ' +
    '(previews, transcoding). Returns the new file. Calling it again for the same upload ' +
    'returns the same file.',
  input: z.object({
    uploadId: z.string().min(1).describe('The uploadId returned by create_file or create_version.'),
  }),
  output: assetSummarySchema,
  surfaces: ['mcp'],
  annotations: { readOnly: false, destructive: false, idempotent: true },
})
