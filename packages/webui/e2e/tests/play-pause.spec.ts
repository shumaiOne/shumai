import { expect, test } from '@playwright/test'
import { FRAME_RATE, TOTAL_FRAMES, VideoPlayerPage } from '../pages/video-player.page'

/**
 * Pure UI integration test for the frame-accurate video player.
 *
 * The player keeps three surfaces in lockstep off a single `currentFrame` state:
 *  1. the native <video> element (video.js media clock),
 *  2. the seekbar fill, and
 *  3. the numeric frame readout.
 *
 * On pause, useFramePlayer snaps the native clock to the paused frame's center
 * time, so after a short settle the native frame, the readout frame and the
 * seekbar fill must all agree. We assert that invariant here rather than trusting
 * any single surface.
 */

const SEEKBAR_TOLERANCE = 0.01 // fraction of the track (~1%), covers sub-pixel + thumb rounding
const HALF_FRAME_SECONDS = 1 / (2 * FRAME_RATE)

test.beforeEach(async ({ page }) => {
  // Mock every backend call so this stays a pure frontend test. The player never
  // hits the API during play/pause, but this guarantees isolation regardless.
  //
  // NOTE: the patterns are anchored to the origin root (/api/, /files/) so they
  // only match real backend requests and NOT Vite-served source modules whose
  // paths happen to contain those segments (e.g. /packages/webui/api/client.ts).
  await page.route(/^https?:\/\/[^/]+\/(api|files)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
})

/**
 * Wait until the player has settled to a stable, paused, fully-synchronized
 * frame, then assert the native clock, the readout and the seekbar all agree.
 */
async function expectPausedAndSynchronized(vp: VideoPlayerPage): Promise<void> {
  await expect.poll(() => vp.isPaused(), { timeout: 5_000 }).toBe(true)

  // Wait for the pause snap + external-seek nudge to fully settle: currentTime
  // stops changing between consecutive reads.
  await expect
    .poll(
      async () => {
        const a = await vp.currentTime()
        await vp.page.waitForTimeout(80)
        const b = await vp.currentTime()
        return Math.abs(b - a) < 1e-3
      },
      { timeout: 5_000 },
    )
    .toBe(true)

  // The UI frame and the native-clock frame converge on the same integer.
  await expect
    .poll(
      async () => {
        const snap = await vp.snapshot()
        return snap.readoutFrame === snap.nativeFrame
      },
      { timeout: 5_000 },
    )
    .toBe(true)

  const snap = await vp.snapshot()

  expect(snap.paused).toBe(true)

  // Readout <-> native media clock.
  expect(snap.readoutFrame).toBe(snap.nativeFrame)

  // Seekbar fill <-> frame index.
  expect(Math.abs(snap.seekbarFraction - snap.nativeFrame / TOTAL_FRAMES)).toBeLessThan(
    SEEKBAR_TOLERANCE,
  )

  // Native clock is snapped to the paused frame's center time.
  const frameCenter = snap.nativeFrame / FRAME_RATE + HALF_FRAME_SECONDS
  expect(Math.abs(snap.currentTime - frameCenter)).toBeLessThan(HALF_FRAME_SECONDS + 1e-6)
}

/** Assert the player is genuinely stopped: the frame does not advance over time. */
async function expectPlayheadStopped(vp: VideoPlayerPage): Promise<void> {
  const first = await vp.snapshot()
  await vp.page.waitForTimeout(300)
  const second = await vp.snapshot()
  // The integer frame is the robust "not advancing" signal.
  expect(second.readoutFrame).toBe(first.readoutFrame)
  // currentTime must not advance meaningfully. A playing video would move ~0.3s
  // in 300ms; a stopped one moves less than a frame (browser seeks land *near*,
  // not exactly on, the requested frame-center, and the pause snap may still be
  // settling), so half a frame cleanly separates stopped from playing.
  expect(Math.abs(second.currentTime - first.currentTime)).toBeLessThan(HALF_FRAME_SECONDS)
}

test.describe('video player play/pause', () => {
  test('toggles via the play/pause control', async ({ page }) => {
    const vp = new VideoPlayerPage(page)
    await vp.goto()
    await vp.muteNativeVideo()

    // Starts paused at frame 0.
    const initial = await vp.snapshot()
    expect(initial.paused).toBe(true)
    expect(initial.readoutFrame).toBe(0)

    // Play via the control -> playback starts and the readout advances.
    await vp.clickPlayToggle()
    await expect.poll(() => vp.isPaused(), { timeout: 5_000 }).toBe(false)
    await expect
      .poll(async () => (await vp.snapshot()).readoutFrame, { timeout: 5_000 })
      .toBeGreaterThan(initial.readoutFrame)

    // Pause via the control -> everything re-synchronizes and stays put.
    await vp.clickPlayToggle()
    await expectPausedAndSynchronized(vp)
    await expectPlayheadStopped(vp)
  })

  test('toggles via clicking the video area', async ({ page }) => {
    const vp = new VideoPlayerPage(page)
    await vp.goto()
    await vp.muteNativeVideo()

    const initial = await vp.snapshot()
    expect(initial.paused).toBe(true)
    expect(initial.readoutFrame).toBe(0)

    // Click the video surface to play.
    await vp.clickVideoArea()
    await expect.poll(() => vp.isPaused(), { timeout: 5_000 }).toBe(false)
    await expect
      .poll(async () => (await vp.snapshot()).readoutFrame, { timeout: 5_000 })
      .toBeGreaterThan(initial.readoutFrame)

    // Click again to pause -> native clock, readout and seekbar agree.
    await vp.clickVideoArea()
    await expectPausedAndSynchronized(vp)
    await expectPlayheadStopped(vp)
  })
})
