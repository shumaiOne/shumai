import type { AssetInfo } from '@shumai/dtos'
import { afterEach, describe, expect, it } from 'vitest'
import { captureDateOf, groupFilesByDay, wallClockDayKey } from './date-groups'

const file = (id: string, taken?: string): AssetInfo =>
  ({
    id,
    name: `${id}.JPG`,
    fieldValues: taken ? [{ fieldId: 'capture_date', value: taken }] : [],
  }) as unknown as AssetInfo

// Stored the way the app stores it: the camera wall clock written as UTC.
const at = (y: number, mo: number, d: number, h = 12) =>
  new Date(Date.UTC(y, mo - 1, d, h)).toISOString()

describe('captureDateOf', () => {
  it('reads the capture_date field', () => {
    expect(captureDateOf(file('a', at(2026, 9, 6)))?.getUTCDate()).toBe(6)
  })

  it('is null without a date taken or with a bad value', () => {
    expect(captureDateOf(file('a'))).toBeNull()
    expect(captureDateOf(file('b', 'not a date'))).toBeNull()
  })
})

describe('groupFilesByDay', () => {
  it('splits sorted files into contiguous days, keeping their order', () => {
    const files = [
      file('a', at(2026, 9, 6, 15)),
      file('b', at(2026, 9, 6, 9)),
      file('c', at(2026, 9, 5)),
      file('d'),
    ]
    const groups = groupFilesByDay(files, 'No date taken')
    expect(groups.map((g) => g.day)).toEqual(['2026-09-06', '2026-09-05', 'undated'])
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['a', 'b'], ['c'], ['d']])
    expect(groups[2].label).toBe('No date taken')
  })

  it('gives a day that appears in two runs a unique key', () => {
    const groups = groupFilesByDay(
      [file('a', at(2026, 9, 6)), file('b'), file('c', at(2026, 9, 6))],
      'none',
    )
    expect(groups.map((g) => g.key)).toEqual(['2026-09-06', 'undated', '2026-09-06-2'])
  })
})

describe('wall-clock days in any viewer zone', () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  // A shot at 23:30 camera time is stored as 23:30Z and must keep its day for a viewer in
  // UTC+2 (local midnight has passed there) and in UTC-4.
  it.each(['Europe/Helsinki', 'America/New_York', 'UTC'])('keeps 23:30 on its day in %s', (tz) => {
    process.env.TZ = tz
    const late = '2026-09-06T23:30:00.000Z'
    expect(wallClockDayKey(new Date(late))).toBe('2026-09-06')
    const groups = groupFilesByDay([file('a', late), file('b', at(2026, 9, 6, 0))], 'none')
    expect(groups.map((g) => g.day)).toEqual(['2026-09-06'])
  })
})
