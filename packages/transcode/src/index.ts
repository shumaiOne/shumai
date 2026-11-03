import { WorkflowTaskType } from '@shumai/db'
import { registerWorkflow } from '@shumai/workflow-core'
import { transcodeVideoWorkflow } from './workflows/transcode-video'
import { transcodeImageWorkflow } from './workflows/transcode-image'
import { transcodePdfWorkflow } from './workflows/transcode-pdf'
import { renderPdfPagesWorkflow } from './workflows/render-pdf-pages'
import { takeVideoScreenshotsWorkflow } from './workflows/take-video-screenshots'
import { overlayImageAnnotationWorkflow } from './workflows/overlay-image-annotation'
import { transcodeWatermarkWorkflow } from './workflows/transcode-watermark'
import { transcode3dWorkflow } from './workflows/transcode-3d'
import { transcodeMedia } from './workflows/transcode'
import { archiveAssetWorkflow } from './workflows/archive-asset'
import { restoreAssetWorkflow } from './workflows/restore-asset'

export function initTranscodeWorkflows() {
  registerWorkflow(WorkflowTaskType.transcode, transcodeMedia)
  registerWorkflow(WorkflowTaskType.transcode_video, transcodeVideoWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_image, transcodeImageWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_pdf, transcodePdfWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_3d, transcode3dWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_pdf_pages, renderPdfPagesWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_screenshot, takeVideoScreenshotsWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_image_annotation, overlayImageAnnotationWorkflow)
  registerWorkflow(WorkflowTaskType.transcode_watermark, transcodeWatermarkWorkflow)
  registerWorkflow(WorkflowTaskType.archive_asset, archiveAssetWorkflow)
  registerWorkflow(WorkflowTaskType.restore_asset, restoreAssetWorkflow)
}

export * from './transcoder'
export * from './workflows/transcode'
export * from './workflows/transcode-3d'
export * from './workflows/transcode-watermark'
export * from './workflows/archive-asset'
export * from './workflows/restore-asset'
export * from './activities/transcode'
export * from './activities/watermark'
export * from './activities/archive'
