import { expect, test } from '../../fixtures'
import { apiCreateShare, fileCard } from '../../helpers/files'

test('owner creates a share link from a file context menu, edits it in the quick dialog, and opens advanced settings', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileName, fileId } = file

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileName)).toBeVisible()

  // Create a share link for the file through the context menu
  await fileCard(page, fileName).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Create Share Link' }).click()

  // Quick share dialog opens with share name, URL, security controls, and footer actions
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(fileName)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Copy Link' }).last()).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Done' })).toBeVisible()

  // Rename share link inline via the pen icon
  await dialog.getByRole('button', { name: 'Rename Share Link' }).click()
  const nameInput = dialog.getByRole('textbox', { name: 'Rename Share Link' })
  await expect(nameInput).toBeVisible()
  await nameInput.fill('Client Review Cut')
  await nameInput.press('Enter')
  await expect(dialog.getByText('Client Review Cut')).toBeVisible()

  // Toggle Allow download off in quick security settings
  const allowDownloadRow = dialog.getByText('Allow download').locator('..')
  await allowDownloadRow.getByRole('switch').click()
  await expect(page.getByText('Settings updated')).toBeVisible()

  // Navigate to full settings via Advanced settings
  await dialog.getByRole('button', { name: 'Advanced settings' }).click()
  await expect(page).toHaveURL(/\/projects\/[^/]+\/shares\/[^/]+/)

  // The shared file is listed in the share contents
  await expect(fileCard(page, fileName)).toBeVisible()

  // DB: the share exists with updated settings and the file is symlinked under the share root
  const share = await prisma.shareLink.findFirst({ where: { projectId } })
  expect(share).not.toBeNull()
  expect(share?.name).toBe('Client Review Cut')
  expect(share?.allowDownload).toBe(false)

  const symlink = await prisma.asset.findFirst({
    where: { parentId: share?.rootFolderId, targetId: fileId },
  })
  expect(symlink).not.toBeNull()
  expect(symlink?.type).toBe('symlink')
})

test('owner creates a share link and adds to an existing share link from media view', async ({
  file,
  prisma,
}) => {
  const { context, page, projectId, fileName, fileId } = file

  // Seed an existing share link so "Add to Share Links" submenu is available
  const existingShare = await apiCreateShare(context.request, projectId, 'Existing Client Share')

  await page.goto(`/projects/${projectId}/files/${fileId}`)
  const headerTrigger = page.getByRole('button', { name: fileName })
  await expect(headerTrigger).toBeVisible()

  // Open the media view header arrow dropdown and create a new share link
  await headerTrigger.click()
  await page.getByRole('menuitem', { name: 'Create Share Link' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(fileName)).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/files/${fileId}$`))

  // Close the dialog with Done and stay on the media view
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/files/${fileId}$`))

  // DB: new share link created with symlink to the file
  const createdShare = await prisma.shareLink.findFirst({
    where: { projectId, id: { not: existingShare.id } },
  })
  expect(createdShare).not.toBeNull()
  expect(createdShare?.name).toBe(fileName)

  const createdSymlink = await prisma.asset.findFirst({
    where: { parentId: createdShare?.rootFolderId, targetId: fileId },
  })
  expect(createdSymlink).not.toBeNull()
  expect(createdSymlink?.type).toBe('symlink')

  // Open the header dropdown again and add the file to the existing share link
  await headerTrigger.click()
  await page.getByRole('menuitem', { name: 'Add to Share Links' }).hover()
  await page.getByRole('menuitem', { name: 'Existing Client Share' }).click()

  const addedToast = page.locator('[data-sonner-toast]').filter({ hasText: 'Added to share link' })
  await expect(addedToast).toBeVisible()

  const addedSymlink = await prisma.asset.findFirst({
    where: { parentId: existingShare.rootFolderId, targetId: fileId },
  })
  expect(addedSymlink).not.toBeNull()
  expect(addedSymlink?.type).toBe('symlink')
})
