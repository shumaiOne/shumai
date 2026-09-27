import { WorkflowTaskType } from '@shumai/db'
import { registerActivities, registerWorkflow } from '@shumai/workflow-core'
import { notificationWorkflow } from './workflows/notification'
import * as notificationActivities from './activities/notification'

export function initNotificationWorkflows() {
  registerWorkflow(WorkflowTaskType.notification, notificationWorkflow)
  registerActivities(notificationActivities)
}

export * from './notification'
export * from './email'
export * from './activities/notification'
export * from './workflows/notification'
