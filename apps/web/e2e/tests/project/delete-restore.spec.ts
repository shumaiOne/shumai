import { expect, test } from '../../fixtures'
import { seedFile, seedFolder } from '../../helpers/assets'
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

test('owner deletes a folder and still sees its contents preview and countdown in recently deleted', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project
  const folderName = `e2e-deleted-folder-${Date.now()}`

  const folder = await seedFolder(prisma, projectId, rootFolderId, folderName)
  await seedFile(prisma, projectId, folder.id, 'inside-1.png')
  await seedFile(prisma, projectId, folder.id, 'inside-2.png')

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, folderName)).toBeVisible()

  // Delete the folder through the context menu + confirmation dialog
  await fileCard(page, folderName).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()

  const deleteDialog = page.getByRole('alertdialog')
  await expect(deleteDialog.getByText('Delete Asset?')).toBeVisible()
  await deleteDialog.getByRole('button', { name: 'Delete' }).click()
  await expect(fileCard(page, folderName)).not.toBeVisible()

  // Navigate to the Recently Deleted view
  await page.getByText('Recently Deleted').click()
  await expect(page).toHaveURL(/\/recently-deleted/)

  const deletedFolderCard = fileCard(page, folderName)
  await expect(deletedFolderCard).toBeVisible()
  // The folder still shows previews of the files that were deleted with it
  await expect(deletedFolderCard.getByTestId('folder-preview-grid')).toBeVisible()
  // And each item shows how many days are left before permanent deletion
  await expect(deletedFolderCard.getByTestId('folder-card-days-left')).toHaveText(/30\s*(d|天)/)
})

test('owner deletes a version stack and restores it from recently deleted', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project
  const latestVersionName = `e2e-stack-latest-${Date.now()}.png`
  const olderVersionName = `e2e-stack-older-${Date.now()}.png`

  const stack = await prisma.asset.create({
    data: {
      name: `e2e-stack-${Date.now()}`,
      type: 'version_stack',
      status: 'processed',
      projectId,
      parentId: rootFolderId,
      fileCount: 2,
      sizeByte: 20,
    },
  })
  await prisma.asset.create({
    data: {
      name: latestVersionName,
      type: 'file',
      status: 'processed',
      sizeByte: 10,
      sortIndex: 'a0',
      projectId,
      parentId: stack.id,
    },
  })
  await prisma.asset.create({
    data: {
      name: olderVersionName,
      type: 'file',
      status: 'processed',
      sizeByte: 10,
      sortIndex: 'a1',
      projectId,
      parentId: stack.id,
    },
  })

  // The stack card is labelled with its latest version's name
  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, latestVersionName)).toBeVisible()

  await fileCard(page, latestVersionName).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()

  const deleteDialog = page.getByRole('alertdialog')
  await expect(deleteDialog.getByText('Delete Asset?')).toBeVisible()
  await deleteDialog.getByRole('button', { name: 'Delete' }).click()
  await expect(fileCard(page, latestVersionName)).not.toBeVisible()

  // The whole stack is soft-deleted, including its versions
  await expect
    .poll(async () => {
      const row = await prisma.asset.findUnique({ where: { id: stack.id } })
      return row?.isDeleted
    })
    .toBe(true)

  // Restore it from the Recently Deleted view
  await page.getByText('Recently Deleted').click()
  await expect(page).toHaveURL(/\/recently-deleted/)
  await expect(fileCard(page, latestVersionName)).toBeVisible()

  await fileCard(page, latestVersionName).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Restore' }).click()
  await expect(fileCard(page, latestVersionName)).not.toBeVisible()

  await expect
    .poll(async () => {
      const row = await prisma.asset.findUnique({ where: { id: stack.id } })
      return row?.isDeleted
    })
    .toBe(false)

  // Back at the project root the stack is visible again
  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, latestVersionName)).toBeVisible()
})
