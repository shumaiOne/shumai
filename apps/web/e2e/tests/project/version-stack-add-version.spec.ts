import { expect, test } from '../../fixtures'
import { seedFile } from '../../helpers/assets'
import { dragCard } from '../../helpers/dnd'
import { fileCard } from '../../helpers/files'

test('owner moves a file onto a version stack to create a new version', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project

  const fileA = await seedFile(prisma, projectId, rootFolderId, `e2e-ver-a-${Date.now()}`)
  const fileB = await seedFile(prisma, projectId, rootFolderId, `e2e-ver-b-${Date.now()}`)
  const fileC = await seedFile(prisma, projectId, rootFolderId, `e2e-ver-c-${Date.now()}`)

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileA.name)).toBeVisible()
  await expect(fileCard(page, fileB.name)).toBeVisible()
  await expect(fileCard(page, fileC.name)).toBeVisible()

  // 1. First create a version stack by dropping file B onto file A
  await dragCard(page, fileCard(page, fileB.name), fileCard(page, fileA.name))
  await expect(page.getByText('v2', { exact: true })).toBeVisible()

  await expect
    .poll(async () => {
      return prisma.asset.count({
        where: { projectId, parentId: rootFolderId, type: 'version_stack' },
      })
    })
    .toBe(1)
  let stack = await prisma.asset.findFirstOrThrow({
    where: { projectId, parentId: rootFolderId, type: 'version_stack' },
  })
  expect(stack.fileCount).toBe(2)

  // 2. Drop file C onto the stack card -> a new version is added to the stack
  // (the stack card currently displays the latest version's name, file B)
  await dragCard(page, fileCard(page, fileC.name), fileCard(page, fileB.name))

  // The newly added file becomes the latest version: the stack card shows file C
  // with a v3 badge and file B's card disappears from the folder
  await expect(page.getByText('v3', { exact: true })).toBeVisible()
  await expect(fileCard(page, fileC.name)).toBeVisible()
  await expect(fileCard(page, fileB.name)).not.toBeVisible()

  // DB: the stack now has 3 versions, including file C
  await expect
    .poll(async () => {
      const s = await prisma.asset.findFirst({
        where: { projectId, parentId: rootFolderId, type: 'version_stack' },
      })
      return s?.fileCount
    })
    .toBe(3)

  stack = await prisma.asset.findFirstOrThrow({
    where: { projectId, parentId: rootFolderId, type: 'version_stack' },
  })

  const versions = await prisma.asset.findMany({
    where: { parentId: stack.id, type: 'file' },
    orderBy: { sortIndex: 'asc' },
  })
  expect(versions).toHaveLength(3)
  expect(new Set(versions.map((v) => v.id))).toEqual(new Set([fileA.id, fileB.id, fileC.id]))

  const movedFileC = await prisma.asset.findUnique({ where: { id: fileC.id } })
  expect(movedFileC?.parentId).toBe(stack.id)
})
