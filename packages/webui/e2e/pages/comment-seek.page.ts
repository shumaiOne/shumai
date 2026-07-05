import type { Locator, Page } from '@playwright/test'
import { SAMPLE_FRAME_RATE, SAMPLE_TOTAL_FRAMES } from '../harness/fixture'

const VIDEO_SELECTOR = '[data-testid="video-area"] video'

/**
 * Snapshot of the player's synchronized state, read from the two independent
 * surfaces that must stay frame-locked after a seek:
 *  - the native <video> element (video.js engine / media clock),
 *  - the numeric frame readout (derived from useFramePlayer's currentFrame).
 */
export interface CommentSeekSnapshot {
  paused: boolean
  currentTime: number
  /** Frame index implied by the native media clock: floor(t * fps + 0.45). */
  nativeFrame: number
  /** Frame index shown in the "N / M fr" readout. */
  readoutFrame: number
}

/**
 * Page object for the comment-seek scenario. It drives the extended video-player
 * harness that reproduces the app's real comment↔player wiring: capturing a
 * comment's `second` from `onTimeUpdate`, seeking on comment click via
 * `player.currentTime(second)`, and remounting the player to simulate a second
 * user opening the page.
 */
export class CommentSeekPage {
  readonly page: Page
  readonly video: Locator
  readonly timeReadout: Locator
  readonly seekFrameInput: Locator
  readonly seekFrameGo: Locator
  readonly createComment: Locator
  readonly reloadUserB: Locator
  readonly commentItems: Locator

  constructor(page: Page) {
    this.page = page
    this.video = page.locator(VIDEO_SELECTOR).first()
    this.timeReadout = page.getByTestId('time-readout')
    this.seekFrameInput = page.getByTestId('seek-frame-input')
    this.seekFrameGo = page.getByTestId('seek-frame-go')
    this.createComment = page.getByTestId('create-comment')
    this.reloadUserB = page.getByTestId('reload-user-b')
    this.commentItems = page.getByTestId('comment-item')
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
    await this.waitUntilReady()
  }

  async gotoVariant(variant: string): Promise<void> {
    await this.page.goto(`/?variant=${encodeURIComponent(variant)}`)
    await this.waitUntilReady()
  }

