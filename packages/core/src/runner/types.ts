import type { RunnerInfo } from '@shumai/dtos'

export interface RunnerSocket {
  send(data: string): void
  close(code?: number, reason?: string): void
}

export interface RunnerExecOptions {
  command: string
  timeoutSec?: number
  env?: Record<string, string>
  signal?: AbortSignal
  onOutput?: (chunk: string, stream: 'stdout' | 'stderr') => void
}

export interface RunnerExecResult {
  executionId: string
  output: string
  exitCode: number | null
  signal: string | null
  timedOut: boolean
  aborted: boolean
  fullOutputPath?: string
  error?: string
}

export interface ResolvedRunnerTarget {
  hasConfiguredRunner: boolean
  runner: RunnerInfo | null
  isBoundToAgent: boolean
}
