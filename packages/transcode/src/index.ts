import { WorkflowTaskType } from '@shumai/db'
import { registerActivities, registerWorkflow } from '@shumai/workflow-core'
import * as transcodeActivities from './activities/transcode'
import { transcodeMedia } from './workflows/transcode'

export function initTranscodeWorkflows() {
  registerWorkflow(WorkflowTaskType.transcode, transcodeMedia)
  registerActivities(transcodeActivities)
}
