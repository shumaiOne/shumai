import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import { initTranscodeWorkflows } from '@shumai/transcode'
import { TaskQueueTranscode, workflowService } from '@shumai/workflow-core'
import { handleDaemonCommands } from '@shumai/core/src/utils/daemon'

if (process.argv.includes('--check')) {
  console.log('✅ Transcode worker evaluated successfully!')
  process.exit(0)
}

async function run() {
  // Initialize workflows and activities
  initTranscodeWorkflows()

  console.log('🚀 Starting Transcode Worker...')

  await workflowService.startWorkers(TaskQueueTranscode)
}

handleDaemonCommands('shumai-transcode', run).catch((err) => {
  console.error(err)
  process.exit(1)
})
