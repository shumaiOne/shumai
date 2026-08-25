import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

test('owner views a file and it appears in recents', async ({ file }) => {
  const { page, projectId, fileName, fileId } = file

  // Open the file details page to record view
  await page.goto(`/projects/${projectId}/files/${fileId}`)
  await expect(page.getByText(fileName).first()).toBeVisible()

  // Navigate to Recents page via sidebar or direct URL
  await page.goto(`/projects/${projectId}`)
  await page.getByText('Recents').first().click()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/recents`))

  // The viewed file should be visible in recents
  await expect(fileCard(page, fileName)).toBeVisible()
})
