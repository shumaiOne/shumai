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

  const isOnce = process.argv.includes('--once') || process.env.SHUMAI_WORKER_ONCE === 'true'
  if (isOnce) {
    workflowService.getExecutor().setOnceMode(true)
    console.log('🚀 Starting Transcode Worker in --once mode (single-task execution)...')
  } else {
    console.log('🚀 Starting Transcode Worker...')
  }

  await workflowService.startWorkers(TaskQueueTranscode)

  let isShuttingDown = false
  let idleTimer: Timer | null = null

  const shutdown = async () => {
    if (isShuttingDown) return
    isShuttingDown = true
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    console.log('Shutting down Transcode Worker gracefully...')
    try {
      await workflowService.shutdownWorkers()
    } catch (err) {
      console.error('Error during Transcode Worker shutdown:', err)
    }
    process.exit(0)
  }

  if (isOnce) {
    const idleTimeoutMs = process.env.SHUMAI_WORKER_IDLE_TIMEOUT_MS
      ? parseInt(process.env.SHUMAI_WORKER_IDLE_TIMEOUT_MS, 10)
      : 15_000

    idleTimer = setTimeout(async () => {
      console.log(
        `[Transcode Worker] No tasks received within idle timeout (${idleTimeoutMs / 1000}s), shutting down.`,
      )
      await shutdown()
    }, idleTimeoutMs)

    workflowService.getExecutor().on('workflowStarted', (task) => {
      console.log(`[Transcode Worker] Claimed task ${task.id}, cancelling idle timer.`)
      if (idleTimer) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
    })

    workflowService.getExecutor().on('workflowFinished', async ({ taskId }) => {
      console.log(`[Transcode Worker] Completed task ${taskId} in --once mode, shutting down.`)
      await shutdown()
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

handleDaemonCommands('shumai-transcode', run).catch((err) => {
  console.error(err)
  process.exit(1)
})
