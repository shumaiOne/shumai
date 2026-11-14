import {
  type ToolRegistration as AgentTool,
  type ToolExecutionResult as AgentToolResult,
} from '@earendil-works/pi-durable'
import { logger } from '@shumai/core/src/logger'
import { quotaService } from '@shumai/core/src/quota/quota-service'
import { runnerService } from '@shumai/core/src/runner'
import type { TeamMemberRole } from '@shumai/db'
import { Type } from 'typebox'
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
  inputFiles: Type.Optional(
    Type.Union([
      Type.Array(Type.String(), {
        description:
          'Optional list of generated file paths (e.g. ".pi/generated/<id>/<filename>") to stage into the runner workspace before executing the command.',
      }),
      Type.Null(),
    ]),
  ),
})

export type BashDetails = {
  exitCode: number | null
  truncation?: TruncationResult
  fullOutputPath?: string
}

export interface LoadedSkillRef {
  id: string
  assetId: string
  hash: string
}

export interface SandboxedBashOptions {
  teamId?: string
  agentRunnerId?: string | null
  runnerId?: string
  userId?: string
  role?: TeamMemberRole | null
  /**
   * When true, the tool only allows commands requested by a loaded skill (source="skill").
   * Commands requested directly by the end user (source="user") are blocked.
   */
  restrictedUser?: boolean
  getLoadedSkills?: () => Iterable<LoadedSkillRef>
}

export const createSandboxedBashTool = (
  _cwd: string,
  skillEnvs: Record<string, string> = {},
  options?: SandboxedBashOptions,
): AgentTool<typeof BashParameters, BashDetails> => {
  return {
    name: 'bash',
    description: `Execute a bash command on the configured runner environment. Returns stdout and stderr. Output is truncated to last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). If truncated, full output is saved to a log file in .pi/logs/ on the runner. Optionally provide a timeout in seconds, or inputFiles to stage generated files (.pi/generated/...) into the runner workspace before running. When in a restricted (non-owner) user context, only commands required by a skill loaded via the read_skill tool are allowed, and you must set source="skill".`,
    parameters: BashParameters,
    outputLimits: { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES, retain: 'tail' },
    execute: async (
      { command, timeout, source, inputFiles },
      api,
      context,
    ): Promise<AgentToolResult<BashDetails>> => {
      const signal = context.abortSignal
      if (options?.restrictedUser && source !== 'skill') {
        throw new Error(
          'Bash commands requested directly by the user (source="user") are not permitted for your role. ' +
            'Only commands required by a loaded skill (source="skill") can be executed.',
        )
      }
      if (options?.teamId) {
        await quotaService.checkQuota(
          {
            teamId: options.teamId,
            userId: options.userId,
            role: options.role,
            resource: 'agent_bash_call_count',
            resourceData: { command },
          },
          1,
        )
      }

      let targetRunnerId: string
      if (options?.runnerId) {
        if (!runnerService.isRunnerConnected(options.runnerId)) {
          throw new Error(
            'Runner is currently offline. Please start your runner with "shumai runner start" and try again.',
          )
        }
        targetRunnerId = options.runnerId
      } else if (options?.teamId) {
        const runner = await runnerService.requireOnlineRunner(
          options.teamId,
          options.agentRunnerId,
        )
        targetRunnerId = runner.id
      } else {
        throw new Error('No runner configured for this session.')
      }

      // Ensure any loaded skills in this session are extracted on the runner before executing bash
      if (options?.getLoadedSkills) {
        for (const skill of options.getLoadedSkills()) {
          await runnerService.ensureSkillOnRunner(targetRunnerId, skill)
        }
      }

      // Stage any explicitly requested generated files (.pi/generated/<id>/<file>) onto the runner
      if (inputFiles && Array.isArray(inputFiles)) {
        for (const filePath of inputFiles) {
          await runnerService.ensureGeneratedFileOnRunner(targetRunnerId, filePath)
        }
      }

      const output = new OutputAccumulator({
        tempFilePrefix: 'shumai-bash',
        disableTempFile: true,
      })
      let acceptingOutput = true
      await api.details({ exitCode: null }, context)

      const handleData = (data: Buffer) => {
        if (!acceptingOutput) return
        output.append(data)
        api.output(data)
      }

      const finishOutput = async () => {
        acceptingOutput = false
        output.finish()
        const snapshot = output.snapshot({ persistIfTruncated: false })
        await output.closeTempFile()
        return snapshot
      }

      const formatOutput = (
        snapshot: Awaited<ReturnType<typeof finishOutput>>,
        runnerLogPath: string,
        emptyText = '(no output)',
      ) => {
        const truncation = snapshot.truncation
        let text = snapshot.content || emptyText
        let details: BashDetails | undefined
        if (truncation.truncated) {
          details = { exitCode: null, truncation, fullOutputPath: runnerLogPath }
          const startLine = truncation.totalLines - truncation.outputLines + 1
          const endLine = truncation.totalLines
          if (truncation.lastLinePartial) {
            const lastLineSize = formatSize(output.getLastLineBytes())
            text += `\n\n[Showing last ${formatSize(truncation.outputBytes)} of line ${endLine} (line is ${lastLineSize}). Full output: ${runnerLogPath}]`
          } else if (truncation.truncatedBy === 'lines') {
            text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}. Full output: ${runnerLogPath}]`
          } else {
            text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Full output: ${runnerLogPath}]`
          }
        }
        return { text, details }
      }

      const appendStatus = (text: string, status: string) => `${text ? `${text}\n\n` : ''}${status}`

      const execResult = await runnerService.exec(targetRunnerId, {
        command,
        timeoutSec: timeout,
        env: skillEnvs,
        signal,
        onOutput: (chunk) => handleData(Buffer.from(chunk, 'utf-8')),
      })

      const snapshot = await finishOutput()
      const runnerLogPath =
        execResult.fullOutputPath || `.pi/logs/bash-${execResult.executionId}.log`
      const { text: outputText, details: truncationDetails } = formatOutput(snapshot, runnerLogPath)

      if (options?.teamId) {
        try {
          await quotaService.consumeQuota(
            {
              teamId: options.teamId,
              userId: options.userId,
              role: options.role,
              resource: 'agent_bash_call_count',
              resourceData: { command },
            },
            1,
          )
        } catch (err) {
          logger.error({ err }, 'Failed to record quota usage for bash command')
        }
      }

      if (signal?.aborted || execResult.aborted) {
        logger.error({ command, outputText }, 'Sandboxed bash command aborted')
        throw new Error(appendStatus(outputText, 'Command aborted'))
      }

      if (execResult.timedOut) {
        logger.error({ timeout, command, outputText }, 'Sandboxed bash command timed out')
        throw new Error(
          appendStatus(outputText, `Sandboxed bash command timed out after ${timeout} seconds`),
        )
      }

      if (execResult.error) {
        logger.error(
          { error: execResult.error, command, outputText },
          'Sandboxed bash command encountered runner error',
        )
        throw new Error(appendStatus(outputText, execResult.error))
      }

      if (execResult.exitCode !== 0 && execResult.exitCode !== null) {
        logger.error(
          { exitCode: execResult.exitCode, command, outputText },
          'Sandboxed bash command exited with failure code',
        )
        throw new Error(
          appendStatus(
            outputText,
            `Sandboxed bash command exited with code ${execResult.exitCode}`,
          ),
        )
      }

      return {
        output: [
          {
            type: 'text',
            text: outputText,
          },
        ],
        details: {
          exitCode: execResult.exitCode,
          ...(truncationDetails ?? {}),
        },
      }
    },
  }
}
