import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

test('owner uploads a file via the "Upload File" context menu action', async ({
  project,
  prisma,
}) => {
  const { page, projectId } = project
  const fileName = `e2e-upload-${Date.now()}.txt`

  await page.goto(`/projects/${projectId}`)
  await expect(page.getByText('This folder is empty')).toBeVisible()

  // Open the empty-area context menu and trigger the file picker
  await page.getByText('This folder is empty').click({ button: 'right' })
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: 'Upload File' }).click(),
  ])
  await fileChooser.setFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from('hello from shumai e2e'),
  })

  // The file card appears immediately (optimistic) and then gets processed
  await expect(fileCard(page, fileName)).toBeVisible()
  await expect
    .poll(
      async () => {
        const asset = await prisma.asset.findFirst({ where: { name: fileName } })
        return asset?.status
      },
      { timeout: 30_000 },
    )
    .toBe('processed')

  // DB: the file is stored in the project root folder
  const asset = await prisma.asset.findFirst({ where: { name: fileName } })
  expect(asset).not.toBeNull()
  expect(asset!.type).toBe('file')
  expect(asset!.projectId).toBe(projectId)

  const projectRow = await prisma.project.findUnique({ where: { id: projectId } })
  expect(asset!.parentId).toBe(projectRow?.rootFolderId)
})
