import { expect, test } from '@playwright/test'
import { VideoPlayerPage } from '../pages/video-player.page'

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/(api|files)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
})

test.describe('audio player e2e', () => {
  test('playhead advances immediately without freeze on play', async ({ page }) => {
    const vp = new VideoPlayerPage(page)
    await vp.gotoVariant('audio')
    await vp.muteNativeVideo()

    // Starts paused at frame 0.
    const initial = await vp.snapshot()
    expect(initial.paused).toBe(true)
    expect(initial.readoutFrame).toBe(0)

    // Play via the control
    await vp.clickPlayToggle()
    await expect.poll(() => vp.isPaused(), { timeout: 5_000 }).toBe(false)

    // Wait for 300ms. If the playhead froze (which happened under the bug where
    // it waited 1000ms for rVFC grace period), readoutFrame would still be 0.
    // With the fix, the playhead should advance immediately.
    await page.waitForTimeout(300)
    const afterPlay = await vp.snapshot()

    expect(afterPlay.readoutFrame).toBeGreaterThan(0)
    expect(afterPlay.currentTime).toBeGreaterThan(0)
  })
})
