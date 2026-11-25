import { expect, test } from '../../fixtures'
import { apiAddAssetsToShare, apiCreateShare, fileCard } from '../../helpers/files'

test('counts public page views and shows activity in both share management sidebars', async ({
  file,
  browser,
  prisma,
}) => {
  const { context, page, projectId, rootFolderId, fileId, fileName } = file
  const folder = await prisma.asset.create({
    data: {
      name: 'Review Folder',
      projectId,
      parentId: rootFolderId,
      type: 'folder',
      status: 'processed',
    },
  })
  await prisma.asset.update({ where: { id: fileId }, data: { parentId: folder.id } })
  const share = await apiCreateShare(context.request, projectId, 'Client Review')
  await apiAddAssetsToShare(context.request, share.id, [folder.id])
  const password = 'review-password'
  const lock = await context.request.put(`/api/shares/${share.id}`, { data: { password } })
  expect(lock.ok()).toBe(true)
  const readShare = () => prisma.shareLink.findUniqueOrThrow({ where: { id: share.id } })

  await page.goto(`/projects/${projectId}/shares`)
  await expect(page.getByText('Never viewed')).toBeVisible()

  const guest = await browser.newContext()
  try {
    const guestPage = await guest.newPage()
    await guestPage.goto(`/share/${share.id}`)
    await guestPage.getByPlaceholder('Enter password').fill(password)
    await guestPage.getByRole('button', { name: 'Access Share' }).click()
    await expect(fileCard(guestPage, folder.name)).toBeVisible()
    await expect.poll(async () => (await readShare()).views).toBe(1)
    await fileCard(guestPage, folder.name).click()
    await expect(fileCard(guestPage, fileName)).toBeVisible()
    await expect.poll(async () => (await readShare()).views).toBe(2)
    await fileCard(guestPage, fileName).click()
    await expect.poll(async () => (await readShare()).views).toBe(3)
    const beforeReload = (await readShare()).lastViewedAt
    await guestPage.reload()
    await expect.poll(async () => (await readShare()).views).toBe(4)
    expect((await readShare()).lastViewedAt!.getTime()).toBeGreaterThan(beforeReload!.getTime())

    const downloadResponse = guestPage.waitForResponse((response) =>
      response.url().endsWith('/download-url'),
    )
    await guestPage.getByTestId('default-viewer-download-button').click()
    const download = await downloadResponse
    expect(download.status()).toBe(200)

    const comment = await context.request.post(`/api/shares/${share.id}/files/${fileId}/comments`, {
      headers: { 'x-share-password': password },
      data: { message: 'Ready for review', attachmentIds: [] },
    })
    expect(comment.status()).toBe(201)
  } finally {
    await guest.close()
  }

  await page.reload()
  const row = page.getByRole('row').filter({ hasText: share.name })
  await expect(row.getByRole('cell', { name: '4', exact: true })).toBeVisible()
  await expect(row.locator('time')).toContainText('Today')
  await row.getByRole('button', { name: 'View Activity' }).click()
  const sidebar = page.getByRole('dialog', { name: 'Activity' })
  await expect(sidebar.getByText('Opened Share Link')).toHaveCount(1)
  await expect(sidebar.getByText('Viewed Asset')).toHaveCount(2)
  await expect(sidebar.getByText(folder.name)).toBeVisible()
  await expect(sidebar.getByText('Downloaded')).toBeVisible()
  await expect(sidebar.getByText('Commented')).toBeVisible()
  await expect(sidebar.getByText('Someone').first()).toBeVisible()

  await page.goto(`/projects/${projectId}/shares/${share.id}`)
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Activity' }).click()
  const tab = page.getByRole('tabpanel', { name: 'Activity' })
  await expect(tab.getByText('Opened Share Link')).toHaveCount(1)
  await expect(tab.getByText('Viewed Asset')).toHaveCount(2)
  await expect(tab.getByText('Commented')).toBeVisible()
})

test('a direct historical version link records the version as the viewed asset', async ({
  file,
  browser,
  prisma,
}) => {
  const { context, projectId, rootFolderId, fileId } = file
  const stack = await prisma.asset.create({
    data: {
      name: 'Review Versions',
      projectId,
      parentId: rootFolderId,
      type: 'version_stack',
      status: 'processed',
    },
  })
  await prisma.asset.update({
    where: { id: fileId },
    data: { parentId: stack.id, sortIndex: 'a' },
  })
  const oldVersion = await prisma.asset.create({
    data: {
      name: 'Earlier Cut',
      projectId,
      parentId: stack.id,
      sortIndex: 'b',
      type: 'file',
      status: 'processed',
    },
  })
  const share = await apiCreateShare(context.request, projectId, 'Version Review')
  await apiAddAssetsToShare(context.request, share.id, [stack.id])
  const guest = await browser.newContext()
  try {
    const page = await guest.newPage()
    await page.goto(`/share/${share.id}/files/${stack.id}?version=${oldVersion.id}`)
    await expect
      .poll(() => prisma.shareActivity.count({ where: { shareLinkId: share.id } }))
      .toBe(2)
    const activities = await prisma.shareActivity.findMany({ where: { shareLinkId: share.id } })
    expect(activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'share_viewed', assetId: null }),
        expect.objectContaining({ kind: 'asset_viewed', assetId: oldVersion.id }),
      ]),
    )
    const link = await prisma.shareLink.findUniqueOrThrow({ where: { id: share.id } })
    expect(link.views).toBe(1)
  } finally {
    await guest.close()
  }
})

test('concurrent authorized page opens add every view and one matching activity', async ({
  project,
  browser,
  prisma,
}) => {
  const share = await apiCreateShare(
    project.context.request,
    project.projectId,
    'Concurrent Review',
  )
  const guest = await browser.newContext()
  try {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        guest.request.post(`/api/shares/${share.id}/views`, { data: {} }),
      ),
    )
    expect(responses.map((response) => response.status())).toEqual(Array(8).fill(204))
    const link = await prisma.shareLink.findUniqueOrThrow({ where: { id: share.id } })
    expect(link).toMatchObject({ views: 8, lastViewedAt: expect.any(Date) })
    const activities = await prisma.shareActivity.findMany({ where: { shareLinkId: share.id } })
    expect(activities).toMatchObject([{ kind: 'share_viewed', userId: null, assetId: null }])
  } finally {
    await guest.close()
  }
})
