import { describe, it, expect, vi, afterEach } from 'vitest'
import { Timecode, type TimecodeInput } from './index'

describe('Constructor tests', () => {
  it('no new still gets you Timecode()', () => {
    expect(Timecode(3)).toBeInstanceOf(Timecode)
  })

  it('numbers converted to framecounts', () => {
    expect(Timecode(15).frameCount).toBe(15)
    expect(Timecode(323.443).frameCount).toBe(323)
  })

  it('incorrect initializers throw', () => {
    expect(() => {
      Timecode(1, -1)
    }).toThrow()
    expect(() => {
      Timecode(1, 66.1)
    }).toThrow()
    expect(() => {
      Timecode('dewdew')
    }).toThrow()
    expect(() => {
      Timecode({ w: 3 } as unknown as TimecodeInput)
    }).toThrow()
  })

  it('string initializers work', () => {
    let t = new Timecode('12:33:44;12')
    expect(t.hours).toBe(12)
    expect(t.minutes).toBe(33)
    expect(t.seconds).toBe(44)
    expect(t.frames).toBe(12)
    expect(t.dropFrame).toBe(true)
    expect(t.frameRateNum).toBe(30000)
    expect(t.frameRateDen).toBe(1001)
    expect(t.frameRate).toBe(29.97)

    t = new Timecode('12:33:44:12')
    expect(t.hours).toBe(12)
    expect(t.minutes).toBe(33)
    expect(t.seconds).toBe(44)
    expect(t.frames).toBe(12)
    expect(t.dropFrame).toBe(false)
    expect(t.frameRateNum).toBe(30000)
    expect(t.frameRateDen).toBe(1001)
    expect(t.frameRate).toBe(29.97)

    expect(() => {
      Timecode('40:02:00;02')
    }).toThrow()
    expect(() => {
      Timecode('00:99:00;02')
    }).toThrow()
    expect(() => {
      Timecode('00:02:99;02')
    }).toThrow()
    expect(() => {
      Timecode('00:02:00;35')
    }).toThrow()
  })

  it('initializing from an object', () => {
    const t = new Timecode({ hours: 12, minutes: 34, seconds: 56, frames: 2 })
    expect(t.toString()).toBe('12:34:56;02')
    expect(() => {
      Timecode(0, {} as unknown as number)
    }).toThrow()
  })

  it('initialization defaults', () => {
    const t = Timecode()
    expect(t.frameCount).toBe(0)
    expect(t.frameRate).toBe(29.97)
    expect(t.dropFrame).toBe(true)
    expect(Timecode(1).dropFrame).toBe(true)
    expect(Timecode(1).frameRate).toBe(29.97)
    expect(Timecode(1, 29.97).dropFrame).toBe(true)
    expect(Timecode(1, 59.94).dropFrame).toBe(true)
    expect(Timecode(1, 25).dropFrame).toBe(false)
  })

  it('natural fraction timecodes', () => {
    const t = Timecode('00:02:10;34', [60000, 1001])
    expect(t.frameRate).toBe(59.94)
    const t2 = Timecode('00:02:10;14', [25000, 1001])
    expect(t2.frameRate).toBe(24.98)
  })

  it('drop-frame only for 29.97 and 59.94', () => {
    expect(() => {
      Timecode(0, 30, true)
    }).toThrow()
    expect(() => {
      Timecode(0, 59.94, true)
    }).not.toThrow()
  })

  it('drop-frame counts', () => {
    expect(Timecode('00:10:00;00').frameCount).toBe(17982)
    expect(Timecode('00:10:00;00', 59.94).frameCount).toBe(17982 * 2)
    expect(Timecode('10:00:00;00').frameCount).toBe(1078920)
    expect(Timecode('10:00:00;00', 59.94).frameCount).toBe(1078920 * 2)
    expect(() => {
      Timecode('00:02:00;00')
    }).toThrow()
    expect(() => {
      Timecode('00:02:00;02')
    }).not.toThrow()
    expect(() => {
      Timecode('00:02:00;00', 59.94)
    }).toThrow()
    expect(() => {
      Timecode('00:02:00;02', 59.94)
    }).toThrow()
    expect(() => {
      Timecode('00:02:00;04', 59.94)
    }).not.toThrow()
    expect(Timecode('00:01:59;29').frameCount).toBe(3597)
    expect(Timecode('00:01:59;59', 59.94).frameCount).toBe(3597 * 2 + 1)
    expect(Timecode(17982, 29.97, true).toString()).toBe('00:10:00;00')
    expect(Timecode(1078920, 29.97, true).toString()).toBe('10:00:00;00')
    expect(Timecode(3597, 29.97, true).toString()).toBe('00:01:59;29')
    expect(Timecode(17982 * 2, 59.94, true).toString()).toBe('00:10:00;00')
    expect(Timecode(1078920 * 2, 59.94, true).toString()).toBe('10:00:00;00')
    expect(Timecode(3597 * 2 + 1, 59.94, true).toString()).toBe('00:01:59;59')
  })

  it('non-drop-frame counts', () => {
    expect(Timecode('00:10:00:00', 25).frameCount).toBe(15000)
    expect(Timecode('10:00:00:00', 25).frameCount).toBe(900000)
    expect(Timecode('00:02:00:00', 25).frameCount).toBe(3000)
    expect(Timecode('00:01:59:24', 25).frameCount).toBe(2999)
    expect(Timecode(15000, 25).toString()).toBe('00:10:00:00')
    expect(Timecode(900000, 25).toString()).toBe('10:00:00:00')
    expect(Timecode(2999, 25).toString()).toBe('00:01:59:24')
  })

  it("preserves drop frame and frame rate from 'other' timecode", () => {
    const tc = new Timecode('05:27:00;57', 59.94, true)
    let constructed: Timecode | undefined
    expect(() => {
      constructed = Timecode(tc)
    }).not.toThrow()
    expect(constructed).toEqual(tc)
  })

  it("allows override of drop frame and frame rate from 'other' timecode", () => {
    {
      const tc = new Timecode('05:27:00;57', 59.94, true)
      expect(() => {
        Timecode(tc, 29.97)
      }).toThrow()
    }
    {
      const tc = new Timecode('05:27:00;27', 59.94, true)
      let constructed: Timecode | undefined
      expect(() => {
        constructed = Timecode(tc, 29.97)
      }).not.toThrow()
      expect(constructed).toEqual(new Timecode('05:27:00;27', 29.97, true))
    }
  })
})

