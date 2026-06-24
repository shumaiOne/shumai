export interface TimecodeObject {
  hours: number
  minutes: number
  seconds: number
  frames: number
  dropFrame?: boolean
  frameRate?: number
  frameRateNum?: number
  frameRateDen?: number
}

export type TimecodeInput = number | string | Date | TimecodeObject | Timecode

class TimecodeImpl {
  public frameCount: number = 0
  public dropFrame: boolean = false
  public frameRateNum: number = 30000
  public frameRateDen: number = 1001
  public frameRate: number = 29.97

  public hours: number = 0
  public minutes: number = 0
  public seconds: number = 0
  public frames: number = 0

  constructor(
    timeCode?: TimecodeInput,
    frameRate?: number | [number, number],
    dropFrame?: boolean,
  ) {
    this.frameRateDen = 0
    if (typeof dropFrame === 'boolean') {
      this.dropFrame = dropFrame
    }

    if (frameRate === undefined) {
      this.frameRateNum = 30000
      this.frameRateDen = 1001
      if (typeof dropFrame !== 'boolean') {
        this.dropFrame = true
      }
    } else if (Array.isArray(frameRate)) {
      if (
        frameRate.length >= 2 &&
        typeof frameRate[0] === 'number' &&
        typeof frameRate[1] === 'number'
      ) {
        this.frameRateNum = frameRate[0]
        this.frameRateDen = frameRate[1]
      } else {
        throw new Error('Invalid framerate array. Expected [numerator, denominator].')
      }
    } else if (typeof frameRate === 'number') {
      if (frameRate <= 0) {
        throw new Error('Framerate must be positive.')
      }
      const frameRateRound = Math.round(frameRate)
      if (frameRate === frameRateRound) {
        this.frameRateNum = frameRate
        this.frameRateDen = 1
      } else if (
        frameRate < frameRateRound &&
        (frameRateRound === 24 || frameRateRound === 30 || frameRateRound === 60)
      ) {
        this.frameRateNum = frameRateRound * 1000
        this.frameRateDen = 1001
        if (frameRateRound !== 24 && typeof dropFrame !== 'boolean') {
          this.dropFrame = true
        }
      }
    } else {
      throw new Error(
        'Invalid framerate. Either a number or an array of [numerator, denominator] are expected.',
      )
    }

    if (this.frameRateDen === 0) {
      throw new Error(
        'Invalid framerate. Either a number or an array of [numerator, denominator] are expected.',
      )
    }

    this.frameRate = this.frameRateNum / this.frameRateDen
    if (this.frameRateDen !== 1) {
      this.frameRate = Math.round((this.frameRate + Number.EPSILON) * 100) / 100
    }

    if (typeof timeCode === 'number') {
      this.frameCount = Math.round(timeCode)
      this._frameCountToTimeCode()
    } else if (typeof timeCode === 'string') {
      const parts = timeCode.match(/^([012]\d):(\d\d):(\d\d)(:|;|\.)(\d+)$/)
      if (!parts) {
        throw new Error('Timecode string expected as HH:MM:SS:FF or HH:MM:SS;FF')
      }
      this.hours = parseInt(parts[1], 10)
      this.minutes = parseInt(parts[2], 10)
      this.seconds = parseInt(parts[3], 10)
      if (typeof dropFrame !== 'boolean') {
        this.dropFrame = parts[4] !== ':' && this.frameRate > 25
      }
      this.frames = parseInt(parts[5], 10)
      this._timeCodeToFrameCount()
    } else if (timeCode instanceof Date) {
      const midnight = new Date(
        timeCode.getFullYear(),
        timeCode.getMonth(),
        timeCode.getDate(),
        0,
        0,
        0,
      )
      const midnightTz = midnight.getTimezoneOffset() * 60 * 1000
      const timecodeTz = timeCode.getTimezoneOffset() * 60 * 1000
      this.frameCount = Math.round(
        ((timeCode.getTime() - midnight.getTime() + (midnightTz - timecodeTz)) * this.frameRate) /
          1000,
      )
      this._frameCountToTimeCode()
    } else if (timeCode && typeof timeCode === 'object' && 'hours' in timeCode) {
      const tcObj = timeCode as TimecodeObject
      if (!frameRate && tcObj.frameRate) {
        this.frameRate = tcObj.frameRate
        this.frameRateDen = tcObj.frameRateDen || 1
        this.frameRateNum = tcObj.frameRateNum || Math.round(this.frameRate)
      }
      if (typeof timeCode.dropFrame === 'boolean') {
        this.dropFrame = timeCode.dropFrame
      }
      this.hours = timeCode.hours
      this.minutes = timeCode.minutes
      this.seconds = timeCode.seconds
      this.frames = timeCode.frames
      this._timeCodeToFrameCount()
    } else if (timeCode === undefined) {
      this.frameCount = 0
    } else {
      throw new Error('Timecode() constructor expects a number, timecode string, or Date()')
    }

    this._validate(timeCode)
  }

