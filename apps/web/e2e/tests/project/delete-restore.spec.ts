import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

test('owner deletes a file, finds it in recently deleted, and restores it', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileName, fileId } = file

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileName)).toBeVisible()

  // Delete through the context menu + confirmation dialog
  await fileCard(page, fileName).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()

  const deleteDialog = page.getByRole('alertdialog')
  await expect(deleteDialog.getByText('Delete Asset?')).toBeVisible()
  await deleteDialog.getByRole('button', { name: 'Delete' }).click()

  await expect(fileCard(page, fileName)).not.toBeVisible()

  let asset = await prisma.asset.findUnique({ where: { id: fileId } })
  expect(asset?.isDeleted).toBe(true)
  expect(asset?.deletedAt).not.toBeNull()

  // Navigate to the Recently Deleted view
  await page.getByText('Recently Deleted').click()
  await expect(page).toHaveURL(/\/recently-deleted/)
  await expect(fileCard(page, fileName)).toBeVisible()

  // Restore through the context menu
  await fileCard(page, fileName).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Restore' }).click()

  await expect(fileCard(page, fileName)).not.toBeVisible()

  asset = await prisma.asset.findUnique({ where: { id: fileId } })
  expect(asset?.isDeleted).toBe(false)
  expect(asset?.deletedAt).toBeNull()

  // Back at the project root the file is visible again
  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileName)).toBeVisible()
})
