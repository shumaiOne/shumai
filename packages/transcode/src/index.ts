import { WorkflowTaskType } from '@shumai/db'
import { registerActivities, registerWorkflow } from '@shumai/workflow-core'
import * as transcodeActivities from './activities/transcode'
import * as watermarkActivities from './activities/watermark'
import { transcodeVideoWorkflow } from './workflows/transcode-video'
import { transcodeImageWorkflow } from './workflows/transcode-image'
import { transcodePdfWorkflow } from './workflows/transcode-pdf'
import { renderPdfPagesWorkflow } from './workflows/render-pdf-pages'
import { takeVideoScreenshotsWorkflow } from './workflows/take-video-screenshots'
import { overlayImageAnnotationWorkflow } from './workflows/overlay-image-annotation'
import { transcodeWatermarkWorkflow } from './workflows/transcode-watermark'
import { transcodeMedia } from './workflows/transcode'

export function initTranscodeWorkflows() {
  registerWorkflow(WorkflowTaskType.transcode, transcodeMedia)
  registerWorkflow(WorkflowTaskType.transcode_video, transcodeVideoWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_image, transcodeImageWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_pdf, transcodePdfWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_pdf_pages, renderPdfPagesWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_screenshot, takeVideoScreenshotsWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_image_annotation, overlayImageAnnotationWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_watermark, transcodeWatermarkWorkflow)
  registerActivities(transcodeActivities)
  registerActivities(watermarkActivities)
}

export * from './transcoder'
export * from './workflows/transcode'
export * from './workflows/transcode-watermark'
export * from './activities/transcode'
export * from './activities/watermark'
