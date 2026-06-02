import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import index from '@shumai/webui/index.html'

import { initAgentWorkflows } from '@shumai/agent'
import { assetService } from '@shumai/core/src/asset/asset'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { initDbWorkflows } from '@shumai/worker-db'
import { workflowService } from '@shumai/workflow-core'
import { app } from '@shumai/api'

// Initialize workflows and activities for local executor mode
initAgentWorkflows()
initTranscodeWorkflows()
initDbWorkflows()

// Start services
await metadataService.syncSystemFields().catch(console.error)
assetService.startCleanupJob()
workflowService.start()
if (process.env.WORKFLOW_EXECUTOR === 'temporal') {
  const args = process.argv.slice(2)
  let workersOption = ''
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--workers') {
      workersOption = args[i + 1] || ''
    } else if (args[i].startsWith('--workers=')) {
      workersOption = args[i].split('=')[1]
    }
  }

  const queuesToStart = ['db_queue']
  if (workersOption === 'agent' || workersOption === 'ai') {
    queuesToStart.push('agent_queue')
  } else if (workersOption === 'transcode') {
    queuesToStart.push('transcode_queue')
  } else if (workersOption === 'all') {
    queuesToStart.push('agent_queue', 'transcode_queue')
  }

  Promise.all(queuesToStart.map((q) => workflowService.startWorkers(q))).catch(console.error)
}

const server = Bun.serve({
  port: 3000,
  fetch: app.fetch,
  routes: {
    // Serve index.html for root
    '/': index,

    // Proxy API requests to Hono
    '/api/*': app.fetch,
    '/files/*': app.fetch,

    // Catch-all for SPA routing (fallback to index.html)
    '/*': index,
  },
  development: process.env.NODE_ENV !== 'production',
})

console.log(`🚀 Server running at ${server.url}`)

const shutdown = () => {
  console.log('\nShutting down gracefully...')
  assetService.stopCleanupJob()
  server.stop(true)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
