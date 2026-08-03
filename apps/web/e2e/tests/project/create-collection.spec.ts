import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

test('owner creates a collection from the sidebar and the collection shows project files', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileName } = file

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileName)).toBeVisible()

  // Create a collection via the sidebar "+" button
  await page.getByTestId('create-collection').click()

  await expect(page).toHaveURL(/\/collections\/[^/]+/)
  await expect(page.getByText('Collection created')).toBeVisible()

  // The collection page is a recursive files-only view of the project
  await expect(fileCard(page, fileName)).toBeVisible()

  const collection = await prisma.collection.findFirst({ where: { projectId } })
  expect(collection).not.toBeNull()
  expect(collection?.name).toBe('Untitled Collection')

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  expect(collection?.filter).toMatchObject({
    sourceFolderId: project?.rootFolderId,
    searchFilter: { conditions: [], recursively: true },
  })
})
