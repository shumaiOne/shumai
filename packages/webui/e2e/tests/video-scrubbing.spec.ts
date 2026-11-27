import { expect, test } from '@playwright/test'
import { VideoPlayerPage } from '../pages/video-player.page'
import { LONG_AUDIO_COMPUTED_TOTAL_FRAMES } from '../harness/fixture'

test('scrubs the preview while playing and seeks the main video once on release', async ({
  page,
}) => {
  const player = new VideoPlayerPage(page)
  await player.gotoVariant('long-audio')
  await player.muteNativeVideo()
  await player.clickPlayToggle()
  await expect.poll(() => player.isPaused()).toBe(false)

  await player.video.evaluate((video: HTMLVideoElement) => {
    video.dataset.seekCount = '0'
    video.addEventListener('seeking', () => {
      video.dataset.seekCount = String(Number(video.dataset.seekCount) + 1)
    })
  })
  const track = await player.seekbar.boundingBox()
  expect(track).not.toBeNull()
  if (!track) throw new Error('Seekbar is not visible')
  const moveToFrame = (frame: number) =>
    page.mouse.move(
      track.x + (track.width * frame) / LONG_AUDIO_COMPUTED_TOTAL_FRAMES,
      track.y + track.height / 2,
    )
  const preview = page.getByTestId('scrub-preview')
  const tooltip = player.seekbar.locator('video').last()

  await moveToFrame(20)
  await expect(tooltip).toBeVisible()
  await page.mouse.down()
  await moveToFrame(70)
  await expect.poll(() => player.isPaused()).toBe(true)
  const pausedTime = await player.currentTime()
  await expect(preview).toBeVisible()
  await expect(tooltip).toBeHidden()
  await moveToFrame(105)
  await expect(player.timeReadout).toHaveText('105 / 194 fr')
  await expect
    .poll(() => preview.evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeCloseTo(3.5, 1)
  expect(await player.currentTime()).toBeCloseTo(pausedTime, 3)
  await expect(player.video).toHaveAttribute('data-seek-count', '0')

  await page.mouse.up()
  await expect(preview).toBeHidden()
  await expect(player.video).toHaveAttribute('data-seek-count', '1')
  await expect.poll(() => player.isPaused()).toBe(false)
  expect(await player.currentTime()).toBeGreaterThanOrEqual(3.5)
})

test('seeks on release and stays paused when the preview is missing', async ({ page }) => {
  const player = new VideoPlayerPage(page)
  await player.goto()
  const track = await player.seekbar.boundingBox()
  if (!track) throw new Error('Seekbar is not visible')
  const y = track.y + track.height / 2

  await page.mouse.move(track.x + track.width * 0.2, y)
  await page.mouse.down()
  await page.mouse.move(track.x + track.width * 0.6, y)
  await expect(player.timeReadout).toHaveText('90 / 149 fr')
  expect(await player.currentTime()).toBeLessThan(0.1)
  await page.mouse.up()

  await expect.poll(() => player.currentTime()).toBeCloseTo(3.017, 2)
  await expect(player.timeReadout).toHaveText('90 / 149 fr')
  expect(await player.isPaused()).toBe(true)
})
