import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { type AgentTool, type AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from '@sinclair/typebox'
import { spawn } from 'node:child_process'
import { logger } from '@/logger'

const BashParameters = Type.Object({
  command: Type.String({ description: 'The bash command to execute.' }),
  timeout: Type.Optional(Type.Number({ description: 'Maximum execution time in seconds.' })),
})

type BashDetails = {
  exitCode: number | null
  stdout: string
  stderr: string
}

export const createSandboxedBashTool = (
  cwd: string,
  skillEnvs: Record<string, string> = {},
): AgentTool<typeof BashParameters, BashDetails> => {
  return {
    name: 'bash',
    description: 'Execute a bash command in a sandboxed environment.',
    label: 'Executing bash command',
    parameters: BashParameters,
    execute: async (
      toolCallId,
      { command, timeout },
      signal,
    ): Promise<AgentToolResult<BashDetails>> => {
      const wrappedCommand = await SandboxManager.wrapWithSandbox(command)

      return new Promise((resolve, reject) => {
        const child = spawn('bash', ['-c', wrappedCommand], {
          cwd,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            ...skillEnvs,
          },
        })

        let stdout = ''
        let stderr = ''
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

        child.stdout?.on('data', (data) => {
          stdout += data.toString()
        })
        child.stderr?.on('data', (data) => {
          stderr += data.toString()
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

        child.on('error', (err) => {
          if (timeoutHandle) clearTimeout(timeoutHandle)
          signal?.removeEventListener('abort', onAbort)
          logger.error(
            { err, command, stdout, stderr },
            'Sandboxed bash command encountered process error',
          )
          reject(err)
        })

        child.on('close', (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle)
          signal?.removeEventListener('abort', onAbort)

          if (signal?.aborted) {
            logger.error({ command, stdout, stderr }, 'Sandboxed bash command aborted')
            reject(new Error('aborted'))
          } else if (timedOut) {
            logger.error({ timeout, command, stdout, stderr }, 'Sandboxed bash command timed out')
            reject(new Error(`bash command timed out after ${timeout} seconds`))
          } else if (code !== 0 && code !== null) {
            logger.error(
              { exitCode: code, command, stdout, stderr },
              'Sandboxed bash command exited with failure code',
            )
            reject(new Error(`bash command exited with code ${code}`))
          } else {
            const output = stdout + stderr
            resolve({
              content: [
                {
                  type: 'text',
                  text: output || (code === 0 ? 'Success' : `Failed with exit code ${code}`),
                },
              ],
              details: {
                exitCode: code,
                stdout,
                stderr,
              },
            })
          }
        })
      })
    },
  }
}
