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

  let idleTimeoutMs = process.env.SHUMAI_WORKER_IDLE_TIMEOUT_MS
    ? parseInt(process.env.SHUMAI_WORKER_IDLE_TIMEOUT_MS, 10)
    : 0

  const idleTimeoutArg = process.argv.find((arg) => arg.startsWith('--idle-timeout='))
  if (idleTimeoutArg) {
    const val = parseInt(idleTimeoutArg.split('=')[1], 10)
    if (!isNaN(val)) idleTimeoutMs = val
  }

  if (idleTimeoutMs > 0) {
    console.log(
      `🚀 Starting Transcode Worker with idle timeout (${idleTimeoutMs / 1000}s auto-drain)...`,
    )
  } else {
    console.log('🚀 Starting Transcode Worker (persistent daemon mode)...')
  }

  await workflowService.startWorkers(TaskQueueTranscode)

  let isShuttingDown = false
  let idleTimer: Timer | null = null
  let activeWorkflows = 0

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

  if (idleTimeoutMs > 0) {
    const resetIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
      if (activeWorkflows === 0 && !isShuttingDown) {
        idleTimer = setTimeout(async () => {
          console.log(
            `[Transcode Worker] Inactive for ${idleTimeoutMs / 1000}s with no active workflows, shutting down.`,
          )
          await shutdown()
        }, idleTimeoutMs)
      }
    }

    // Start idle timer immediately on startup in case no tasks are enqueued
    resetIdleTimer()

    workflowService.getExecutor().on('workflowStarted', (task) => {
      activeWorkflows++
      console.log(
        `[Transcode Worker] Claimed task ${task.id} (active: ${activeWorkflows}), cancelling idle timer.`,
      )
      if (idleTimer) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
    })

    workflowService.getExecutor().on('workflowFinished', async ({ taskId }) => {
      activeWorkflows = Math.max(0, activeWorkflows - 1)
      console.log(`[Transcode Worker] Completed task ${taskId} (active: ${activeWorkflows}).`)
      resetIdleTimer()
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

handleDaemonCommands('shumai-transcode', run).catch((err) => {
  console.error(err)
  process.exit(1)
})
