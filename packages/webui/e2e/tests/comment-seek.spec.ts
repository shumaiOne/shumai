import { expect, test } from '@playwright/test'
import { CommentSeekPage, TOTAL_FRAMES } from '../pages/comment-seek.page'

/**
 * Frame-accurate comment seek roundtrip.
 *
 * Simulates two users against the *real* comment↔player wiring:
 *   1. User A scrubs to a frame, pauses, and creates a comment. The app stores
 *      the comment's timestamp as `second = currentFrame / fps` (a float in
 *      seconds — never a frame integer), captured via the player's real
 *      `onTimeUpdate` prop.
 *   2. User B opens the page fresh (the player remounts at frame 0) and clicks
 *      the comment, which runs the app's real seek `player.currentTime(second)`.
 *      useFramePlayer then recomputes the frame from the media clock as
 *      `floor(second * fps + 0.45)`.
 *
 * The invariant under test is that this seconds-based roundtrip is loss-free:
 *   frameA -> second = frameA/fps -> (stored) -> seek(second)
 *          -> floor(second*fps + 0.45) == frameA
 *
 * We exercise it on 5 distinct frames chosen randomly on every run, so any
 * off-by-one in the conversion surfaces across runs and is caught deterministically
 * for the sampled frames within a run.
 */

const COMMENT_COUNT = 5

/**
 * Pick `count` distinct random frame indices in a safe range. We avoid frame 0
 * (the player's post-reload starting state, so "seeked back" is a real change)
 * and the final frame (to dodge the native `ended` edge case).
 */
function pickRandomFrames(count: number): number[] {
  const min = 1
  const max = TOTAL_FRAMES - 2
  const chosen = new Set<number>()
  while (chosen.size < count) {
    chosen.add(min + Math.floor(Math.random() * (max - min + 1)))
  }
  return [...chosen].sort((a, b) => a - b)
}

test.beforeEach(async ({ page }) => {
  // Mock every backend call so this stays a pure frontend test. The harness never
  // hits the API, but this guarantees isolation regardless. Patterns are anchored
  // to the origin root so they don't match Vite-served source modules.
  await page.route(/^https?:\/\/[^/]+\/(api|files)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
})

test.describe('video player comment seek roundtrip', () => {
  test('user A comments on 5 random frames, user B seeks back to each', async ({
    page,
  }, testInfo) => {
    const frames = pickRandomFrames(COMMENT_COUNT)
    // Record the sampled frames so a failing run is reproducible.
    testInfo.annotations.push({ type: 'random-frames', description: frames.join(', ') })

    const cs = new CommentSeekPage(page)
    await cs.goto()
    await cs.muteNativeVideo()

    // Starts paused at frame 0.
    const initial = await cs.snapshot()
    expect(initial.paused).toBe(true)
    expect(initial.readoutFrame).toBe(0)

    // -- Phase A: user A authors a comment on each random frame. --
    for (const frame of frames) {
      await cs.seekToFrame(frame)

      // The frame user A is actually looking at (readout and native clock agree).
      const authored = await cs.snapshot()
      expect(authored.paused).toBe(true)
      expect(authored.readoutFrame).toBe(frame)
      expect(authored.nativeFrame).toBe(frame)

      await cs.clickCreateComment()

      // Goal 1: the comment is stored at exactly the frame user A saw.
      const commentFrames = await cs.commentFrames()
      expect(commentFrames[commentFrames.length - 1]).toBe(frame)
    }

    // All five comments exist and correspond, in order, to the authored frames.
    expect(await cs.commentCount()).toBe(COMMENT_COUNT)
    expect(await cs.commentFrames()).toEqual(frames)

    // -- Phase B: a second user opens the page fresh (player remounts at 0). --
    await cs.reloadAsUserB()
    await cs.muteNativeVideo()
    const afterReload = await cs.snapshot()
    expect(afterReload.readoutFrame).toBe(0)

    // Clicking each comment lands the player back on exactly user A's frame.
    const commentFrames = await cs.commentFrames()
    for (let index = 0; index < commentFrames.length; index++) {
      const frame = commentFrames[index]
      await cs.clickCommentByIndex(index)
      await cs.waitUntilSettledOn(frame)

      // Goal 2: user B sees exactly the frame user A commented on.
      const seen = await cs.snapshot()
      expect(seen.paused).toBe(true)
      expect(seen.readoutFrame).toBe(frame)
      expect(seen.nativeFrame).toBe(frame)
    }
  })
})
