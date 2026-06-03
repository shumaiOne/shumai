import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import index from '@shumai/webui/index.html'

import { initAgentWorkflows } from '@shumai/agent'
import { assetService } from '@shumai/core/src/asset/asset'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { workflowService } from '@shumai/workflow-core'
import { app } from '@shumai/api'
import * as fs from 'fs'
import * as path from 'path'

// Initialize workflows and activities for local executor mode
initAgentWorkflows()
initTranscodeWorkflows()

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

  const queuesToStart: string[] = []
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
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = url.pathname

    if (pathname.startsWith('/api/') || pathname.startsWith('/files/')) {
      return app.fetch(req)
    }

    // Try serving from public folder
    let publicFilePath = ''
    if (pathname.startsWith('/public/')) {
      publicFilePath = path.join(process.cwd(), 'packages/webui/public', pathname.substring(8))
    } else {
      publicFilePath = path.join(process.cwd(), 'packages/webui/public', pathname)
    }

    if (fs.existsSync(publicFilePath) && fs.statSync(publicFilePath).isFile()) {
      return new Response(Bun.file(publicFilePath))
    }

    return new Response(index as unknown as BodyInit)
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
