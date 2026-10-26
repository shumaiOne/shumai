import { z } from 'zod'
import { defineOperation } from '../define'

/**
 * Asset readers, in matching order. Each reader handles one family of assets and contributes
 * one optional config field to `read_asset`. Implementations live in
 * `@shumai/core/src/asset-read/readers`.
 */
export const READER_KINDS = ['model3d', 'image', 'video', 'document'] as const
export type ReaderKind = (typeof READER_KINDS)[number]

/** Most frames or pages a single read may render. */
export const MAX_RENDER_ITEMS = 20

export const readerOptionSchemas = {
  model3d: {
    key: 'config3d',
    schema: z
      .object({
        degree: z
          .number()
          .int()
          .nullable()
          .optional()
          .describe(
            'Turntable rotation degree (integer: 0, 15, 30, ..., 345 in 15° increments) to inspect a specific angle of a 3D model. Leave it out to view the 4-view composite overview.',
          ),
      })
      .describe(
        'Configuration for 3D model assets. Optionally pass degree to inspect a specific turntable angle, or leave it out to view the 4-view composite overview.',
      ),
  },
  image: {
    key: 'imageConfig',
    schema: z.object({}).describe('Optional configuration for image assets.'),
  },
  video: {
    key: 'videoConfig',
    schema: z
      .object({
        start: z.number().describe('Start time in seconds.'),
        end: z.number().describe('End time in seconds.'),
        count: z
          .number()
          .describe(`Number of frames to extract, evenly spaced (1 to ${MAX_RENDER_ITEMS}).`),
      })
      .describe('Configuration for video assets. Required when inspecting videos.'),
  },
  document: {
    key: 'docConfig',
    schema: z
      .object({
        mode: z
          .enum(['pages', 'text'])
          .describe(
            '"pages" renders a page range as images (visual layout, charts, markups; required for binary PDFs). "text" reads raw text (ideal for .md, .txt, .csv, code files).',
          ),
        startPage: z
          .number()
          .nullable()
          .optional()
          .describe('Start page number (1-based, required when mode="pages"; omit for "text").'),
        endPage: z
          .number()
          .nullable()
          .optional()
          .describe(
            `End page number (1-based, max ${MAX_RENDER_ITEMS} pages per call, required when mode="pages"; omit for "text").`,
          ),
      })
      .describe('Configuration for document, PDF, and text assets.'),
  },
} as const satisfies Record<ReaderKind, { key: string; schema: z.ZodObject }>

export type ReaderOptions<TKind extends ReaderKind> = z.output<
  (typeof readerOptionSchemas)[TKind]['schema']
>

/** The config field name each reader contributes, e.g. `videoConfig`. */
export type ReaderConfigKey = (typeof readerOptionSchemas)[ReaderKind]['key']

const readImageSchema = z.object({
  label: z.string().describe('What the image shows, e.g. "Frame at 30s" or "Page 3".'),
  mimeType: z.string(),
  url: z
    .string()
    .optional()
    .describe('Short-lived link to the image (about 1 hour). Download it to look at the image.'),
  /** Storage key; only returned to Shumai's built-in agent. */
  key: z.string().optional(),
})

/** Shared by `read_asset` and `get_asset_render`. */
export const assetReadOutputSchema = z.object({
  status: z
    .enum(['ready', 'pending'])
    .describe('"pending" means a render is still running; call get_asset_render with taskId.'),
  summary: z.string(),
  asset: z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(READER_KINDS),
    mediaType: z.string().nullable(),
  }),
  details: z.array(z.string()),
  images: z.array(readImageSchema),
  text: z
    .object({
      content: z.string(),
      truncated: z.boolean(),
      size: z.number(),
      mimeType: z.string(),
      url: z.string().optional(),
      key: z.string().optional(),
    })
    .optional(),
  taskId: z.string().optional(),
  retryAfterSeconds: z.number().optional(),
})
export type AssetReadOutput = z.infer<typeof assetReadOutputSchema>

const maxWaitSeconds = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe(
    'Longest time to wait for rendering, in seconds. If rendering takes longer, the result is "pending" with a taskId to pass to get_asset_render. 0 returns immediately.',
  )

export const readAsset = defineOperation({
  name: 'read_asset',
  title: 'Read Asset',
  description:
    'Inspects and reads the content of an asset without downloading it. ' +
    'Supports images, 3D models (4-view overview or a specific degree angle), video frame extraction, PDF page rendering, and direct text reading for text/markdown/code files. ' +
    'Pass assetId and the config matching the asset type (imageConfig, config3d, videoConfig, or docConfig); omit the others. ' +
    'Optionally pass annotationId to view visual markups drawn on the asset. ' +
    'Rendering frames or pages can take a while: if the result has status "pending", call get_asset_render with its taskId.',
  input: z.object({
    assetId: z.string().min(1).describe('The ID of the asset to inspect.'),
    annotationId: z
      .string()
      .optional()
      .describe(
        'The ID of a comment or message (from <annotation id="..." />) whose visual markup should be overlaid.',
      ),
    config3d: readerOptionSchemas.model3d.schema.optional(),
    imageConfig: readerOptionSchemas.image.schema.optional(),
    videoConfig: readerOptionSchemas.video.schema.optional(),
    docConfig: readerOptionSchemas.document.schema.optional(),
    includeContent: z
      .boolean()
      .optional()
      .describe('Set to false to skip reading text content and only describe the asset.'),
    maxWaitSeconds,
  }),
  output: assetReadOutputSchema,
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false },
  cli: {
    command: ['read'],
    description:
      'Read an asset: show an image, video frames, PDF pages, a 3D view, or the text of a text file. ' +
      'Prints links to the images; use --out to download them.',
    positional: ['assetId'],
    flatten: { videoConfig: 'video', docConfig: 'doc', config3d: '', imageConfig: 'image' },
    // Text content is cheap to print; describing without content is only useful to agents.
    omit: ['includeContent'],
  },
})

export const getAssetRender = defineOperation({
  name: 'get_asset_render',
  title: 'Get Asset Render',
  description:
    'Gets the result of a read_asset call that returned status "pending". ' +
    'Returns "pending" again while rendering is still running; wait retryAfterSeconds and try again.',
  input: z.object({
    taskId: z.string().min(1).describe('The taskId returned by read_asset.'),
    maxWaitSeconds,
  }),
  output: assetReadOutputSchema,
  surfaces: ['agent', 'mcp', 'cli'],
  annotations: { readOnly: true, destructive: false, idempotent: true },
  cli: {
    command: ['render'],
    description: 'Get the result of a `read` that is still rendering, by its task ID.',
    positional: ['taskId'],
  },
})
