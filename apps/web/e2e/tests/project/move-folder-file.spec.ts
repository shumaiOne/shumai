import { expect, test } from '../../fixtures'
import { seedFile, seedFolder } from '../../helpers/assets'
import { dragCard } from '../../helpers/dnd'
import { fileCard } from '../../helpers/files'

test('owner moves a file into a folder and a folder into another folder', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project

  const folderA = await seedFolder(prisma, projectId, rootFolderId, `e2e-folder-a-${Date.now()}`)
  const folderB = await seedFolder(prisma, projectId, rootFolderId, `e2e-folder-b-${Date.now()}`)
  const file1 = await seedFile(prisma, projectId, rootFolderId, `e2e-move-file-${Date.now()}`)

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, file1.name)).toBeVisible()
  await expect(fileCard(page, folderA.name)).toBeVisible()
  await expect(fileCard(page, folderB.name)).toBeVisible()

  // 1. Drag the file onto folder A -> the file moves into folder A
  await dragCard(page, fileCard(page, file1.name), fileCard(page, folderA.name))

  await expect
    .poll(async () => {
      const asset = await prisma.asset.findUnique({ where: { id: file1.id } })
      return asset?.parentId
    })
    .toBe(folderA.id)

  // The file is no longer in the project root
  await expect(fileCard(page, file1.name)).not.toBeVisible()

  // Opening folder A shows the moved file
  await fileCard(page, folderA.name).dblclick()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/folders/${folderA.id}`))
  await expect(fileCard(page, file1.name)).toBeVisible()

  // 2. Back at the root, drag folder A onto folder B -> folder A moves into folder B
  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, folderA.name)).toBeVisible()
  await expect(fileCard(page, folderB.name)).toBeVisible()

  await dragCard(page, fileCard(page, folderA.name), fileCard(page, folderB.name))

  await expect
    .poll(async () => {
      const asset = await prisma.asset.findUnique({ where: { id: folderA.id } })
      return asset?.parentId
    })
    .toBe(folderB.id)

  // Folder A is no longer in the project root
  await expect(fileCard(page, folderA.name)).not.toBeVisible()

  // Opening folder B shows folder A inside it
  await fileCard(page, folderB.name).dblclick()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/folders/${folderB.id}`))
  await expect(fileCard(page, folderA.name)).toBeVisible()

  // 3. DB: folder/file counters are kept in sync on the moved folders
  const movedFolderA = await prisma.asset.findUnique({ where: { id: folderA.id } })
  expect(movedFolderA?.fileCount).toBe(1) // file1 moved in
  const movedFolderB = await prisma.asset.findUnique({ where: { id: folderB.id } })
  expect(movedFolderB?.fileCount).toBe(1) // folderA moved in
})
