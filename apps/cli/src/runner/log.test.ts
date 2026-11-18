import { describe, expect, it } from 'vitest'
import {
  createRunnerLogger,
  formatBytes,
  formatDuration,
  formatLogString,
  formatTimestamp,
  shortId,
} from './log'

describe('runner log helpers', () => {
  it('formats timestamps and aligned log levels', () => {
    const fixed = new Date(2026, 0, 1, 9, 4, 5)
    expect(formatTimestamp(fixed)).toBe('09:04:05')
    const lines: string[] = []
    const logger = createRunnerLogger(
      (line) => lines.push(line),
      false,
      () => fixed,
    )
    logger.info('Bash started [a8f2]')
    logger.warn('Runner disconnected; reconnecting…')
    logger.error('Fatal error')
    expect(lines).toEqual([
      '09:04:05 INFO  Bash started [a8f2]',
      '09:04:05 WARN  Runner disconnected; reconnecting…',
      '09:04:05 ERROR Fatal error',
    ])
  })

  it('formats short IDs, durations, byte counts, and single-line quoted strings', () => {
    expect(shortId('01JABCDEF1234567890A8F2')).toBe('a8f2')
    expect(shortId('one')).toBe('one')
    expect(formatDuration(1840)).toBe('1.8s')
    expect(formatDuration(-10)).toBe('0.0s')
    expect(formatBytes(0)).toBe('0')
    expect(formatBytes(512)).toBe('512B')
    expect(formatBytes(1536)).toBe('1.5KB')
    expect(formatBytes(12 * 1024)).toBe('12KB')
    expect(formatBytes(Math.round(2.4 * 1024 * 1024))).toBe('2.4MB')
    expect(formatLogString('echo "hi"\nls')).toBe('"echo \\"hi\\"\\nls"')
    expect(formatLogString('x'.repeat(210))).toBe(`"${'x'.repeat(200)}…"`)
  })
})
