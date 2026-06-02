import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import { workflowService } from '@shumai/workflow-core'
import { TaskQueueTranscode } from '@shumai/workflow-core'
import { initTranscodeWorkflows } from '@shumai/transcode'

async function run() {
  // Initialize workflows and activities
  initTranscodeWorkflows()

  console.log('🚀 Starting Transcode Worker...')
  await workflowService.startWorkers(TaskQueueTranscode)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
