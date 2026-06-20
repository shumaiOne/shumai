import { spawn } from 'node:child_process'
import {
  existsSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  mkdirSync,
  statSync,
  createReadStream,
  openSync,
} from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const SHUMAI_DIR = join(homedir(), '.shumai')
const PID_DIR = join(SHUMAI_DIR, 'pids')
const LOG_DIR = join(SHUMAI_DIR, 'logs')

async function stopProcess(appName: string, pidFile: string): Promise<boolean> {
  if (!existsSync(pidFile)) {
    console.log(`No running instance of ${appName} found.`)
    return false
  }

  const pid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10)
  if (isNaN(pid)) {
    console.log(`Invalid PID found in ${pidFile}. Cleaning up file.`)
    try {
      unlinkSync(pidFile)
    } catch {
      // Ignore
    }
    return false
  }

  let isRunning = false
  try {
    process.kill(pid, 0)
    isRunning = true
  } catch {
    // Not running
  }

  if (!isRunning) {
    console.log(`Process ${pid} is not running. Cleaning up PID file.`)
    try {
      unlinkSync(pidFile)
    } catch {
      // Ignore
    }
    return false
  }

  console.log(`Stopping ${appName} (PID: ${pid})...`)
  try {
    process.kill(pid, 'SIGTERM')
  } catch (err) {
    console.error(`Failed to send SIGTERM to process ${pid}:`, err)
    return false
  }

  // Wait for it to stop
  for (let i = 0; i < 30; i++) {
    try {
      process.kill(pid, 0)
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch {
      isRunning = false
      break
    }
  }

  if (isRunning) {
    console.log(`Process ${pid} did not stop gracefully. Sending SIGKILL...`)
    try {
      process.kill(pid, 'SIGKILL')
    } catch (err) {
      console.error(`Failed to send SIGKILL to process ${pid}:`, err)
    }
  }

  try {
    unlinkSync(pidFile)
  } catch {
    // Ignore
  }

  console.log(`Successfully stopped ${appName}.`)
  return true
}

function startDaemon(appName: string, pidFile: string, logFile: string): void {
  // Check if already running
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10)
    if (!isNaN(pid) && pid !== process.pid) {
      try {
        process.kill(pid, 0)
        console.error(
          `${appName} is already running (PID: ${pid}). Use '${appName} stop' or '${appName} restart'.`,
        )
        process.exit(1)
      } catch {
        try {
          unlinkSync(pidFile)
        } catch {
          // Ignore
        }
      }
    }
  }

  console.log(`Starting ${appName} in background...`)
  const logFd = openSync(logFile, 'w')

  const childArgs = process.argv.slice(1).filter((arg) => arg !== '-d' && arg !== 'restart')

  const child = spawn(process.argv[0], childArgs, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      SHUMAI_DAEMONIZED: 'true',
    },
  })

  if (child.pid === undefined) {
    console.error(`Failed to spawn background process for ${appName}.`)
    process.exit(1)
  }

  child.unref()
  writeFileSync(pidFile, child.pid.toString(), 'utf8')
  console.log(`🚀 Started ${appName} in background (PID: ${child.pid}).`)
  console.log(`📄 Logs are being written to ${logFile}`)
  process.exit(0)
}

function viewLogs(appName: string, logFile: string): void {
  if (!existsSync(logFile)) {
    console.log(`No log file found for ${appName}.`)
    process.exit(0)
  }

  // Print existing content (last 100 lines)
  const content = readFileSync(logFile, 'utf8')
  const lines = content.split('\n')
  const lastLines = lines.slice(-100).join('\n')
  process.stdout.write(lastLines + '\n')

  let cursor = statSync(logFile).size
  const interval = setInterval(() => {
    try {
      if (existsSync(logFile)) {
        const stats = statSync(logFile)
        if (stats.size > cursor) {
          const stream = createReadStream(logFile, { start: cursor, end: stats.size - 1 })
          stream.pipe(process.stdout, { end: false })
          cursor = stats.size
        } else if (stats.size < cursor) {
          cursor = stats.size
        }
      }
    } catch {
      // Ignore read errors
    }
  }, 250)

  const cleanup = () => {
    clearInterval(interval)
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

export async function handleDaemonCommands(
  appName: string,
  runFn: () => Promise<void>,
): Promise<void> {
  const pidFile = join(PID_DIR, `${appName}.pid`)
  const logFile = join(LOG_DIR, `${appName}.log`)

  // Ensure directories exist
  mkdirSync(PID_DIR, { recursive: true })
  mkdirSync(LOG_DIR, { recursive: true })

  const args = process.argv.slice(2)
  const isStop = args.includes('stop')
  const isRestart = args.includes('restart')
  const isLogs = args.includes('logs')
  const isDaemon = args.includes('-d') && process.env.SHUMAI_DAEMONIZED !== 'true'

  if (isStop) {
    await stopProcess(appName, pidFile)
    process.exit(0)
  }

  if (isRestart) {
    await stopProcess(appName, pidFile)
    await new Promise((resolve) => setTimeout(resolve, 500))
    startDaemon(appName, pidFile, logFile)
    process.exit(0)
  }

  if (isLogs) {
    viewLogs(appName, logFile)
    // Keep process open for logs tailing
    return new Promise(() => {})
  }

  if (isDaemon) {
    startDaemon(appName, pidFile, logFile)
    process.exit(0)
  }

  // Normal Startup logic: check if already running
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10)
    if (!isNaN(pid) && pid !== process.pid) {
      try {
        process.kill(pid, 0)
        console.error(
          `${appName} is already running (PID: ${pid}). Use '${appName} stop' or '${appName} restart'.`,
        )
        process.exit(1)
      } catch {
        // Process is dead, clean up PID file
        try {
          unlinkSync(pidFile)
        } catch {
          // Ignore
        }
      }
    }
  }

  // Write the PID file
  writeFileSync(pidFile, process.pid.toString(), 'utf8')

  const cleanPidFile = () => {
    try {
      if (existsSync(pidFile)) {
        const pidStr = readFileSync(pidFile, 'utf8').trim()
        if (parseInt(pidStr, 10) === process.pid) {
          unlinkSync(pidFile)
        }
      }
    } catch {
      // Ignore
    }
  }

  // Register cleanups
  process.on('exit', cleanPidFile)

  const handleSignal = (signal: string) => {
    cleanPidFile()
    if (process.listenerCount(signal) === 1) {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => handleSignal('SIGINT'))
  process.on('SIGTERM', () => handleSignal('SIGTERM'))

  // Run the main app
  await runFn()
}