describe('String conversions', () => {
  it('back and forth works', () => {
    expect(Timecode('12:34:56;23').toString()).toBe('12:34:56;23')
    expect(Timecode('01:02:03;04').toString()).toBe('01:02:03;04')
    expect(Timecode('12:34:56;57', 59.94).toString()).toBe('12:34:56;57')
    expect(Timecode('01:02:03;04', 59.94).toString()).toBe('01:02:03;04')
  })
  it('implicit calls to toString()', () => {
    expect('+'.concat(Timecode('12:34:56;23') as unknown as string, '+')).toBe('+12:34:56;23+')
    expect(/12.34.56.23/.test(Timecode('12:34:56;23') as unknown as string)).toBe(true)
  })
  it("toString('field')", () => {
    expect(Timecode('12:34:56;23').toString('field')).toBe('12:34:56;23.0')
    expect(Timecode('01:02:03;04').toString('field')).toBe('01:02:03;04.0')
    expect(Timecode('12:34:56;57', 59.94).toString('field')).toBe('12:34:56;28.1')
    expect(Timecode('01:02:03;04', 59.94).toString('field')).toBe('01:02:03;02.0')
  })
  it("toString('unknown-format')", () => {
    expect(() => {
      Timecode('12:34:56;23').toString('unknown-format')
    }).toThrow()
  })
})

