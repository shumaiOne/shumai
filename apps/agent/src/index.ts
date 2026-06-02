import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import { workflowService } from '@shumai/workflow-core'
import { TaskQueueAgent } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'

async function run() {
  // Initialize workflows and activities
  initAgentWorkflows()

  console.log('🚀 Starting Agent Worker...')
  await workflowService.startWorkers(TaskQueueAgent)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
