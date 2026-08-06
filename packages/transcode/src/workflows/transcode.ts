import type { WorkflowTask } from '@shumai/db'
import { transcodeVideoWorkflow } from './transcode-video'
import { transcodeImageWorkflow } from './transcode-image'
import { transcodePdfWorkflow } from './transcode-pdf'
import { renderPdfPagesWorkflow } from './render-pdf-pages'
import { takeVideoScreenshotsWorkflow } from './take-video-screenshots'
import { overlayImageAnnotationWorkflow } from './overlay-image-annotation'
import { transcodeWatermarkWorkflow } from './transcode-watermark'

/**
 * @deprecated Legacy monolithic transcode workflow. Prefer using focused workflows:
 * `transcodeVideoWorkflow`, `transcodeImageWorkflow`, `transcodePdfWorkflow`,
 * `renderPdfPagesWorkflow`, `takeVideoScreenshotsWorkflow`, or `overlayImageAnnotationWorkflow`.
 */
export async function transcodeMedia(task: WorkflowTask): Promise<void> {
  const payload = task.payload
  if (payload?.watermark || task.type === 'transcode_watermark') {
    return transcodeWatermarkWorkflow(task)
  }
  if (payload?.pdfPages) {
    return renderPdfPagesWorkflow(task)
  }
  if (payload?.screenshot) {
    return takeVideoScreenshotsWorkflow(task)
  }
  if (payload?.imageAnnotation) {
    return overlayImageAnnotationWorkflow(task)
  }
  if (task.type === 'transcode_image') {
    return transcodeImageWorkflow(task)
  }
  if (task.type === 'transcode_pdf') {
    return transcodePdfWorkflow(task)
  }
  return transcodeVideoWorkflow(task)
}

/**
 * @deprecated Legacy alias for transcodeMedia workflow.
 */
export const transcodeWorkflow = transcodeMedia

export * from './transcode-video'
export * from './transcode-image'
export * from './transcode-pdf'
export * from './render-pdf-pages'
export * from './take-video-screenshots'
export * from './overlay-image-annotation'
export * from './transcode-watermark'
export * from './common'
export * from './transcode-utils'
