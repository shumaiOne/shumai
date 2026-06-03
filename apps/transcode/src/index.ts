import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import { initTranscodeWorkflows } from '@shumai/transcode'
import { TaskQueueTranscode, workflowService } from '@shumai/workflow-core'

async function run() {
  // Initialize workflows and activities
  initTranscodeWorkflows()

  console.log('🚀 Starting Transcode Worker...')

  const options: { workflowBundle?: unknown; workflowsPath?: string } = {}
  if (process.env.NODE_ENV === 'production') {
    // @ts-ignore: Bun temporal plugin macro
    const { default: workflowBundle } = await import('./workflows:::workflow')
    options.workflowBundle = workflowBundle
  } else {
    options.workflowsPath = new URL('./workflows.ts', import.meta.url).pathname
  }

  await workflowService.startWorkers(TaskQueueTranscode, options)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
