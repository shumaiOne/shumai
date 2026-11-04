import { expect, test } from '../../fixtures'
import { fileCard } from '../../helpers/files'

test('owner sees Copy submenu in context menu and copies file name', async ({
  file,
  browserName,
}) => {
  const { page, projectId, fileName } = file

  if (browserName === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  }
  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, fileName)).toBeVisible()

  // Right-click context menu
  await fileCard(page, fileName).click({ button: 'right' })
  const copySubTrigger = page.getByRole('menuitem', { name: /^Copy$|^复制$/i })
  await expect(copySubTrigger).toBeVisible()
  await copySubTrigger.click()

  // Verify submenu items are visible
  await expect(page.getByRole('menuitem', { name: /^Name$|^名称$/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /^Link$|^链接$/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /^Download link$|^下载链接$/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /^ID$/i })).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: /^Markdown link$|^Markdown 链接$/i }),
  ).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /^Storage path$|^存储路径$/i })).toBeVisible()

  // Click "Name"
  await page.getByRole('menuitem', { name: /^Name$|^名称$/i }).click()
  const toast = page.locator('[data-sonner-toast]').filter({
    hasText: /Copied name to clipboard|已复制名称到剪贴板/i,
  })
  await expect(toast).toBeVisible()

  if (browserName === 'chromium') {
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toBe(fileName)
  }
})
