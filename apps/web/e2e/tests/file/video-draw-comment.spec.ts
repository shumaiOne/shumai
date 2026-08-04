import { expect, test } from '../../fixtures'

test.use({ fileOptions: { mediaType: 'video' } })

test('upload a video file, create a comment with draw at a non-zero timestamp', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileId } = file
  const commentText = `Video draw comment ${Date.now()}`

  // Wait for video transcode completion
  await expect
    .poll(
      async () => {
        const asset = await prisma.asset.findUnique({ where: { id: fileId } })
        return asset?.status
      },
      { timeout: 60_000 },
    )
    .toBe('processed')

  await page.goto(`/projects/${projectId}/files/${fileId}`)

  // Wait for video element to be visible
  const video = page.locator('video').first()
  await expect(video).toBeVisible({ timeout: 30_000 })

  // Seek video to non-zero timestamp (e.g. 1 second)
  await page.evaluate(() => {
    const v = document.querySelector('video')
    if (v) v.currentTime = 1
  })
  await page.waitForTimeout(500)

  // Toggle drawing mode
  const drawToggleBtn = page.getByTitle('Toggle Annotation')
  await expect(drawToggleBtn).toBeVisible()
  await drawToggleBtn.click()

  // Perform drawing gesture on canvas overlay
  const canvas = page.locator('.konvajs-content canvas').first()
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (box) {
    const startX = box.x + box.width * 0.3
    const startY = box.y + box.height * 0.3
    const endX = box.x + box.width * 0.6
    const endY = box.y + box.height * 0.6
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 5 })
    await page.mouse.up()
  }

  // Type comment text and send
  const input = page.locator('[contenteditable="true"]').first()
  await input.fill(commentText)
  const sendBtn = page.locator('button:has(svg.lucide-arrow-up)').last()
  await sendBtn.click()

  // Verify comment card appears in sidebar
  await expect(page.getByText(commentText)).toBeVisible()

  // Ensure comment is persisted in DB before page reload
  await expect
    .poll(async () => {
      return prisma.assetComment.findFirst({
        where: { assetId: fileId, message: commentText },
      })
    })
    .not.toBeNull()

  // Reload page
  await page.reload()

  // Click the comment in right sidebar
  const commentCard = page.getByText(commentText).first()
  await expect(commentCard).toBeVisible()
  await commentCard.click()

  // Verify video jumped to timestamp and draw annotation is shown on canvas
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const v = document.querySelector('video')
        return v ? v.currentTime : 0
      })
    })
    .toBeGreaterThan(0)

  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible()
})
