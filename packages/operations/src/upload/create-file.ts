import { z } from 'zod'
import { defineOperation } from '../define'
import { METADATA_VALUES_DESCRIPTION } from '../metadata/update-asset-metadata'

/** How long an upload started by create_file or create_version stays valid. */
export const UPLOAD_TTL_SECONDS = 60 * 60

/** Creation Context metadata, recorded by whoever creates a file. */
export const creationMetadataSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(
    "Values for the project's Creation Context fields (list_metadata_fields, creationContext: " +
      'true), such as the prompt or model used to make the file. Only those fields are ' +
      `accepted. ${METADATA_VALUES_DESCRIPTION}`,
  )

export const startedUploadSchema = z.object({
  uploadId: z.string().describe('Pass to complete_upload once the file is uploaded.'),
  uploadUrl: z.string().describe('Upload the raw file bytes here with an HTTP PUT request.'),
  method: z.literal('PUT'),
  expiresAt: z.string().describe('When uploadUrl and uploadId stop working (about an hour).'),
  /** Storage key; only returned to Shumai's built-in agent, which uploads from its sandbox. */
  key: z.string().optional(),
})
export type StartedUploadOutput = z.infer<typeof startedUploadSchema>

const UPLOAD_STEPS =
  'Uploading takes three steps: call this tool, PUT the raw file bytes to uploadUrl (e.g. ' +
  '`curl -T <file> "<uploadUrl>"`), then call complete_upload with uploadId to create the ' +
  `asset. The upload URL expires after about an hour.`

export const createFile = defineOperation({
  name: 'create_file',
  title: 'Create File',
  description: `Start uploading a new file into a folder. ${UPLOAD_STEPS}`,
  input: z.object({
    parent: z.string().min(1).describe('The folder to create the file in.'),
    name: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .describe('File name including its extension, e.g. "storyboard.pdf".'),
    contentType: z
      .string()
      .min(1)
      .optional()
      .describe('MIME type, e.g. "image/png". Detected from the name when omitted.'),
    metadata: creationMetadataSchema,
  }),
  output: startedUploadSchema,
  surfaces: ['agent', 'mcp'],
  annotations: { readOnly: false, destructive: false },
})
