import { expect, test } from '../../fixtures'

test('create a comment on a binary file', async ({ file, prisma }) => {
  const { page, projectId, fileId } = file
  const commentText = `Binary comment ${Date.now()}`

  await page.goto(`/projects/${projectId}/files/${fileId}`)

  // Wait for file page & comments sidebar to load
  const input = page.locator('[contenteditable="true"]').first()
  await expect(input).toBeVisible()

  // Type comment text and send
  await input.fill(commentText)
  const sendBtn = page.locator('button:has(svg.lucide-arrow-up)').last()
  await sendBtn.click()

  // Verify comment card appears in sidebar
  await expect(page.getByText(commentText)).toBeVisible()

  // Refresh page and click the comment
  await page.reload()
  const commentCard = page.getByText(commentText).first()
  await expect(commentCard).toBeVisible()
  await commentCard.click()

  // DB verification
  const commentInDb = await prisma.assetComment.findFirst({
    where: { assetId: fileId, message: commentText },
  })
  expect(commentInDb).not.toBeNull()
})