describe('Timecode arithmetic', () => {
  it('Timecode() as primitive', () => {
    const t = Timecode('01:23:45;06')
    expect(t.frameCount).toBe(150606)
    expect((t as unknown as number) + 1).toBe(150607)
    expect(12 * (t as unknown as number)).toBe(150606 * 12)
    expect(-(t as unknown as number)).toBe(-150606)
    expect(Math.round(t as unknown as number)).toBe(150606)
    let tNum = t.valueOf()
    tNum++
    expect(tNum).toBe(150607)
  })
  it('Timecode().add() and .subtract()', () => {
    let t = Timecode('01:23:45;06')
    expect(t.add(60).toString()).toBe('01:23:47;06')
    expect(() => {
      Timecode('00:00:10;00').add(-301)
    }).toThrow() // below zero
    expect(Timecode('23:59:40;00').add(Timecode('00:00:21;00')).toString()).toBe('00:00:01;00') // wraparound

    t = Timecode('01:23:45;06')
    expect(t.subtract(60).toString()).toBe('01:23:43;06')
    expect(() => {
      Timecode('00:00:10;00').subtract(301)
    }).toThrow() // below zero

    expect(Timecode('01:23:45;06').add('01:23:13;01').toString()).toBe('02:46:58;07')

    t = Timecode('00:01:15;00')
    const t2 = Timecode('00:01:15;00')
    t2.add(0)
    expect(t.frameCount).toBe(t2.frameCount)
    t2.add(12345)
    expect(t.frameCount).toBe(t2.frameCount - 12345)
  })
  it('handles rollover to new day when permitted', () => {
    expect(() => {
      new Timecode().subtract(new Timecode('23:00:01;00'))
    }).toThrow()
    expect(new Timecode().subtract(new Timecode('23:30:00;00'), 1).toString()).toBe('00:30:00;00')
    expect(() => {
      new Timecode().subtract(new Timecode('22:30:00;00'), 1)
    }).toThrow()
    expect(new Timecode('01:00:00;00').subtract(new Timecode('23:30:00;00'), 2).toString()).toBe(
      '01:30:00;00',
    )
  })
  it('Ensures source frame rate is kept when adding two Timecode objects', () => {
    expect(new Timecode('00:00:00:00', 25, false).add('00:01:00:00').frameCount).toBe(1500)
  })
})

describe('Date() operations', () => {
  it('Date() initializers work', () => {
    const t = new Timecode(new Date(0, 0, 0, 1, 2, 13, 200), 29.97, true)
    expect(t.frameCount).toBe(111884)
    expect(t.toString()).toBe('01:02:13;06')

    const t2 = new Timecode(new Date(0, 0, 0, 10, 40, 15, 520), 25, false)
    expect(t2.frameCount).toBe(960388)
    expect(t2.toString()).toBe('10:40:15:13')
  })
  it('Timecode to Date()', () => {
    const d = Timecode('01:23:45;10').toDate()
    expect(d.getHours()).toBe(1)
    expect(d.getMinutes()).toBe(23)
    expect(d.getSeconds()).toBe(45)
    expect(d.getMilliseconds()).toBe(353)
  })
})

describe('DST handling', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function clearDate(d: Date) {
    d.setFullYear(0)
    d.setMonth(0)
    d.setDate(1)
  }

  function checkDst(d: Date) {
    vi.useFakeTimers()
    vi.setSystemTime(d)

    const t = new Timecode(d, 29.97, true)
    const o = t.toDate()
    clearDate(d)
    clearDate(o)
    expect(o.toString()).toBe(d.toString())
  }

  it('handles DST start 1am', () => {
    checkDst(new Date(2018, 2, 11, 1, 0, 0, 200))
    checkDst(new Date(2018, 2, 11, 1, 59, 59, 200))
  })

  it('handles DST start 2am', () => {
    checkDst(new Date(2018, 2, 11, 2, 0, 0, 200))
    checkDst(new Date(2018, 2, 11, 2, 59, 59, 200))
    checkDst(new Date(2018, 2, 11, 3, 0, 0, 200))
  })

  it('handles DST end 1am', () => {
    checkDst(new Date(2018, 10, 4, 1, 0, 0, 200))
    checkDst(new Date(2018, 10, 4, 1, 59, 59, 200))
  })

  it('handles DST end 2am', () => {
    checkDst(new Date(2018, 10, 4, 2, 0, 0, 200))
    checkDst(new Date(2018, 10, 4, 2, 59, 59, 200))
    checkDst(new Date(2018, 10, 4, 3, 0, 0, 200))
  })
})

describe('Issues', () => {
  it('#36 23.976 Time Code', () => {
    const t = new Timecode('10:00:00;06', 23.976, false)
    expect(t.dropFrame).toBe(false)
    const t1 = new Timecode('10:00:00;06', 23.976)
    expect(t1.dropFrame).toBe(false)
  })

  it('#37 Time Codes >100', () => {
    const t = new Timecode('00:00:10;112', 200, false)
    expect(t.dropFrame).toBe(false)
    expect(t.frameCount).toBe(2112)
    expect(Timecode('12:34:56:578', 600).toString()).toBe('12:34:56:578')
  })

  it('#42 59.94 NDF Time Codes', () => {
    const t = new Timecode(123456, 59.95, false)
    expect(t.dropFrame).toBe(false)
  })
})
