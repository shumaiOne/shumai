import { logger } from '@shumai/core/src/logger'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { type AgentTool, type AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from 'typebox'
import { spawn } from 'node:child_process'
import { OutputAccumulator } from '../utils/output-accumulator'
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  type TruncationResult,
} from '../utils/truncate'

const BashSource = Type.String({
  enum: ['user', 'skill'],
  description:
    'Indicates who requested this bash command. Set to "user" when the end user directly ' +
    'requested the command. Set to "skill" when the command is required by a skill you loaded ' +
    'via the read_skill tool. Users without the owner role can only execute commands with ' +
    'source="skill"; source="user" will be blocked.',
})

const BashParameters = Type.Object({
  command: Type.String({ description: 'The bash command to execute.' }),
  timeout: Type.Optional(Type.Number({ description: 'Maximum execution time in seconds.' })),
  source: BashSource,
})

export interface BashDetails {
  exitCode: number | null
  truncation?: TruncationResult
  fullOutputPath?: string
}

export interface SandboxedBashOptions {
  getBlockedHost?: () => string
  clearBlockedHost?: () => void
  /**
   * When true, the tool only allows commands requested by a loaded skill (source="skill").
   * Commands requested directly by the end user (source="user") are blocked.
   */
  restrictedUser?: boolean
}

const BASH_UPDATE_THROTTLE_MS = 100

export const createSandboxedBashTool = (
  cwd: string,
  skillEnvs: Record<string, string> = {},
  options?: SandboxedBashOptions,
): AgentTool<typeof BashParameters, BashDetails> => {
  return {
    name: 'bash',
    description: `Execute a bash command in a sandboxed environment. Returns stdout and stderr. Output is truncated to last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). If truncated, full output is saved to a temp file. Optionally provide a timeout in seconds. When in a restricted (non-owner) user context, only commands required by a skill loaded via the read_skill tool are allowed, and you must set source="skill".`,
    label: 'Executing bash command',
    parameters: BashParameters,
    execute: async (
      toolCallId,
      { command, timeout, source },
      signal,
      onUpdate,
    ): Promise<AgentToolResult<BashDetails>> => {
      if (options?.restrictedUser && source !== 'skill') {
        throw new Error(
          'Bash commands requested directly by the user (source="user") are not permitted for your role. ' +
            'Only commands required by a loaded skill (source="skill") can be executed.',
        )
      }
      options?.clearBlockedHost?.()
      const wrappedCommand = await SandboxManager.wrapWithSandbox(command)

      const output = new OutputAccumulator({ tempFilePrefix: 'shumai-bash' })
      let acceptingOutput = true
      let updateTimer: NodeJS.Timeout | undefined
      let updateDirty = false
      let lastUpdateAt = 0

      const emitOutputUpdate = () => {
        if (!onUpdate || !updateDirty) return
        updateDirty = false
        lastUpdateAt = Date.now()
        const snapshot = output.snapshot({ persistIfTruncated: true })
        onUpdate({
          content: [{ type: 'text', text: snapshot.content || '' }],
          details: {
            exitCode: null,
            truncation: snapshot.truncation.truncated ? snapshot.truncation : undefined,
            fullOutputPath: snapshot.fullOutputPath,
          },
        })
      }

      const clearUpdateTimer = () => {
        if (updateTimer) {
          clearTimeout(updateTimer)
          updateTimer = undefined
        }
      }

      const scheduleOutputUpdate = () => {
        if (!onUpdate) return
        updateDirty = true
        const delay = BASH_UPDATE_THROTTLE_MS - (Date.now() - lastUpdateAt)
        if (delay <= 0) {
          clearUpdateTimer()
          emitOutputUpdate()
          return
        }
        updateTimer ??= setTimeout(() => {
          updateTimer = undefined
          emitOutputUpdate()
        }, delay)
      }

      if (onUpdate) {
        onUpdate({ content: [], details: { exitCode: null } })
      }

      const handleData = (data: Buffer) => {
        if (!acceptingOutput) return
        output.append(data)
        scheduleOutputUpdate()
      }

      const finishOutput = async () => {
        acceptingOutput = false
        output.finish()
        clearUpdateTimer()
        emitOutputUpdate()
        const snapshot = output.snapshot({ persistIfTruncated: true })
        await output.closeTempFile()
        return snapshot
      }

      const formatOutput = (
        snapshot: Awaited<ReturnType<typeof finishOutput>>,
        emptyText = '(no output)',
      ) => {
        const truncation = snapshot.truncation
        let text = snapshot.content || emptyText
        let details: BashDetails | undefined
        if (truncation.truncated) {
          details = { exitCode: null, truncation, fullOutputPath: snapshot.fullOutputPath }
          const startLine = truncation.totalLines - truncation.outputLines + 1
          const endLine = truncation.totalLines
          if (truncation.lastLinePartial) {
            const lastLineSize = formatSize(output.getLastLineBytes())
            text += `\n\n[Showing last ${formatSize(truncation.outputBytes)} of line ${endLine} (line is ${lastLineSize}). Full output: ${snapshot.fullOutputPath}]`
          } else if (truncation.truncatedBy === 'lines') {
            text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}. Full output: ${snapshot.fullOutputPath}]`
          } else {
            text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Full output: ${snapshot.fullOutputPath}]`
          }
        }
        return { text, details }
      }

      const appendStatus = (text: string, status: string) => `${text ? `${text}\n\n` : ''}${status}`

      return new Promise((resolve, reject) => {
        const child = spawn('bash', ['-c', wrappedCommand], {
          cwd,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            PATH: process.env.PATH || '',
            HOME: process.env.HOME || '',
            ...skillEnvs,
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

        child.stdout?.on('data', handleData)
        child.stderr?.on('data', handleData)

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

        child.on('error', async (err) => {
          if (timeoutHandle) clearTimeout(timeoutHandle)
          signal?.removeEventListener('abort', onAbort)
          const snapshot = await finishOutput()
          logger.error(
            { err, command, content: snapshot.content },
            'Sandboxed bash command encountered process error',
          )
          reject(err)
        })

        child.on('close', async (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle)
          signal?.removeEventListener('abort', onAbort)

          const blocked = options?.getBlockedHost?.()
          const snapshot = await finishOutput()
          const { text: outputText, details: truncationDetails } = formatOutput(snapshot)

          if (signal?.aborted) {
            logger.error({ command, outputText }, 'Sandboxed bash command aborted')
            reject(new Error(appendStatus(outputText, 'Command aborted')))
          } else if (timedOut) {
            logger.error({ timeout, command, outputText }, 'Sandboxed bash command timed out')
            reject(
              new Error(
                appendStatus(
                  outputText,
                  `Sandboxed bash command timed out after ${timeout} seconds`,
                ),
              ),
            )
          } else if (blocked) {
            reject(
              new Error(
                `Network request to ${blocked} is blocked, please ask admin to allow it in sandbox settings.`,
              ),
            )
          } else if (code !== 0 && code !== null) {
            logger.error(
              { exitCode: code, command, outputText },
              'Sandboxed bash command exited with failure code',
            )
            reject(
              new Error(
                appendStatus(outputText, `Sandboxed bash command exited with code ${code}`),
              ),
            )
          } else {
            resolve({
              content: [
                {
                  type: 'text',
                  text: outputText,
                },
              ],
              details: {
                exitCode: code,
                ...(truncationDetails ?? {}),
              },
            })
          }
        })
      })
    },
  }
}
