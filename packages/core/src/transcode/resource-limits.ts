import { logger } from '@shumai/core/src/logger'
import { execFile, type ExecFileOptions } from 'child_process'
import { constants as osConstants } from 'os'
import { promisify } from 'util'

/**
 * Opt-in resource limits for the heavy transcode tooling (sharp/libvips, ffmpeg,
 * dcraw_emu, ImageMagick, pdftoppm). Every setting is unset by default, in which
 * case behaviour is identical to before these variables existed.
 *
 * - TRANSCODE_THREADS: threads per transcode job (libvips, ffmpeg, dcraw_emu).
 * - TRANSCODE_NICE: Linux only, run spawned tools under `nice -n <1..19>`.
 *   Tools that go through createExecFileAsync are covered; see docs/configuration/env-variables.mdx.
 *
 * The number of simultaneous jobs is controlled separately by CONCURRENCY_TRANSCODE.
 */

const warned = new Set<string>()
/** Set once `nice` itself turns out to be missing; wrapping is then skipped for good. */
let niceUnavailable = false

function warnOnce(key: string, obj: Record<string, unknown>, msg: string): void {
  if (warned.has(key)) return
  warned.add(key)
  logger.warn(obj, msg)
}

/** Test helper: forget which warnings were already emitted. */
export function resetResourceLimitWarnings(): void {
  warned.clear()
  niceUnavailable = false
}

/**
 * Parses a strictly positive integer env var. Unset or empty returns undefined silently;
 * anything else that is not a whole number >= 1 returns undefined with a warning.
 */
export function parsePositiveIntEnv(name: string, raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  const trimmed = raw.trim()
  const parsed = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    warnOnce(
      `${name}=${raw}`,
      { name, value: raw },
      `Ignoring invalid ${name}: expected a positive whole number`,
    )
    return undefined
  }
  return parsed
}

/** Threads per transcode job from TRANSCODE_THREADS, or undefined when unset or invalid. */
export function getTranscodeThreads(env: NodeJS.ProcessEnv = process.env): number | undefined {
  return parsePositiveIntEnv('TRANSCODE_THREADS', env.TRANSCODE_THREADS)
}

/**
 * Niceness from TRANSCODE_NICE, or undefined when unset, invalid, or not on Linux.
 * Values above 19 are clamped to 19 (the lowest priority).
 */
export function getTranscodeNice(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): number | undefined {
  const parsed = parsePositiveIntEnv('TRANSCODE_NICE', env.TRANSCODE_NICE)
  if (parsed === undefined) return undefined
  if (platform !== 'linux') {
    warnOnce(
      `TRANSCODE_NICE-platform-${platform}`,
      { platform },
      'TRANSCODE_NICE is only supported on Linux; ignoring',
    )
    return undefined
  }
  return Math.min(parsed, 19)
}

/**
 * ffmpeg `-threads` value: an explicit per-job value (team setting) wins, then
 * TRANSCODE_THREADS, otherwise undefined so ffmpeg picks its own default.
 */
export function resolveFfmpegThreads(explicit?: number): number | undefined {
  if (explicit && explicit > 0) return explicit
  return getTranscodeThreads()
}

/** Wraps a command in `nice -n N` when TRANSCODE_NICE is active; otherwise returns it unchanged. */
export function applyTranscodeNice(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): [string, string[]] {
  const nice = getTranscodeNice(env, platform)
  if (nice === undefined || niceUnavailable) return [command, [...args]]
  return ['nice', ['-n', String(nice), command, ...args]]
}

/** Environment overrides that cap threads in OpenMP based tools (dcraw_emu, ImageMagick). */
export function getThreadLimitEnv(): Record<string, string> | undefined {
  const threads = getTranscodeThreads()
  if (threads === undefined) return undefined
  return { OMP_NUM_THREADS: String(threads), MAGICK_THREAD_LIMIT: String(threads) }
}

/** Limits the libvips thread pool used by sharp when TRANSCODE_THREADS is set. */
export function applySharpThreads(sharpLib: { concurrency?: (n?: number) => number }): void {
  const threads = getTranscodeThreads()
  if (threads === undefined || typeof sharpLib.concurrency !== 'function') return
  sharpLib.concurrency(threads)
}

export type ExecFileAsync = (
  command: string,
  args: readonly string[],
  options?: ExecFileOptions,
) => Promise<{ stdout: string; stderr: string }>

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8')
  return ''
}

/**
 * True when `err` is `nice` reporting that the command it was asked to run does not exist
 * or cannot be executed (exit 127 / 126 with "nice: 'cmd': No such file or directory").
 */
function isWrappedCommandMissing(err: unknown, command: string): boolean {
  const code = (err as { code?: unknown } | null)?.code
  if (code !== 127 && code !== 126) return false
  const stderr = textOf((err as { stderr?: unknown }).stderr)
  return stderr
    .split(/\r?\n/)
    .some(
      (line) =>
        line.startsWith('nice:') &&
        line.includes(command) &&
        /no such file or directory|not found/i.test(line),
    )
}

/**
 * Rebuilds the error Node's execFile raises for a missing binary, so callers that fall back on
 * `err.code === 'ENOENT'` (magick to convert, pdftoppm "not found") behave the same under nice.
 * stdout, stderr and the original error (as `cause`) are preserved.
 */
function toEnoentError(err: unknown, command: string, args: readonly string[]): Error {
  const original = err as { stdout?: unknown; stderr?: unknown }
  const enoent = new Error(`spawn ${command} ENOENT`, { cause: err }) as Error &
    Record<string, unknown>
  enoent.errno = -osConstants.errno.ENOENT
  enoent.code = 'ENOENT'
  enoent.syscall = `spawn ${command}`
  enoent.path = command
  enoent.spawnargs = [...args]
  enoent.cmd = [command, ...args].join(' ')
  enoent.stdout = original.stdout
  enoent.stderr = original.stderr
  return enoent
}

export interface ExecFileAsyncDeps {
  /** Underlying promisified execFile (injectable for tests). */
  exec?: ExecFileAsync
  /** Niceness lookup (injectable for tests). */
  getNice?: () => number | undefined
}

/**
 * Promisified `execFile` that applies TRANSCODE_NICE. With the variable unset the command,
 * arguments and options are passed through untouched.
 *
 * Under nice a missing wrapped binary no longer raises ENOENT (nice exits 127 instead), so that
 * case is translated back into a Node style ENOENT error. If `nice` itself is missing, a warning
 * is logged once, niceness is disabled and the call is retried unwrapped.
 */
export function createExecFileAsync(deps: ExecFileAsyncDeps = {}): ExecFileAsync {
  const base: ExecFileAsync = deps.exec ?? (promisify(execFile) as unknown as ExecFileAsync)
  const run = (cmd: string, args: readonly string[], options?: ExecFileOptions) =>
    options ? base(cmd, args, options) : base(cmd, args)
  return async (command, args, options) => {
    const nice = deps.getNice ? deps.getNice() : getTranscodeNice()
    if (nice === undefined || niceUnavailable) return run(command, args, options)
    try {
      return await run('nice', ['-n', String(nice), command, ...args], options)
    } catch (err: unknown) {
      const e = err as { code?: unknown; path?: unknown } | null
      if (e?.code === 'ENOENT' && e.path === 'nice') {
        niceUnavailable = true
        warnOnce(
          'TRANSCODE_NICE-missing-nice',
          {},
          'TRANSCODE_NICE is set but the `nice` command was not found; running tools at normal priority',
        )
        return run(command, args, options)
      }
      if (isWrappedCommandMissing(err, command)) throw toEnoentError(err, command, args)
      throw err
    }
  }
}
