import { expect, test } from '@playwright/test'
import { TOTAL_FRAMES, VideoPlayerPage } from '../pages/video-player.page'

/**
 * Pure UI integration test for restarting a finished video.
 *
 * When a clip plays to its end, `togglePlay` treats an ended player the same as
 * a paused one: `if (player.paused() || player.ended()) player.play()`. Calling
 * play() on an ended media element restarts it from the beginning. This spec
 * drives the *real* player to its end (by seeking near the tail, then playing
 * out the last few frames) and asserts that the two user-facing restart
 * triggers — the play/pause control and a click on the video area — both resume
 * playback from the start.
 *
 * To keep the test fast and deterministic we seek close to the end rather than
 * streaming the whole fixture; the restart behaviour under test is independent
 * of how the player reached the `ended` state.
 */

// Land a few frames from the end so playing out the tail (and firing `ended`)
// takes a fraction of a second instead of the full clip duration.
const NEAR_END_FRAME = TOTAL_FRAMES - 3

test.beforeEach(async ({ page }) => {
  // Mock every backend call so this stays a pure frontend test (mirrors
  // play-pause.spec.ts). Patterns are anchored to the origin root so they only
  // match real backend requests, not Vite-served source modules.
  await page.route(/^https?:\/\/[^/]+\/(api|files)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
})

/** Drive the player to its natural end and assert it is stopped at the tail. */
async function playToEnd(vp: VideoPlayerPage): Promise<void> {
  await vp.seekToFrame(NEAR_END_FRAME)
  await vp.clickPlayToggle()
  await vp.waitForEnded()

  await expect.poll(() => vp.isPaused(), { timeout: 5_000 }).toBe(true)
  const ended = await vp.snapshot()
  expect(ended.ended).toBe(true)
  expect(ended.paused).toBe(true)
}

/**
 * After a restart trigger, assert the player leaves the ended state, resumes
 * playing, and the playhead jumps back to the start before advancing again.
 */
async function expectRestartedFromStart(vp: VideoPlayerPage): Promise<void> {
  // Leaves the ended state and resumes playback.
  await expect.poll(async () => (await vp.snapshot()).ended, { timeout: 5_000 }).toBe(false)
  await expect.poll(() => vp.isPaused(), { timeout: 5_000 }).toBe(false)

  // The playhead rewound to the start: it is now well before where the clip
  // ended (comfortably below the near-end frame it was stopped at).
  await expect
    .poll(async () => (await vp.snapshot()).readoutFrame, { timeout: 5_000 })
    .toBeLessThan(NEAR_END_FRAME)

  // ...and playback is genuinely progressing again from near the start.
  const first = await vp.snapshot()
  await expect
    .poll(async () => (await vp.snapshot()).readoutFrame, { timeout: 5_000 })
    .toBeGreaterThan(first.readoutFrame)
}

test.describe('video player restart on end', () => {
  test('restarts playback via the play/pause control after the video ends', async ({ page }) => {
    const vp = new VideoPlayerPage(page)
    await vp.goto()
    await vp.muteNativeVideo()

    await playToEnd(vp)

    // Restart trigger: the play/pause control.
    await vp.clickPlayToggle()
    await expectRestartedFromStart(vp)
  })

  test('restarts playback by clicking the video area after the video ends', async ({ page }) => {
    const vp = new VideoPlayerPage(page)
    await vp.goto()
    await vp.muteNativeVideo()

    await playToEnd(vp)

    // Restart trigger: clicking the video surface.
    await vp.clickVideoArea()
    await expectRestartedFromStart(vp)
  })
})
