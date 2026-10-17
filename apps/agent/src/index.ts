import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import { workflowService } from '@shumai/workflow-core'
import { TaskQueueAgent } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { sandboxService } from '@shumai/core'
import { handleDaemonCommands } from '@shumai/core/src/utils/daemon'

if (process.argv.includes('--check')) {
  console.log('✅ Agent worker evaluated successfully!')
  process.exit(0)
}

async function run() {
  // Initialize workflows and activities
  initAgentWorkflows()
  await sandboxService.ensureInitialized().catch((err) => {
    console.error('Failed to eagerly initialize sandbox in agent worker:', err)
  })

  console.log('🚀 Starting Agent Worker...')

  await workflowService.startWorkers(TaskQueueAgent)
}

handleDaemonCommands('shumai-agent', run).catch((err) => {
  console.error(err)
  process.exit(1)
})
