import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import { executeActivity, getActivities, sleep, TaskQueueNotification } from '@shumai/workflow-core'

export async function notificationWorkflow(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    createInSystemNotificationActivity,
    sendEmailNotificationActivity,
  } = getActivities()

  // 1. Mark task as processing
  await executeActivity(TaskQueueNotification, updateTaskStatusActivity, {
    taskId: task.id,
    status: 'processing',
  })

  const payload = task.payload
  if (!payload?.notification) {
    throw ApplicationFailure.create({
      message: 'Task payload.notification is missing',
      nonRetryable: true,
    })
  }

  // 2. Activity 1: Create in-system notification & determine recipients
  const inSystemResult = await executeActivity(
    TaskQueueNotification,
    createInSystemNotificationActivity,
    payload.notification,
  )

  // 3. Immich-style Debounce check for burst events (file uploads)
  const debounceSeconds = inSystemResult?.debounceSeconds ?? 0
  if (payload.notification.type === 'successful_file_uploaded' && debounceSeconds > 0) {
    await sleep(debounceSeconds * 1000)
  }

  // 4. Activity 2: Send email notifications
  let emailResult = { sentCount: 0 }
  if (inSystemResult?.recipientUserIds && inSystemResult.recipientUserIds.length > 0) {
    emailResult = await executeActivity(TaskQueueNotification, sendEmailNotificationActivity, {
      payload: payload.notification,
      recipientUserIds: inSystemResult.recipientUserIds,
      notificationId: inSystemResult.notificationId,
    })
  }

  // 5. Mark task as completed
  await executeActivity(TaskQueueNotification, updateTaskStatusActivity, {
    taskId: task.id,
    status: 'completed',
    output: {
      inSystemCreated: inSystemResult?.created ?? false,
      notificationId: inSystemResult?.notificationId,
      emailsSent: emailResult?.sentCount ?? 0,
    },
  })
}
