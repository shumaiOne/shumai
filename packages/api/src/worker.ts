import { workflowService } from '@shumai/workflow-core'
import { TaskQueueAgent, TaskQueueTranscode } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { initDbWorkflows } from '@shumai/worker-db'

export async function run() {
  // Initialize workflows and activities
  initAgentWorkflows()
  initTranscodeWorkflows()
  initDbWorkflows()

  const domain = process.argv[3]

  if (!domain) {
    console.error('Please specify a worker domain.')
    console.log('Available domains: agent, transcode, all')
    process.exit(1)
  }

  switch (domain) {
    case 'agent':
    case 'ai':
      await workflowService.startWorkers(TaskQueueAgent)
      break
    case 'transcode':
      await workflowService.startWorkers(TaskQueueTranscode)
      break
    case 'all':
      await Promise.all([
        workflowService.startWorkers(TaskQueueAgent),
        workflowService.startWorkers(TaskQueueTranscode),
      ])
      break
    default:
      console.error('Unknown domain: ' + domain)
      console.log('Available domains: agent, transcode, all')
      process.exit(1)
  }
}
