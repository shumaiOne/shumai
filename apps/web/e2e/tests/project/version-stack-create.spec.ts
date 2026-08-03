import { expect, test } from '../../fixtures'
import { seedFile } from '../../helpers/assets'
import { dragCard } from '../../helpers/dnd'
import { fileCard } from '../../helpers/files'

test('owner moves a file onto another file to create a version stack', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project

  const fileA = await seedFile(prisma, projectId, rootFolderId, `e2e-stack-a-${Date.now()}`)
  const fileB = await seedFile(prisma, projectId, rootFolderId, `e2e-stack-b-${Date.now()}`)

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileA.name)).toBeVisible()
  await expect(fileCard(page, fileB.name)).toBeVisible()

  // Drag file B onto file A -> a version stack is created with both files
  await dragCard(page, fileCard(page, fileB.name), fileCard(page, fileA.name))

  // The stack card shows the latest version's name (the dragged file) and a v2 badge;
  // the original two file cards are gone from the folder
  await expect(fileCard(page, fileB.name)).toBeVisible()
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
  await expect(fileCard(page, fileA.name)).not.toBeVisible()

  // DB: exactly one version stack in the project root with both files as versions
  await expect
    .poll(async () => {
      return prisma.asset.count({
        where: { projectId, parentId: rootFolderId, type: 'version_stack' },
      })
    })
    .toBe(1)

  const stack = await prisma.asset.findFirstOrThrow({
    where: { projectId, parentId: rootFolderId, type: 'version_stack' },
  })
  expect(stack.fileCount).toBe(2)

  const versions = await prisma.asset.findMany({
    where: { parentId: stack.id, type: 'file' },
    orderBy: { sortIndex: 'asc' },
  })
  expect(versions).toHaveLength(2)
  expect(new Set(versions.map((v) => v.id))).toEqual(new Set([fileA.id, fileB.id]))
})
