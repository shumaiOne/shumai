import { expect, test } from '@playwright/test'
import { VideoPlayerPage } from '../pages/video-player.page'
import { REAL_LAST_FRAME, SAMPLE_TOTAL_FRAMES } from '../harness/fixture'

/**
 * Companion to container-duration-mismatch.spec.ts, covering the LARGE-gap
 * ("videoB") case: the audio track is much longer than the video track (here a
 * 150-frame / 5.0s video with a 6.5s audio tail — a 1.5s tail, far above the
 * ~100ms playback stall threshold).
 *
 * Because the tail is long enough for the RAF fallback to activate and drive the
 * playhead through the audio-only region, the timeline is (correctly) derived
 * from the container duration: round(6.5 * 30) = 195 frames, readout max 194.
 * Playing to the natural end must advance the playhead all the way to that
 * container-based maximum, and the readout must show "194 / 194".
 *
 * This behaviour is expected to hold BOTH before and after the frame-count fix
 * (the fix only changes the small-gap case), so this spec passes on the current
 * code and guards against regressing the large-gap case.
 */

// Land a couple frames before the VIDEO track ends, so playback streams through
// the video tail and then the long audio-only tail to the natural end.
const NEAR_VIDEO_END_FRAME = SAMPLE_TOTAL_FRAMES - 3

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/(api|files)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
})

test.describe('video player long audio tail (large gap)', () => {
  test('playhead traverses the audio tail to the container-based maximum', async ({ page }) => {
    const vp = new VideoPlayerPage(page)
    await vp.gotoVariant('long-audio')
    await vp.muteNativeVideo()

    // The displayed total reflects the container (audio-extended) duration, not
    // the shorter video track: it is well beyond the last real video frame.
    const totalFrame = await vp.readoutTotalFrame()
    expect(totalFrame).toBeGreaterThan(REAL_LAST_FRAME)

    // Drive the player from just before the video track ends, out through the
    // audio-only tail, to the natural end of the media.
    await vp.seekToFrame(NEAR_VIDEO_END_FRAME)
    await vp.clickPlayToggle()
    await vp.waitForEnded()

    await expect.poll(() => vp.isPaused(), { timeout: 5_000 }).toBe(true)

    // Let the end-of-playback frame settle.
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

    // The playhead advanced past the last real video frame into the audio tail...
    const snap = await vp.snapshot()
    expect(snap.readoutFrame).toBeGreaterThan(REAL_LAST_FRAME)

    // ...and reached the container-based maximum at the natural end.
    await expect
      .poll(async () => (await vp.snapshot()).readoutFrame, { timeout: 5_000 })
      .toBe(totalFrame)

    // The seekbar is visually full at the end.
    const finalSnap = await vp.snapshot()
    expect(finalSnap.seekbarFraction).toBeGreaterThan(0.98)
  })
})
