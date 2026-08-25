import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

test('owner views a file and it appears in recents', async ({ file }) => {
  const { page, projectId, fileName, fileId } = file

  // Open the file details page to record view
  await page.goto(`/projects/${projectId}/files/${fileId}`)
  await expect(page.getByText(fileName).first()).toBeVisible()

  // Navigate to Recents page via sidebar or direct URL
  await page.goto(`/projects/${projectId}`)
  await page.getByText('Recently Viewed').first().click()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/recents`))

  // The viewed file should be visible in recents
  const card = fileCard(page, fileName)
  await expect(card).toBeVisible()

  // Toolbar should show hint text instead of action buttons
  await expect(
    page.getByText('This page displays the 100 most recent files you viewed in this project.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Field' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Search' })).not.toBeVisible()
  await expect(page.getByText('AGENTS.md')).not.toBeVisible()

  // Right-clicking the file should NOT show the context menu
  await card.click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Delete' })).not.toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Download' })).not.toBeVisible()
})
