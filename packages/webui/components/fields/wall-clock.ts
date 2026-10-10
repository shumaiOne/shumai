/**
 * A wall-clock value is stored as if it were UTC (see core `utils/capture-time.ts`). date-fns
 * formats in the viewer's zone, so shift the date until its local fields equal the stored UTC
 * fields. Intl-based code should pass `timeZone: 'UTC'` instead.
 */
export function utcAsLocal(d: Date): Date {
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  )
}
