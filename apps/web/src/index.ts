import { loadEnvConfig } from '@shumai/core/src/env-loader'
import { join } from 'node:path'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

import index from '@shumai/webui/index.html'

import { initAgentWorkflows } from '@shumai/agent'
import { app } from '@shumai/api'
import { assetService } from '@shumai/core/src/asset/asset'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { workflowService } from '@shumai/workflow-core'

import { handleDaemonCommands } from '@shumai/core/src/utils/daemon'

if (process.argv.includes('--check')) {
  console.log('✅ Web app evaluated successfully!')
  process.exit(0)
}

async function run() {
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

  interface HtmlBundleFile {
    input: string
    path: string
    loader: string
    isEntry: boolean
    headers: Record<string, string>
  }

  interface HtmlBundle {
    index: string
    files: HtmlBundleFile[]
  }

  // Bun's native Serve config routes require specific handler types that are hard
  // to dynamically construct without using 'any'.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes: Record<string, any> = {
    '/api/*': app.fetch,
    '/files/*': app.fetch,
  }

  if (isProd) {
    const bundle = index as unknown as HtmlBundle
    if (bundle && typeof bundle === 'object' && 'files' in bundle && Array.isArray(bundle.files)) {
      for (const file of bundle.files) {
        const routePath = file.path.startsWith('.') ? file.path.slice(1) : file.path
        const filePath = join(import.meta.dir, file.path)
        routes[routePath] = () => new Response(Bun.file(filePath), { headers: file.headers })
      }

      const mainHtmlPath = join(import.meta.dir, bundle.index)
      const mainHtmlFile = Bun.file(mainHtmlPath)
      const mainHtmlHeaders = bundle.files.find((f) => f.path === bundle.index)?.headers || {
        'content-type': 'text/html;charset=utf-8',
      }
      const raw = await mainHtmlFile.text()
      const mainHtmlText = raw
        .replaceAll('href="./', 'href="/')
        .replaceAll('src="./', 'src="/')
        .replaceAll('content="./', 'content="/')
      const serveMainHtml = () => new Response(mainHtmlText, { headers: mainHtmlHeaders })

      routes['/'] = serveMainHtml
      routes['/*'] = serveMainHtml
    } else {
      const fallbackHtmlPath = join(import.meta.dir, 'shumai-app.html')
      const serveFallbackHtml = () =>
        new Response(Bun.file(fallbackHtmlPath), {
          headers: { 'content-type': 'text/html;charset=utf-8' },
        })
      routes['/'] = serveFallbackHtml
      routes['/*'] = serveFallbackHtml
    }
  } else {
    routes['/'] = index
    routes['/*'] = index
  }

  const server = Bun.serve({
    port,
    idleTimeout: 120,
    maxRequestBodySize: process.env.MAX_REQUEST_BODY_SIZE
      ? parseInt(process.env.MAX_REQUEST_BODY_SIZE)
      : 1024 * 1024 * 1024 * 10, // Default 10GB
    development: !isProd,
    fetch: app.fetch,
    routes,
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
}

if (process.env.SHUMAI_E2E === 'true') {
  run().catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  handleDaemonCommands('shumai', run).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
