import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

test('owner creates a share link from a file context menu and lands on the share page', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileName, fileId } = file

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileName)).toBeVisible()

  // Create a share link for the file through the context menu
  await fileCard(page, fileName).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Create Share Link' }).click()

  // The toast offers a "View" action that navigates to the share page
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Share link created' })
  await expect(toast).toBeVisible()
  await toast.getByRole('button', { name: 'View' }).click()

  await expect(page).toHaveURL(/\/projects\/[^/]+\/shares\/[^/]+/)

  // The shared file is listed in the share contents
  await expect(fileCard(page, fileName)).toBeVisible()

  // DB: the share exists and the file is symlinked under the share root
  const share = await prisma.shareLink.findFirst({ where: { projectId } })
  expect(share).not.toBeNull()

  const symlink = await prisma.asset.findFirst({
    where: { parentId: share?.rootFolderId, targetId: fileId },
  })
  expect(symlink).not.toBeNull()
  expect(symlink?.type).toBe('symlink')
})
