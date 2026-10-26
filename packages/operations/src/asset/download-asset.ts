import { z } from 'zod'
import { defineOperation } from '../define'

/** Most assets one download call accepts. */
export const MAX_DOWNLOAD_ASSETS = 50

const downloadFileSchema = z.object({
  assetId: z
    .string()
    .describe('The asset this file belongs to (the latest version for a version stack).'),
  name: z.string().describe('File name to save it as.'),
  kind: z
    .enum(['proxy', 'original'])
    .describe('"proxy" is the web preview version; "original" is the uploaded file.'),
  size: z.number().describe('Size in bytes.'),
  mimeType: z.string(),
  url: z.string().describe('Short-lived download link (about 1 hour).'),
  /** Storage key; only returned to Shumai's built-in agent. */
  key: z.string().optional(),
})

export const downloadAssetOutputSchema = z.object({
  files: z.array(downloadFileSchema),
})
export type DownloadAssetOutput = z.infer<typeof downloadAssetOutputSchema>

export const downloadAsset = defineOperation({
  name: 'download_asset',
  title: 'Download Asset',
  description:
    `Gets download links for up to ${MAX_DOWNLOAD_ASSETS} files. ` +
    'By default it returns the web preview version (proxy) when there is one, e.g. the transcoded video or the web image, which is smaller and easier to process; set proxy to false for the original uploaded file. ' +
    'Files without a preview (e.g. audio, archives, text) always return the original. ' +
    'A version stack returns its latest version. Folders are not supported: download the files inside them instead. ' +
    'Links expire after about an hour.',
  input: z.object({
    assetIds: z
      .array(z.string().min(1))
      .min(1)
      .max(MAX_DOWNLOAD_ASSETS)
      .describe(`IDs of the files or version stacks to download (1 to ${MAX_DOWNLOAD_ASSETS}).`),
    proxy: z
      .boolean()
      .optional()
      .describe(
        'Download the web preview version when there is one (default true). Set to false for the original uploaded file.',
      ),
  }),
  output: downloadAssetOutputSchema,
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false, idempotent: true },
  cli: {
    command: ['download'],
    description:
      'Download files into a folder (the current folder by default). Saves the web preview version when there is one; use --original for the uploaded file.',
    positional: ['assetIds'],
    // The CLI exposes `--original` instead of a `--proxy` flag that is on by default.
    omit: ['proxy'],
  },
})
