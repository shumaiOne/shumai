import { registerWorkflow, registerActivities } from '@shumai/workflow-core'
import { WorkflowTaskType } from '@shumai/db'
import { transcodeMedia } from './workflows/transcode'
import * as transcodeActivities from './activities/transcode'

export function initTranscodeWorkflows() {
  registerWorkflow(WorkflowTaskType.transcode, transcodeMedia)
  registerActivities(transcodeActivities)
}

export * from './transcoder'
export * from './transcode'
export * from './workflows/transcode'
export * from './activities/transcode'
