export type RunnerLogLevel = 'INFO' | 'WARN' | 'ERROR'

export interface RunnerLogger {
  readonly verbose: boolean
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

/** Formats a local wall-clock timestamp as HH:MM:SS for runner stderr logs. */
export function formatTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Builds a prefixed runner logger writing uniform timestamped lines to stderr. */
export function createRunnerLogger(
  write: (message: string) => void = console.error,
  verbose = false,
  now: () => Date = () => new Date(),
): RunnerLogger {
  const emit = (level: RunnerLogLevel, message: string) => {
    write(`${formatTimestamp(now())} ${level.padEnd(5)} ${message}`)
  }
  return {
    verbose,
    info: (message) => emit('INFO', message),
    warn: (message) => emit('WARN', message),
    error: (message) => emit('ERROR', message),
  }
}

/** Extracts the trailing 4-character tail of an execution ID for compact log labels. */
export function shortId(executionId: string): string {
  return executionId.slice(-4).toLowerCase()
}

/** Formats a millisecond duration as seconds with one decimal place (e.g. `1.8s`). */
export function formatDuration(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`
}

/** Formats a byte count concisely for runner logs (`0`, `128B`, `12KB`, `2.4MB`). */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return kb < 10 ? `${kb.toFixed(1).replace(/\.0$/, '')}KB` : `${Math.round(kb)}KB`
  }
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1).replace(/\.0$/, '')}MB`
}

/** Formats an arbitrary string (command, path, error) as a bounded single-line JSON string. */
export function formatLogString(value: string, maxLength = 200): string {
  const text = value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
  return JSON.stringify(text)
}
