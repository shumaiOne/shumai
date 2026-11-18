import type { RunnerInfo } from '@shumai/dtos'

export interface RunnerSocket {
  send(data: string): void
  close(code?: number, reason?: string): void
}

export interface AuthenticatedRunner {
  id: string
  teamId: string
  name: string
  keyHash: string
}

export interface RunnerExecOptions {
  command: string
  timeoutSec?: number
  env?: Record<string, string>
  signal?: AbortSignal
  onOutput?: (chunk: string, stream: 'stdout' | 'stderr') => void
  /**
   * Whether `exec()` should retain streamed output in memory to return in `RunnerExecResult.output`.
   * Streaming callers should pass `false` to avoid duplicate full-output retention on the server.
   * Defaults to `true`.
   */
  collectOutput?: boolean
  /**
   * Maximum UTF-8 bytes of output retained in memory when `collectOutput` is true.
   * Older output is trimmed from the front so server memory remains bounded.
   */
  maxBufferedOutputBytes?: number
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