  /** Wait until the video.js engine has metadata and a usable frame readout. */
  async waitUntilReady(): Promise<void> {
    await this.video.waitFor({ state: 'attached' })
    await this.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector) as HTMLVideoElement | null
        return !!el && el.readyState >= 1 /* HAVE_METADATA */ && Number.isFinite(el.duration)
      },
      VIDEO_SELECTOR,
      { timeout: 15_000 },
    )
    await this.page.waitForFunction(
      (selector) => /\d+\s*\/\s*\d+\s*fr/.test(document.querySelector(selector)?.textContent ?? ''),
      '[data-testid="time-readout"]',
      { timeout: 15_000 },
    )
  }

  /**
   * The fixture has no audio track, but WebKit headless can refuse to start
   * playback for a potentially-audible clip without an explicit muted flag. We
   * never play here, but mute defensively to keep engine behaviour consistent.
   */
  async muteNativeVideo(): Promise<void> {
    await this.video.evaluate((el: HTMLVideoElement) => {
      el.muted = true
    })
  }

  async isPaused(): Promise<boolean> {
    return this.video.evaluate((el: HTMLVideoElement) => el.paused)
  }

  async currentTime(): Promise<number> {
    return this.video.evaluate((el: HTMLVideoElement) => el.currentTime)
  }

  private async readoutFrame(): Promise<number> {
    const text = (await this.timeReadout.textContent()) ?? ''
    const match = text.match(/(\d+)\s*\/\s*\d+\s*fr/)
    return match ? Number.parseInt(match[1], 10) : Number.NaN
  }

  /** Read a coherent snapshot of the native clock and the frame readout. */
  async snapshot(): Promise<CommentSeekSnapshot> {
    const [native, readoutFrame] = await Promise.all([
      this.video.evaluate((el: HTMLVideoElement, fps: number) => {
        return {
          paused: el.paused,
          currentTime: el.currentTime,
          nativeFrame: Math.floor(el.currentTime * fps + 0.45),
        }
      }, SAMPLE_FRAME_RATE),
      this.readoutFrame(),
    ])

    return {
      paused: native.paused,
      currentTime: native.currentTime,
      nativeFrame: native.nativeFrame,
      readoutFrame,
    }
  }

  /**
   * Deterministically position the player on an exact frame (simulating user A
   * scrubbing there) and wait until it has fully settled: paused, with the
   * native clock and the readout both agreeing on the target frame.
   */
  async seekToFrame(frame: number): Promise<void> {
    await this.seekFrameInput.fill(String(frame))
    await this.seekFrameGo.click()
    await this.waitUntilSettledOn(frame)
  }

  /**
   * Wait until the player has settled to a stable, paused frame whose native
   * clock and readout both equal `frame`.
   *
   * Ordering matters:
   *  1. First wait for the player to actually *reach* the target frame. This
   *     uses a synchronous predicate polled at rAF rate — no async work inside
   *     the browser evaluation, so executions never overlap.
   *  2. Only then wait for `currentTime` to stop changing (any post-seek nudge
   *     to the frame center has fully applied). This runs as a sequential loop
   *     in the Node context, so there is likewise no overlapping polling.
   *
   * Doing arrival first avoids the race where `currentTime` looks momentarily
   * stable before the seek has registered in the media engine.
   */
  async waitUntilSettledOn(frame: number): Promise<void> {
    await this.waitForFrame(frame)
    await this.waitForStableCurrentTime()
  }

  /** Wait until the native clock and readout both report `frame` while paused. */
  private async waitForFrame(frame: number): Promise<void> {
    await this.page.waitForFunction(
      ({ selector, fps, target }) => {
        const el = document.querySelector(selector) as HTMLVideoElement | null
        if (!el || !el.paused) return false
        const nativeFrame = Math.floor(el.currentTime * fps + 0.45)
        const readoutEl = document.querySelector('[data-testid="time-readout"]')
        const match = (readoutEl?.textContent ?? '').match(/(\d+)\s*\/\s*\d+\s*fr/)
        const readoutFrame = match ? Number.parseInt(match[1], 10) : Number.NaN
        return nativeFrame === target && readoutFrame === target
      },
      { selector: VIDEO_SELECTOR, fps: SAMPLE_FRAME_RATE, target: frame },
      { timeout: 5_000 },
    )
  }

  /**
   * Wait until `currentTime` stops changing between consecutive reads, driven
   * from Node so browser evaluations are strictly sequential (never overlapping).
   */
  private async waitForStableCurrentTime(): Promise<void> {
    const deadline = Date.now() + 5_000
    let previous = await this.currentTime()
    while (Date.now() < deadline) {
      await this.page.waitForTimeout(80)
      const current = await this.currentTime()
      if (Math.abs(current - previous) < 1e-3) return
      previous = current
    }
    throw new Error('Timed out waiting for currentTime to stabilize')
  }

  async clickCreateComment(): Promise<void> {
    const before = await this.commentItems.count()
    await this.createComment.click()
    await this.page.waitForFunction(
      (expected) => document.querySelectorAll('[data-testid="comment-item"]').length === expected,
      before + 1,
      { timeout: 5_000 },
    )
  }

  async commentCount(): Promise<number> {
    return this.commentItems.count()
  }

  /** The derived frame indices shown on each comment, in list order. */
  async commentFrames(): Promise<number[]> {
    const values = await this.commentItems.evaluateAll((nodes) =>
      nodes.map((n) => Number.parseInt(n.getAttribute('data-comment-frame') ?? '', 10)),
    )
    return values
  }

  clickCommentByIndex(index: number): Promise<void> {
    return this.commentItems.nth(index).click()
  }

  /** Simulate a second user opening the page: remount the player at frame 0. */
  async reloadAsUserB(): Promise<void> {
    await this.reloadUserB.click()
    await this.waitUntilReady()
  }
}

export const FRAME_RATE = SAMPLE_FRAME_RATE
export const TOTAL_FRAMES = SAMPLE_TOTAL_FRAMES
