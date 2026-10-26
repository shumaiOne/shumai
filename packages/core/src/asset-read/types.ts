import type { ReaderKind, ReaderOptions } from '@shumai/operations'
import type { WorkflowTaskType } from '@shumai/db'
import { HTTPException } from 'hono/http-exception'

/** The asset being read, after version stacks are resolved to their latest version. */
export interface ReadableAsset {
  id: string
  name: string
  projectId: string | null
  /** Media type as stored (may be null). */
  mediaType: string | null
  /** Lowercased media type ('' when unknown), for matching. */
  mediaTypeLower: string
  /** Lowercased file name, for extension matching. */
  filenameLower: string
  storageKey: string | null
  media: PrismaJson.MediaInfo | null
}

export interface ReadAnnotation {
  annotationId: string
  annotations: PrismaJson.AnnotationList | null
  /** Seconds (video, 3D turntable) or page number (PDF) where the markup was drawn. */
  timestamp: number | null
}

export interface ReadImage {
  key: string
  /** What the image shows, e.g. "Frame at 30s", "Page 3", "View at 90°". */
  label: string
  mimeType: string
}

export interface ReadResult {
  /** One-line description, e.g. `Extracted 4 frame(s) from "clip.mp4" (0s - 60s):`. */
  summary: string
  /** Extra description lines (e.g. the 3D quadrant legend). */
  details: string[]
  images: ReadImage[]
  text?: { content: string; truncated: boolean; size: number; key: string; mimeType: string }
}

export interface PlanContext {
  annotation: ReadAnnotation | null
  /** False when the caller only wants a description (skip reading text content). */
  includeContent: boolean
}

export type RenderSpec = Pick<
  PrismaJson.WorkflowTaskPayload,
  'screenshot' | 'imageAnnotation' | 'pdfPages'
>

export type ReadPlan =
  | { status: 'ready'; result: ReadResult }
  | {
      status: 'render'
      task: { type: WorkflowTaskType; spec: RenderSpec }
      /** Reader-private values stored on the task and passed back to `collect`. */
      context?: Record<string, unknown>
    }

/**
 * Reads one family of assets. The shared pipeline (`assetReadService`) handles access checks,
 * version stacks, annotations, workflow tasks, and waiting; a reader only decides what to show.
 */
export interface AssetReader<TKind extends ReaderKind = ReaderKind> {
  kind: TKind
  /** Shown in errors, e.g. "Asset X is a 3D model." */
  label: string
  /** How to pass this reader's options, shown when another reader's config is passed. */
  configHint: string
  matches(asset: ReadableAsset): boolean
  /** Synchronous argument checks, run before annotations are resolved or anything is rendered. */
  validate(
    asset: ReadableAsset,
    options: ReaderOptions<TKind> | undefined,
    ctx: { hasAnnotation: boolean },
  ): void
  plan(
    asset: ReadableAsset,
    options: ReaderOptions<TKind> | undefined,
    ctx: PlanContext,
  ): Promise<ReadPlan>
  /** Builds the result from a finished render. Required when `plan` can return `render`. */
  collect?(
    asset: ReadableAsset,
    options: ReaderOptions<TKind> | undefined,
    renderOutput: PrismaJson.WorkflowTaskOutput,
    context: Record<string, unknown>,
  ): ReadResult
}

export function badRequest(message: string): HTTPException {
  return new HTTPException(400, { message })
}

export function storageBucket(): string {
  return process.env.S3_BUCKET || 'shumai'
}
