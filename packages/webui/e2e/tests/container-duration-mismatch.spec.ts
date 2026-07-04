import { expect, test } from '@playwright/test'
import { VideoPlayerPage } from '../pages/video-player.page'
import { REAL_LAST_FRAME, SAMPLE_TOTAL_FRAMES } from '../harness/fixture'

/**
 * Regression reproduction for the frame-count inflation bug.
 *
 * When an asset's container/format duration is slightly LONGER than its actual
 * video stream (common: audio padding / container overhead), the player derived
 * `totalFrames` from the container duration (`round(duration * fps)`) instead of
 * the accurate stream frame count (`metadata.totalFrames` == ffprobe nb_frames).
 * This invents phantom trailing frames that do not exist in the stream, so:
 *
 *   - normal playback stops N frames SHORT of the displayed maximum (it can only
 *     reach the last real frame), and
 *   - frame-stepping can walk PAST the last real frame onto phantom frames.
 *
 * The `container-longer` fixture reports duration 5.075s while the real backing
 * video is exactly 150 frames @ 30fps (5.0s stream). The buggy heuristic derives
 * round(5.075*30) = 152 frames, so the readout shows "/ 151 fr" even though the
 * last real (and last reachable) frame is 149.
 *
 * Correct behaviour (asserted below): playing to the natural end must land on
 * the last displayed frame — i.e. the readout's current frame equals the
 * readout's total frame, and that total equals the real last frame of the
 * stream. This spec FAILS against the buggy build and PASSES once totalFrames is
 * derived from the accurate stream frame count.
 */

// Land a few frames from the real end so playing out the tail (and firing the
// native `ended` event) is fast and deterministic.
const NEAR_END_FRAME = SAMPLE_TOTAL_FRAMES - 3

test.beforeEach(async ({ page }) => {
  // Mock every backend call so this stays a pure frontend test (mirrors the
  // other player specs). Patterns are anchored to the origin root so they only
  // match real backend requests, not Vite-served source modules.
  await page.route(/^https?:\/\/[^/]+\/(api|files)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
})

test.describe('video player container-duration mismatch', () => {
  test('plays to the last real frame instead of stopping short on phantom frames', async ({
    page,
  }) => {
    const vp = new VideoPlayerPage(page)
    await vp.gotoVariant('container-longer')
    await vp.muteNativeVideo()

    // Drive the real player to its natural end.
    await vp.seekToFrame(NEAR_END_FRAME)
    await vp.clickPlayToggle()
    await vp.waitForEnded()

    await expect.poll(() => vp.isPaused(), { timeout: 5_000 }).toBe(true)

    // Let the end-of-playback frame settle (currentTime stops moving).
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

    const totalFrame = await vp.readoutTotalFrame()

    // The displayed total must reflect the real stream (last real frame = 149),
    // not the inflated container-derived count (151). This fails under the bug.
    expect(totalFrame).toBe(REAL_LAST_FRAME)

    // Core user-facing invariant: reaching the natural end lands on the last
    // displayed frame — the playhead is not stranded short of the maximum.
    await expect
      .poll(async () => (await vp.snapshot()).readoutFrame, { timeout: 5_000 })
      .toBe(totalFrame)

    // The seekbar is visually full at the end (within tolerance).
    const snap = await vp.snapshot()
    expect(snap.seekbarFraction).toBeGreaterThan(0.98)
  })
})
