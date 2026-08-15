import { expect, test } from '../../fixtures'
import { seedFile } from '../../helpers/assets'
import { dragCard } from '../../helpers/dnd'
import { apiAddAssetsToShare, apiCreateShare, fileCard } from '../../helpers/files'

test('owner manages versions: removes a version from a 3-version stack', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project

  const fileA = await seedFile(prisma, projectId, rootFolderId, `e2e-mng-a-${Date.now()}`)
  const fileB = await seedFile(prisma, projectId, rootFolderId, `e2e-mng-b-${Date.now()}`)
  const fileC = await seedFile(prisma, projectId, rootFolderId, `e2e-mng-c-${Date.now()}`)

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileA.name)).toBeVisible()
  await expect(fileCard(page, fileB.name)).toBeVisible()
  await expect(fileCard(page, fileC.name)).toBeVisible()

  // 1. Create a 3-version stack: B on A -> stack (v2), then C on stack -> stack (v3)
  await dragCard(page, fileCard(page, fileB.name), fileCard(page, fileA.name))
  await expect(page.getByText('v2', { exact: true })).toBeVisible()

  await dragCard(page, fileCard(page, fileC.name), fileCard(page, fileB.name))
  await expect(page.getByText('v3', { exact: true })).toBeVisible()

  const stack = await prisma.asset.findFirstOrThrow({
    where: { projectId, parentId: rootFolderId, type: 'version_stack' },
  })
  expect(stack.fileCount).toBe(3)

  // 2. Navigate to file viewer for the stack
  await page.goto(`/projects/${projectId}/files/${stack.id}`)

  // 3. Open breadcrumb menu and click "Manage versions..."
  // Click on the asset name / badge dropdown trigger
  await page.getByRole('button', { name: new RegExp(fileC.name) }).click()
  // Hover or click on Versions sub-menu trigger
  await page.getByRole('menuitem', { name: 'Versions', exact: true }).hover()
  // Click "Manage versions..."
  await page.getByRole('button', { name: /manage versions$/i }).click()

  // 4. Verify Manage versions dialog is visible with all 3 versions
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Manage versions')).toBeVisible()
  await expect(dialog.getByText(fileA.name)).toBeVisible()
  await expect(dialog.getByText(fileB.name)).toBeVisible()
  await expect(dialog.getByText(fileC.name)).toBeVisible()

  // 5. Remove fileB from stack: hover its row and click Remove from stack
  const rowB = dialog.locator('div.group', { hasText: fileB.name })
  await rowB.hover()
  const moreButton = rowB.getByRole('button', { name: 'More options' })
  await moreButton.click()
  await page.getByRole('menuitem', { name: /remove from stack/i }).click()

  // 6. Verify toast and that fileB is removed from dialog
  await expect(page.getByText(/version removed from stack/i)).toBeVisible()
  await expect(dialog.getByText(fileB.name)).not.toBeVisible()
  await expect(dialog.getByText(fileA.name)).toBeVisible()
  await expect(dialog.getByText(fileC.name)).toBeVisible()

  // DB: stack now has 2 versions (fileA and fileC), and fileB is standalone in root folder
  await expect
    .poll(async () => {
      const s = await prisma.asset.findUnique({ where: { id: stack.id } })
      return s?.fileCount
    })
    .toBe(2)

  const updatedFileB = await prisma.asset.findUnique({ where: { id: fileB.id } })
  expect(updatedFileB?.parentId).toBe(rootFolderId)
})

