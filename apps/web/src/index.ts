import { join } from 'node:path'
import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import index from '@shumai/webui/index.html'

import { initAgentWorkflows } from '@shumai/agent'
import { assetService } from '@shumai/core/src/asset/asset'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { workflowService } from '@shumai/workflow-core'
import { app } from '@shumai/api'

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

const isProd = process.env.NODE_ENV === 'production'

const port = process.env.SHUMAI_SERVER_PORT ? parseInt(process.env.SHUMAI_SERVER_PORT) : 3000

const server = Bun.serve(
  isProd
    ? {
        port,
        maxRequestBodySize: process.env.MAX_REQUEST_BODY_SIZE
          ? parseInt(process.env.MAX_REQUEST_BODY_SIZE)
          : 1024 * 1024 * 1024 * 10, // Default 10GB
        development: false,
        async fetch(req) {
          const url = new URL(req.url)

          if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/files/')) {
            const filepath = join(import.meta.dir, url.pathname)
            const file = Bun.file(filepath)
            if (await file.exists()) {
              try {
                const stat = await file.stat()
                if (stat.isFile()) {
                  return new Response(file)
                }
              } catch {
                // ignore stat errors
              }
            }

            const htmlFile = Bun.file(join(import.meta.dir, 'index.html'))
            if (await htmlFile.exists()) {
              return new Response(htmlFile, {
                headers: { 'Content-Type': 'text/html' },
              })
            }

            const htmlFileNpm = Bun.file(join(import.meta.dir, 'shumai-app.html'))
            if (await htmlFileNpm.exists()) {
              return new Response(htmlFileNpm, {
                headers: { 'Content-Type': 'text/html' },
              })
            }
          }

          return app.fetch(req)
        },
      }
    : {
        port,
        maxRequestBodySize: process.env.MAX_REQUEST_BODY_SIZE
          ? parseInt(process.env.MAX_REQUEST_BODY_SIZE)
          : 1024 * 1024 * 1024 * 10, // Default 10GB
        development: true,
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
      },
)

console.log(`🚀 Server running at ${server.url}`)

const shutdown = () => {
  console.log('\nShutting down gracefully...')
  assetService.stopCleanupJob()
  server.stop(true)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
