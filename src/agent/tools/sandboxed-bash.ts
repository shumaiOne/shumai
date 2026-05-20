import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { createBashTool } from '@mariozechner/pi-coding-agent'
import { spawn } from 'node:child_process'
import type { DatabaseSessionManager } from '../database-session-manager'

export const createSandboxedBashTool = (cwd: string, sessionManager: DatabaseSessionManager) => {
  return createBashTool(cwd, {
    operations: {
      async exec(command, executeCwd, { onData, signal, timeout }) {
        const wrappedCommand = await SandboxManager.wrapWithSandbox(command)
        return new Promise((resolve, reject) => {
          const child = spawn('bash', ['-c', wrappedCommand], {
            cwd: executeCwd,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
              ...sessionManager.getSkillEnvs(),
            },
          })

          let timedOut = false
          let timeoutHandle: NodeJS.Timeout | undefined

          if (timeout !== undefined && timeout > 0) {
            timeoutHandle = setTimeout(() => {
              timedOut = true
              if (child.pid) {
                try {
                  process.kill(-child.pid, 'SIGKILL')
                } catch {
                  child.kill('SIGKILL')
                }
              }
            }, timeout * 1000)
          }

          child.stdout?.on('data', onData)
          child.stderr?.on('data', onData)

          child.on('error', (err) => {
            if (timeoutHandle) clearTimeout(timeoutHandle)
            reject(err)
          })

          const onAbort = () => {
            if (child.pid) {
              try {
                process.kill(-child.pid, 'SIGKILL')
              } catch {
                child.kill('SIGKILL')
              }
            }
          }

          signal?.addEventListener('abort', onAbort, { once: true })

          child.on('close', (code) => {
            if (timeoutHandle) clearTimeout(timeoutHandle)
            signal?.removeEventListener('abort', onAbort)

            if (signal?.aborted) {
              reject(new Error('aborted'))
            } else if (timedOut) {
              reject(new Error(`timeout:${timeout}`))
            } else {
              resolve({ exitCode: code })
            }
          })
        })
      },
    },
  })
}