test('owner removes version from 2-version stack dissolving the stack into standalone files', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project

  const fileA = await seedFile(prisma, projectId, rootFolderId, `e2e-dis-a-${Date.now()}`)
  const fileB = await seedFile(prisma, projectId, rootFolderId, `e2e-dis-b-${Date.now()}`)

  await page.goto(`/projects/${projectId}`)
  await dragCard(page, fileCard(page, fileB.name), fileCard(page, fileA.name))
  await expect(page.getByText('v2', { exact: true })).toBeVisible()

  const stack = await prisma.asset.findFirstOrThrow({
    where: { projectId, parentId: rootFolderId, type: 'version_stack' },
  })

  // Open file view
  await page.goto(`/projects/${projectId}/files/${stack.id}`)

  // Open breadcrumb menu and click "Manage versions..."
  await page.getByRole('button', { name: new RegExp(fileB.name) }).click()
  await page.getByRole('menuitem', { name: 'Versions', exact: true }).hover()
  await page.getByRole('button', { name: /manage versions$/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Remove fileB -> stack dissolves -> only fileA remains
  const rowB = dialog.locator('div.group', { hasText: fileB.name })
  await rowB.hover()
  const moreButton = rowB.getByRole('button', { name: 'More options' })
  await moreButton.click()
  await page.getByRole('menuitem', { name: /remove from stack/i }).click()

  // Dialog should close automatically when stack dissolves
  await expect(dialog).not.toBeVisible()

  // DB: stack asset is deleted
  await expect
    .poll(async () => {
      const s = await prisma.asset.findUnique({ where: { id: stack.id } })
      return s === null
    })
    .toBe(true)

  // Both fileA and fileB are now standalone files in rootFolder
  const updatedFileA = await prisma.asset.findUnique({ where: { id: fileA.id } })
  const updatedFileB = await prisma.asset.findUnique({ where: { id: fileB.id } })
  expect(updatedFileA?.parentId).toBe(rootFolderId)
  expect(updatedFileB?.parentId).toBe(rootFolderId)
})

test('dissolving a shared version stack renders the remaining standalone file name on the share page', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project

  const fileA = await seedFile(prisma, projectId, rootFolderId, `e2e-shd-a-${Date.now()}`)
  const fileB = await seedFile(prisma, projectId, rootFolderId, `e2e-shd-b-${Date.now()}`)

  await page.goto(`/projects/${projectId}`)
  await dragCard(page, fileCard(page, fileB.name), fileCard(page, fileA.name))
  await expect(page.getByText('v2', { exact: true })).toBeVisible()

  const stack = await prisma.asset.findFirstOrThrow({
    where: { projectId, parentId: rootFolderId, type: 'version_stack' },
  })

  // Share the version stack
  await fileCard(page, fileB.name).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Create Share Link' }).click()
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Share link created' })
  await expect(toast).toBeVisible()

  const share = await prisma.shareLink.findFirstOrThrow({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })

  // Open file viewer for the stack
  await page.goto(`/projects/${projectId}/files/${stack.id}`)

  // Open breadcrumb menu and click "Manage versions"
  await page.getByRole('button', { name: new RegExp(fileB.name) }).click()
  await page.getByRole('menuitem', { name: 'Versions', exact: true }).hover()
  await page.getByRole('button', { name: /manage versions$/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Remove fileB -> stack dissolves -> only fileA remains
  const rowB = dialog.locator('div.group', { hasText: fileB.name })
  await rowB.hover()
  const moreButton = rowB.getByRole('button', { name: 'More options' })
  await moreButton.click()
  await page.getByRole('menuitem', { name: /remove from stack/i }).click()

  await expect(dialog).not.toBeVisible()

  // Navigate to public share page: verify fileA is displayed with its non-empty name
  await page.goto(`/share/${share.id}`)
  await expect(fileCard(page, fileA.name)).toBeVisible()
  await expect(fileCard(page, fileB.name)).not.toBeVisible()
})

test('moving a shared file into a shared version stack leaves only 1 stack card on the share page', async ({
  project,
  prisma,
}) => {
  const { page, projectId, rootFolderId } = project

  const fileA = await seedFile(prisma, projectId, rootFolderId, `e2e-mvsh-a-${Date.now()}`)
  const fileB = await seedFile(prisma, projectId, rootFolderId, `e2e-mvsh-b-${Date.now()}`)
  const fileC = await seedFile(prisma, projectId, rootFolderId, `e2e-mvsh-c-${Date.now()}`)

  await page.goto(`/projects/${projectId}`)

  // 1. Create a version stack from file B and file A (stack has v2, displays file B)
  await dragCard(page, fileCard(page, fileB.name), fileCard(page, fileA.name))
  await expect(page.getByText('v2', { exact: true })).toBeVisible()

  const stack = await prisma.asset.findFirstOrThrow({
    where: { projectId, parentId: rootFolderId, type: 'version_stack' },
  })

  // 2. Create a share link and add both stack AB and file C to it
  const share = await apiCreateShare(project.context.request, projectId, `Test Share ${Date.now()}`)
  await apiAddAssetsToShare(project.context.request, share.id, [stack.id, fileC.id])

  // Verify initial share page has both stack and file C
  await page.goto(`/share/${share.id}`)
  await expect(fileCard(page, fileB.name)).toBeVisible()
  await expect(fileCard(page, fileC.name)).toBeVisible()

  // 3. In project page, drop file C onto stack card (displays file B)
  await page.goto(`/projects/${projectId}`)
  await dragCard(page, fileCard(page, fileC.name), fileCard(page, fileB.name))
  await expect(page.getByText('v3', { exact: true })).toBeVisible()

  // 4. Return to public share page: now only 1 card exists (the stack showing file C with v3)
  await page.goto(`/share/${share.id}`)
  await expect(page.getByText('v3', { exact: true })).toBeVisible()
  await expect(fileCard(page, fileC.name)).toBeVisible()
  await expect(fileCard(page, fileB.name)).not.toBeVisible()

  // DB: share rootFolder fileCount is 1 and exactly 1 symlink exists
  const symlinks = await prisma.asset.findMany({
    where: { parentId: share.rootFolderId, type: 'symlink' },
  })
  expect(symlinks).toHaveLength(1)
  expect(symlinks[0].targetId).toBe(stack.id)

  const updatedShareRoot = await prisma.asset.findUnique({ where: { id: share.rootFolderId } })
  expect(updatedShareRoot?.fileCount).toBe(1)
})
