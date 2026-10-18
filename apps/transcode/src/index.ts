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

  let isShuttingDown = false
  const shutdown = async () => {
    if (isShuttingDown) return
    isShuttingDown = true
    console.log('Shutting down Transcode Worker gracefully...')
    try {
      await workflowService.shutdownWorkers()
    } catch (err) {
      console.error('Error during Transcode Worker shutdown:', err)
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

handleDaemonCommands('shumai-transcode', run).catch((err) => {
  console.error(err)
  process.exit(1)
})
