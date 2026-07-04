import type { Locator, Page } from '@playwright/test'
import { SAMPLE_FRAME_RATE, SAMPLE_TOTAL_FRAMES } from '../harness/fixture'

const VIDEO_SELECTOR = '[data-testid="video-area"] video'

/**
 * Snapshot of the player's synchronized state, read from the three independent
 * surfaces that must stay frame-locked:
 *  - the native <video> element (video.js engine / media clock),
 *  - the seekbar fill (derived from useFramePlayer's currentFrame),
 *  - the numeric frame readout (also derived from currentFrame).
 */
export interface PlayerSnapshot {
  paused: boolean
  ended: boolean
  currentTime: number
  /** Frame index implied by the native media clock: floor(t * fps + 0.45). */
  nativeFrame: number
  /** Frame index shown in the "N / M fr" readout. */
  readoutFrame: number
  /** Seekbar fill width as a fraction (0..1) of the track width. */
  seekbarFraction: number
}

export class VideoPlayerPage {
  readonly page: Page
  readonly stage: Locator
  readonly videoArea: Locator
  readonly playToggle: Locator
  readonly video: Locator
  readonly seekbar: Locator
  readonly seekbarFill: Locator
  readonly timeReadout: Locator

  constructor(page: Page) {
    this.page = page
    this.stage = page.getByTestId('harness-stage')
    this.videoArea = page.getByTestId('video-area')
    this.playToggle = page.getByTestId('play-toggle')
    this.video = page.locator(VIDEO_SELECTOR).first()
    this.seekbar = page.getByTestId('seekbar')
    this.seekbarFill = page.getByTestId('seekbar-fill')
    this.timeReadout = page.getByTestId('time-readout')
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
    await this.waitUntilReady()
  }

  /**
   * Navigate to the harness with a specific fixture variant (see the harness
   * `resolveAsset`), e.g. `'container-longer'` for the asset whose container
   * duration exceeds its real video stream.
   */
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
    // The readout renders "N / M fr" once currentFrame state is wired up.
    await this.page.waitForFunction(
      (selector) => /\d+\s*\/\s*\d+\s*fr/.test(document.querySelector(selector)?.textContent ?? ''),
      '[data-testid="time-readout"]',
      { timeout: 15_000 },
    )
  }

  /**
   * Some engines (notably WebKit headless) refuse to start playback for a clip
   * that could produce sound without an explicit muted flag. The fixture has no
   * audio track, but we mute defensively so play() resolves consistently.
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

  /** The total frame index shown as "M" in the "N / M fr" readout. */
  async readoutTotalFrame(): Promise<number> {
    const text = (await this.timeReadout.textContent()) ?? ''
    const match = text.match(/\d+\s*\/\s*(\d+)\s*fr/)
    return match ? Number.parseInt(match[1], 10) : Number.NaN
  }

  private async seekbarFraction(): Promise<number> {
    const track = await this.seekbar.boundingBox()
    const fill = await this.seekbarFill.boundingBox()
    if (!track || !fill || track.width === 0) return 0
    return fill.width / track.width
  }

  /** Read a coherent snapshot of all three synchronized surfaces. */
  async snapshot(): Promise<PlayerSnapshot> {
    const [native, readoutFrame, seekbarFraction] = await Promise.all([
      this.video.evaluate((el: HTMLVideoElement, fps: number) => {
        return {
          paused: el.paused,
          ended: el.ended,
          currentTime: el.currentTime,
          nativeFrame: Math.floor(el.currentTime * fps + 0.45),
        }
      }, SAMPLE_FRAME_RATE),
      this.readoutFrame(),
      this.seekbarFraction(),
    ])

    return {
      paused: native.paused,
      ended: native.ended,
      currentTime: native.currentTime,
      nativeFrame: native.nativeFrame,
      readoutFrame,
      seekbarFraction,
    }
  }

  /**
   * Jump the native media clock to a given frame's center time via a real
   * external seek (sets `video.currentTime`, which fires `seeked` and drives
   * useFramePlayer). Used to land near the end of the clip so the "play to end"
   * wait is short and deterministic instead of streaming the whole fixture.
   */
  async seekToFrame(frame: number): Promise<void> {
    await this.video.evaluate(
      (el: HTMLVideoElement, args: { frame: number; fps: number }) => {
        const frameDuration = 1 / args.fps
        el.currentTime = args.frame * frameDuration + frameDuration / 2
      },
      { frame, fps: SAMPLE_FRAME_RATE },
    )
  }

  /** Wait until the native <video> element reports that playback has ended. */
  async waitForEnded(timeout = 10_000): Promise<void> {
    await this.video.evaluate(
      (el: HTMLVideoElement) =>
        el.ended
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              el.addEventListener('ended', () => resolve(), { once: true })
            }),
      undefined,
      { timeout },
    )
  }

  clickPlayToggle(): Promise<void> {
    return this.playToggle.click()
  }

  clickVideoArea(): Promise<void> {
    // The drawing-canvas overlay is pointer-events:none when not drawing, so the
    // click lands on the video-area div and triggers togglePlay.
    return this.videoArea.click({ position: { x: 20, y: 20 } })
  }
}

export const FRAME_RATE = SAMPLE_FRAME_RATE
export const TOTAL_FRAMES = SAMPLE_TOTAL_FRAMES