  private _validate(timeCode: TimecodeInput | undefined): void {
    if (this.dropFrame && this.frameRateDen !== 1001) {
      throw new Error('Drop frame is only supported for 23.976, 29.97, and 59.94 fps')
    }

    const dfLimit = 2 * (this.frameRate / 29.97)
    if (
      this.hours > 23 ||
      this.minutes > 59 ||
      this.seconds > 59 ||
      this.frames >= this.frameRate ||
      (this.dropFrame && this.seconds === 0 && this.minutes % 10 !== 0 && this.frames < dfLimit)
    ) {
      throw new Error('Invalid timecode: ' + JSON.stringify(timeCode))
    }
  }

  private _frameCountToTimeCode(): void {
    let fc = this.frameCount
    if (this.dropFrame) {
      const df = this.frameRate <= 30 ? 2 : 4
      const d = Math.floor(this.frameCount / Math.floor((17982 * df) / 2))
      let m = this.frameCount % Math.floor((17982 * df) / 2)
      if (m < df) {
        m = m + df
      }
      fc += 9 * df * d + df * Math.floor((m - df) / Math.floor((1798 * df) / 2))
    }
    const fps = Math.round(this.frameRate)
    this.frames = fc % fps
    this.seconds = Math.floor(fc / fps) % 60
    this.minutes = Math.floor(fc / (fps * 60)) % 60
    this.hours = Math.floor(fc / (fps * 3600)) % 24
  }

  private _timeCodeToFrameCount(): void {
    this.frameCount =
      (this.hours * 3600 + this.minutes * 60 + this.seconds) * Math.round(this.frameRate) +
      this.frames
    if (this.dropFrame) {
      const totalMinutes = this.hours * 60 + this.minutes
      const df = this.frameRate < 30 ? 2 : 4
      this.frameCount -= df * (totalMinutes - Math.floor(totalMinutes / 10))
    }
  }

  public toString(format?: string): string {
    let frames = this.frames
    let field = ''
    if (typeof format === 'string') {
      if (format === 'field') {
        if (this.frameRate <= 30) {
          field = '.0'
        } else {
          frames = Math.floor(frames / 2)
          field = '.'.concat((this.frameCount % 2).toString())
        }
      } else {
        throw new Error('Unsupported string format')
      }
    }
    return ''.concat(
      String(this.hours).padStart(2, '0'),
      ':',
      String(this.minutes).padStart(2, '0'),
      ':',
      String(this.seconds).padStart(2, '0'),
      this.dropFrame ? ';' : ':',
      String(frames).padStart(String(Math.round(this.frameRate)).length, '0'),
      field,
    )
  }

  public valueOf(): number {
    return this.frameCount
  }

  public add(t: TimecodeInput, negative?: boolean, rollOverMaxHours?: number): this {
    if (typeof t === 'number') {
      let newFrameCount = this.frameCount + Math.round(t) * (negative ? -1 : 1)
      if (newFrameCount < 0 && rollOverMaxHours && rollOverMaxHours > 0) {
        newFrameCount = Math.round(this.frameRate * 86400) + newFrameCount
        if (newFrameCount / this.frameRate / 3600 > rollOverMaxHours) {
          throw new Error('Rollover arithmetic exceeds max permitted')
        }
      }
      if (newFrameCount < 0) {
        throw new Error('Negative timecodes not supported')
      }
      this.frameCount = newFrameCount
    } else {
      let tcToAdd: Timecode
      if (t instanceof Timecode) {
        tcToAdd = t
      } else {
        tcToAdd = new Timecode(t, [this.frameRateNum, this.frameRateDen], this.dropFrame)
      }
      return this.add(tcToAdd.frameCount, negative, rollOverMaxHours)
    }

    this.frameCount = this.frameCount % Math.round(this.frameRate * 86400) // wraparound 24h
    this._frameCountToTimeCode()
    return this
  }

  public subtract(t: TimecodeInput, rollOverMaxHours?: number): this {
    return this.add(t, true, rollOverMaxHours)
  }

  public toDate(): Date {
    const ms = (this.frameCount / (this.frameRateNum / this.frameRateDen)) * 1000
    const midnight = new Date()
    midnight.setHours(0)
    midnight.setMinutes(0)
    midnight.setSeconds(0)
    midnight.setMilliseconds(0)

    const d = new Date(midnight.valueOf() + ms)
    const midnightTz = midnight.getTimezoneOffset() * 60 * 1000
    const timecodeTz = d.getTimezoneOffset() * 60 * 1000
    return new Date(midnight.valueOf() + ms + (timecodeTz - midnightTz))
  }
}

export type Timecode = TimecodeImpl

export const Timecode = function (
  this: unknown,
  timeCode?: TimecodeInput,
  frameRate?: number | [number, number],
  dropFrame?: boolean,
) {
  if (!(this instanceof TimecodeImpl)) {
    return new (Timecode as unknown as {
      new (
        timeCode?: TimecodeInput,
        frameRate?: number | [number, number],
        dropFrame?: boolean,
      ): Timecode
    })(timeCode, frameRate, dropFrame)
  }
  const impl = new TimecodeImpl(timeCode, frameRate, dropFrame)
  Object.assign(this as object, impl)
} as unknown as {
  new (
    timeCode?: TimecodeInput,
    frameRate?: number | [number, number],
    dropFrame?: boolean,
  ): Timecode
  (timeCode?: TimecodeInput, frameRate?: number | [number, number], dropFrame?: boolean): Timecode
}

Timecode.prototype = TimecodeImpl.prototype
