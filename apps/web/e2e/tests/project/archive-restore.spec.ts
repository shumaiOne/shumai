import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

test('owner archives a file to archive storage and restores it back to main storage', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileName, fileId } = file

  await page.goto(`/projects/${projectId}`)
  const card = fileCard(page, fileName)
  await expect(card).toBeVisible()

  // 1. Archive via context menu + confirmation dialog
  await card.click({ button: 'right' })
  await page.getByTestId('context-menu-archive').click()

  const confirmDialog = page.getByTestId('archive-confirm-dialog')
  await expect(confirmDialog).toBeVisible()
  await page.getByTestId('archive-confirm-submit').click()

  // Wait for the DBOS archive workflow to finish and the card badge to settle to Archived
  await expect(card.getByTestId('file-card-archived-badge')).toBeVisible({ timeout: 15000 })

  const archivedAsset = await prisma.asset.findUniqueOrThrow({
    where: { id: fileId },
    include: { storageKey: true },
  })
  expect(archivedAsset.status).toBe('archived')
  expect(archivedAsset.storageKey?.isArchived).toBe(true)

  // 2. Open detail page and verify Archived header badge + disabled original download button
  await card.dblclick()
  await expect(page.getByTestId('detail-header-archived-badge')).toBeVisible()
  await expect(page.getByTestId('default-viewer-download-button')).toBeDisabled()

  // 3. Return to project file list and restore from archive
  await page.goto(`/projects/${projectId}`)
  await expect(card.getByTestId('file-card-archived-badge')).toBeVisible()

  await card.click({ button: 'right' })
  await page.getByTestId('context-menu-restore-archive').click()

  await expect(confirmDialog).toBeVisible()
  await page.getByTestId('archive-confirm-submit').click()

  // Wait for the DBOS restore workflow to finish and the Archived badge to disappear
  await expect(card.getByTestId('file-card-archived-badge')).not.toBeVisible({ timeout: 15000 })

  await expect
    .poll(
      async () => {
        const restored = await prisma.asset.findUnique({
          where: { id: fileId },
          include: { storageKey: true },
        })
        return {
          status: restored?.status,
          isArchived: restored?.storageKey?.isArchived,
        }
      },
      { timeout: 10000 },
    )
    .toEqual({ status: 'processed', isArchived: false })
})
