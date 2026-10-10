import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { utcAsLocal } from './wall-clock'

describe('utcAsLocal', () => {
  it('formats the stored UTC digits whatever the viewer zone is', () => {
    const stored = new Date('2026-09-06T23:30:00.000Z')
    expect(format(utcAsLocal(stored), 'yyyy-MM-dd HH:mm')).toBe('2026-09-06 23:30')
  })
})
