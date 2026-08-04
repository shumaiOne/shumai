import { expect, test } from '../../fixtures'
import { apiUploadFile, fileCard } from '../../helpers/files'

test('owner saves a search result as a collection', async ({ project, prisma }) => {
  const { page, context, teamId, rootFolderId, projectId } = project

  const matching = 'quarterly-report-2024'
  const other = 'annual-budget-2024'

  for (const name of [matching, other]) {
    await apiUploadFile(
      context.request,
      teamId,
      rootFolderId,
      name,
      'application/octet-stream',
      Buffer.alloc(0),
    )
  }

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, matching)).toBeVisible()
  await expect(fileCard(page, other)).toBeVisible()

  // Run a keyword search
  await page.getByRole('button', { name: 'Search' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByPlaceholder('Search records by name...').fill('report')
  await dialog.getByRole('button', { name: 'Search' }).click()
  await expect(dialog.getByText(matching, { exact: true })).toBeVisible()
  await expect(dialog.getByText(other, { exact: true })).not.toBeVisible()

  // Save the search result as a collection; the dialog closes and navigates
  // to the new collection page
  await dialog.getByRole('button', { name: 'Save as collection' }).click()

  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/collections/[^/]+`))
  await expect(page.getByText('Collection saved')).toBeVisible()

  // The collection page is a files-only view of the saved search
  await expect(fileCard(page, matching)).toBeVisible()
  await expect(fileCard(page, other)).not.toBeVisible()

  // DB: the collection stores the keyword search as its filter
  const collection = await prisma.collection.findFirst({ where: { projectId } })
  expect(collection).not.toBeNull()
  expect(collection?.name).toBe('report')
  expect(collection?.filter).toMatchObject({
    sourceFolderId: rootFolderId,
    searchFilter: {
      conditions: [{ field: 'name', operator: 'contains', value: 'report' }],
      recursively: true,
      query: 'report',
      isSemantic: false,
    },
  })
})
