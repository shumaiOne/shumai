import { logger } from '@shumai/core/src/logger'

export const DEFAULT_STALE_UPLOAD_HOURS = 24
export const DEFAULT_STALE_SWEEP_MINUTES = 15

/** Longest accepted stale age: one year. */
const MAX_STALE_UPLOAD_HOURS = 24 * 365
/** Longest accepted sweep interval: one day (also keeps setTimeout below its 2^31 ms ceiling). */
const MAX_STALE_SWEEP_MINUTES = 24 * 60

interface NumberEnvSpec {
  name: string
  raw: string | undefined
  fallback: number
  /** Smallest accepted value, inclusive. */
  min: number
  /** Largest accepted value, inclusive. */
  max: number
  /** Where a warning goes; defaults to the server logger. */
  warn?: (message: string) => void
}

/**
 * Read a number from an environment variable. Unset or blank gives the fallback quietly; anything
 * else that is not a finite number inside [min, max] gives the fallback with a warning, so a typo
 * never turns the sweep off or makes it run constantly.
 */
export function parseNumberEnv({
  name,
  raw,
  fallback,
  min,
  max,
  warn = (message) => logger.warn(message),
}: NumberEnvSpec): number {
  const text = raw?.trim()
  if (!text) return fallback
  const value = Number(text)
  if (Number.isFinite(value) && value >= min && value <= max) return value
  warn(
    `Ignoring ${name}="${raw}": expected a number from ${min} to ${max}; using the default ${fallback}`,
  )
  return fallback
}

/** Hours without progress before an upload counts as abandoned (UPLOAD_STALE_AFTER_HOURS, default 24). */
export function staleUploadHours(
  env: NodeJS.ProcessEnv = process.env,
  warn?: (message: string) => void,
): number {
  return parseNumberEnv({
    name: 'UPLOAD_STALE_AFTER_HOURS',
    raw: env.UPLOAD_STALE_AFTER_HOURS,
    fallback: DEFAULT_STALE_UPLOAD_HOURS,
    min: 1 / 60,
    max: MAX_STALE_UPLOAD_HOURS,
    warn,
  })
}

/** Milliseconds between stale-upload sweeps (UPLOAD_STALE_SWEEP_INTERVAL_MINUTES, default 15). */
export function staleSweepIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
  warn?: (message: string) => void,
): number {
  const minutes = parseNumberEnv({
    name: 'UPLOAD_STALE_SWEEP_INTERVAL_MINUTES',
    raw: env.UPLOAD_STALE_SWEEP_INTERVAL_MINUTES,
    fallback: DEFAULT_STALE_SWEEP_MINUTES,
    min: 1,
    max: MAX_STALE_SWEEP_MINUTES,
    warn,
  })
  return Math.round(minutes * 60 * 1000)
}
