import { z } from 'zod'
import { defineOperation } from '../define'
import { creationMetadataSchema, startedUploadSchema } from './create-file'

export const createVersion = defineOperation({
  name: 'create_version',
  title: 'Create Version',
  description:
    'Start uploading a new version of an existing file. The new version becomes the current ' +
    'one; a plain file becomes a version stack. Uploading takes three steps: call this tool, ' +
    'PUT the raw file bytes to uploadUrl (e.g. `curl -T <file> "<uploadUrl>"`), then call ' +
    'complete_upload with uploadId. The upload URL expires after about an hour.',
  input: z.object({
    parent: z.string().min(1).describe('The file or version stack to add a version to.'),
    name: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .describe('File name of the new version including its extension, e.g. "cut_v3.mp4".'),
    contentType: z
      .string()
      .min(1)
      .optional()
      .describe('MIME type, e.g. "video/mp4". Detected from the name when omitted.'),
    metadata: creationMetadataSchema,
  }),
  output: startedUploadSchema,
  surfaces: ['agent', 'mcp'],
  annotations: { readOnly: false, destructive: false },
})
