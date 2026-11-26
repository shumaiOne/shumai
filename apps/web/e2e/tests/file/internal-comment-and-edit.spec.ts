import { expect, test } from '../../fixtures'
import { apiAddAssetsToShare, apiCreateShare, fileCard } from '../../helpers/files'

test('internal comments show lock icon in workspace and are hidden on public share pages', async ({
  browser,
  file,
  prisma,
}) => {
  const { context, page, projectId, fileId, fileName } = file
  const publicText = `Public note ${Date.now()}`
  const internalText = `Internal secret ${Date.now()}`

  await page.goto(`/projects/${projectId}/files/${fileId}`)

  const editor = page.locator('[contenteditable="true"]').first()
  const sendBtn = page.locator('button:has(svg.lucide-arrow-up)').last()
  const visibilityTrigger = page.getByTestId('comment-visibility-trigger')

  // Default visibility is Public
  await expect(visibilityTrigger).toBeVisible()
  await expect(visibilityTrigger).toContainText('Public')

  // Post a public comment
  await editor.fill(publicText)
  await sendBtn.click()
  await expect(page.getByText(publicText)).toBeVisible()

  // Switch to Internal and post an internal comment
  await visibilityTrigger.click()
  await page.getByTestId('comment-visibility-internal').click()
  await expect(visibilityTrigger).toContainText('Internal')

  await editor.fill(internalText)
  await sendBtn.click()
  await expect(page.getByText(internalText)).toBeVisible()

  // Visibility pill resets to Public after sending
  await expect(visibilityTrigger).toContainText('Public')

  // Internal comment shows lock icon, public comment does not
  await expect(page.getByTestId('internal-comment-icon')).toHaveCount(1)

  // Verify DB persisted isInternal flags
  await expect
    .poll(async () => {
      const comments = await prisma.assetComment.findMany({
        where: { assetId: fileId },
        orderBy: { id: 'asc' },
      })
      return comments.map((c) => ({ message: c.message, isInternal: c.isInternal }))
    })
    .toEqual([
      { message: publicText, isInternal: false },
      { message: internalText, isInternal: true },
    ])

  // Create a public share link for this file
  const share = await apiCreateShare(context.request, projectId, 'External Review Share')
  await apiAddAssetsToShare(context.request, share.id, [fileId])

  // Open public share page as an unauthenticated guest
  const guestContext = await browser.newContext()
  try {
    const guestPage = await guestContext.newPage()
    await guestPage.goto(`/share/${share.id}`)

    // File card comment badge should only count the 1 public comment
    const card = fileCard(guestPage, fileName)
    await expect(card).toBeVisible()
    await expect(card).toContainText('1')

    // Open the shared file
    await card.dblclick()
    await expect(guestPage.getByText(publicText)).toBeVisible()
    await expect(guestPage.getByText(internalText)).toHaveCount(0)
    await expect(guestPage.getByTestId('comment-visibility-trigger')).toHaveCount(0)
  } finally {
    await guestContext.close()
  }
})

test.describe('author edits comment with timestamp and attachments', () => {
  test.use({ fileOptions: { mediaType: 'audio' } })

  test('author edits comment text, switches to internal, removes timestamp, and updates attachments', async ({
    file,
    prisma,
  }) => {
    const { page, projectId, fileId } = file
    const originalText = `Initial audio note ${Date.now()}`
    const editedText = `Edited private note ${Date.now()}`

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

    const mediaEl = page.locator('audio, video').first()
    await expect(mediaEl).toBeVisible({ timeout: 30_000 })

    // Seek to non-zero timestamp
    await page.evaluate(() => {
      const el = document.querySelector('audio, video') as HTMLMediaElement | null
      if (el) el.currentTime = 1
    })
    await page.waitForTimeout(500)

    // Attach initial file in composer
    const composerFileInput = page.locator('input[type="file"]').last()
    await composerFileInput.setInputFiles({
      name: 'old-attachment.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('old attachment content'),
    })
    await expect(page.getByText('old-attachment.txt')).toBeVisible()

    // Submit public comment with timestamp and attachment
    const editor = page.locator('[contenteditable="true"]').first()
    await editor.fill(originalText)
    const sendBtn = page.locator('button:has(svg.lucide-arrow-up)').last()
    await expect(sendBtn).toBeEnabled()
    await sendBtn.click()

    await expect(page.getByText(originalText)).toBeVisible()
    await expect(page.getByText('old-attachment.txt')).toBeVisible()

    // Wait for DB persistence
    await expect
      .poll(async () => {
        return prisma.assetComment.findFirst({
          where: { assetId: fileId, message: originalText },
        })
      })
      .not.toBeNull()

    // Open three-dot menu on comment card and click Edit
    const moreBtn = page.getByRole('button', { name: 'More options' }).last()
    await moreBtn.click({ force: true })
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    const editForm = page.getByTestId('comment-edit-form')
    await expect(editForm).toBeVisible()

    // Remove timestamp
    await expect(editForm.getByTestId('edit-comment-timestamp')).toBeVisible()
    await editForm.getByTestId('edit-comment-remove-timestamp').click()
    await expect(editForm.getByTestId('edit-comment-timestamp')).toHaveCount(0)

    // Remove existing attachment
    await editForm.getByTestId('edit-existing-attachment').locator('button').click()
    await expect(editForm.getByTestId('edit-existing-attachment')).toHaveCount(0)

    // Add a new attachment
    await editForm.getByTestId('edit-comment-file-input').setInputFiles({
      name: 'new-attachment.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('new attachment content'),
    })
    await expect(editForm.getByText('new-attachment.txt')).toBeVisible()

    // Switch Public -> Internal
    await editForm.getByTestId('comment-visibility-trigger').click()
    await page.getByTestId('comment-visibility-internal').click()
    await expect(editForm.getByTestId('comment-visibility-trigger')).toContainText('Internal')

    // Change comment text
    const editInput = editForm.getByTestId('edit-comment-input')
    await editInput.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type(editedText)

    // Save
    const saveBtn = editForm.getByTestId('edit-comment-save')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    await expect(editForm).toHaveCount(0)
    await expect(page.getByText(editedText)).toBeVisible()
    await expect(page.getByText('new-attachment.txt')).toBeVisible()
    await expect(page.getByText('old-attachment.txt')).toHaveCount(0)
    await expect(page.getByTestId('internal-comment-icon')).toHaveCount(1)

    // Reload and verify persistence in UI and DB
    await page.reload()
    await expect(page.getByText(editedText)).toBeVisible()
    await expect(page.getByText('new-attachment.txt')).toBeVisible()
    await expect(page.getByTestId('internal-comment-icon')).toHaveCount(1)

    const updated = await prisma.assetComment.findFirst({
      where: { assetId: fileId, message: editedText },
      include: { attachments: { include: { asset: true } } },
    })
    expect(updated).not.toBeNull()
    expect(updated?.isInternal).toBe(true)
    expect(updated?.second).toBeNull()
    expect(updated?.attachments.map((a) => a.asset.name)).toEqual(['new-attachment.txt'])
  })
})
