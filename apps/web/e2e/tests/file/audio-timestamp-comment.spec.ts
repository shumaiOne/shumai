import { expect, test } from '../../fixtures'

test.use({ fileOptions: { mediaType: 'audio' } })

test('upload an audio file, create a comment at a non-zero timestamp', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileId } = file
  const commentText = `Audio timestamp comment ${Date.now()}`

  // Wait for audio transcode completion
  await expect
    .poll(
      async () => {
        const asset = await prisma.asset.findUnique({ where: { id: fileId } })
        return asset?.status
      },
      { timeout: 30_000 },
    )
    .toBe('processed')

  await page.goto(`/projects/${projectId}/files/${fileId}`)

  // Wait for audio/video media element to be visible
  const mediaEl = page.locator('audio, video').first()
  await expect(mediaEl).toBeVisible({ timeout: 30_000 })

  // Seek media element to non-zero timestamp (e.g. 1 second)
  await page.evaluate(() => {
    const el = document.querySelector('audio, video') as HTMLMediaElement | null
    if (el) el.currentTime = 1
  })
  await page.waitForTimeout(500)

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

  // Verify media element jumped to timestamp
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const el = document.querySelector('audio, video') as HTMLMediaElement | null
        return el ? el.currentTime : 0
      })
    })
    .toBeGreaterThan(0)
})
