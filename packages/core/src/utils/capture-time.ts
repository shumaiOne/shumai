/**
 * The `capture_date` convention: it is the local wall-clock time at the camera, stored as if it
 * were UTC. A photo taken at 23:30 in Helsinki is "...T23:30:00.000Z" whatever zone the viewer
 * is in, and the UI renders it with `timeZone: 'UTC'`, so it always shows 23:30 on that day.
 */

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/

/** Wall-clock components to the "as if UTC" ISO string, or undefined when they are not a date. */
export function wallClockToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond = 0,
): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))
  // Date.UTC rolls 13/45 over instead of failing, so check the parts survived.
  const intact =
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  return intact ? date.toISOString() : undefined
}

/**
 * The wall clock of an ISO-like local timestamp with an optional offset, such as the QuickTime
 * `com.apple.quicktime.creationdate` tag ("2026-09-06T23:30:12+0200"). The offset is dropped on
 * purpose: the digits are what the camera's clock showed. Undefined when it is not such a string.
 */
export function wallClockFromLocalTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const m = WALL_CLOCK.exec(value.trim())
  if (!m) return undefined
  const ms = m[7] ? Number(m[7].padEnd(3, '0')) : 0
  return wallClockToIso(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6], ms)
}

/**
 * A video's date taken. ffprobe's `creation_time` is a true UTC instant whose zone is unknown, so
 * it cannot give the camera's wall clock. When the container also carries a local-time tag with
 * an offset (Apple's `com.apple.quicktime.creationdate`), that tag's wall clock wins. Otherwise
 * the UTC value is kept, which shows the UTC time of day: a known limitation for cameras that
 * record only `creation_time`. Years before 1991 (an unset clock) are ignored.
 */
export function videoCaptureTime(tags: {
  localCreationDate?: unknown
  creationTime?: unknown
}): string | undefined {
  const local = wallClockFromLocalTimestamp(tags.localCreationDate)
  if (local && new Date(local).getUTCFullYear() > 1990) return local
  if (typeof tags.creationTime !== 'string') return undefined
  const created = new Date(tags.creationTime)
  return !isNaN(created.getTime()) && created.getUTCFullYear() > 1990
    ? created.toISOString()
    : undefined
}
