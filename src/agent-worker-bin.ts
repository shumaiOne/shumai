import { loadEnvConfig } from './env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import { workflowService } from '@/workflow/workflow'
import { TaskQueueAgent } from '@/workflow/workflow-utils'

console.log('🤖 Starting Shumai Agent Worker...')
workflowService.startWorkers(TaskQueueAgent).catch((err) => {
  console.error('Fatal error in Shumai Agent Worker:', err)
  process.exit(1)
})
