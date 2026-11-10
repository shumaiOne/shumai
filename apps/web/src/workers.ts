import { TaskQueueAgent, TaskQueueArchive, TaskQueueTranscode } from '@shumai/workflow-core'

/** Agent and archive work always belongs to the server; only transcoding is optional. */
export function getServerQueues(option: string): string[] {
  const queues = [TaskQueueAgent, TaskQueueArchive]
  if (option === 'all' || option === 'transcode') queues.push(TaskQueueTranscode)
  return queues
}
