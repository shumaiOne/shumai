import { expect, test } from '../../fixtures'

test('owner manages resource quotas in settings', async ({ owner, prisma }) => {
  const { page, teamId } = owner

  // 1. Navigate to team settings
  await page.goto(`/teams/${teamId}/settings`)

  // 2. Click the Quotas sidebar tab
  await page.getByRole('button', { name: /Quotas|配额/i }).click()

  // 3. Verify Quotas settings card is displayed with empty state
  await expect(page.getByRole('heading', { name: /^(Resource Quotas|资源配额)$/i })).toBeVisible()
  await expect(page.getByText(/No resource quotas configured|暂未配置资源配额/i)).toBeVisible()

  // 4. Open Create Quota Dialog
  await page
    .getByRole('button', { name: /Add Quota|添加配额/i })
    .first()
    .click()
  await expect(page.getByText(/Create Quota Rule|创建配额规则/i)).toBeVisible()

  // 5. Fill and submit new quota rule
  await page.fill('#quota-limit', '50000')
  await page.getByRole('button', { name: /^(Create|创建)$/i }).click()

  // 6. Verify quota rule card appears in the list
  await expect(page.getByText(/50,000 tokens|50000 tokens/i)).toBeVisible()
  await expect(page.getByText(/Each Member|每个成员/i)).toBeVisible()

  // Verify in database
  const createdRule = await prisma.quotaRule.findFirst({
    where: { teamId, limit: 50000 },
  })
  expect(createdRule).not.toBeNull()
  expect(createdRule?.enabled).toBe(true)

  // 7. Click View Usage button to open usage records dialog
  await page.getByRole('button', { name: /View Usage|查看使用量/i }).click()
  await expect(page.getByRole('heading', { name: /Usage Records|使用记录/i })).toBeVisible()
  await expect(page.getByText(/Quota available|配额可用/i)).toBeVisible()

  // Close dialog via Close button
  await page.getByRole('button', { name: /Close|关闭/i }).click()
  await expect(page.getByRole('heading', { name: /Usage Records|使用记录/i })).not.toBeVisible()

  // 8. Toggle quota rule switch
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).not.toBeChecked()
  const disabledRule = await prisma.quotaRule.findFirst({
    where: { id: createdRule?.id },
  })
  expect(disabledRule?.enabled).toBe(false)

  // Toggle back on
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toBeChecked()

  // 9. Open Edit Dialog via dropdown menu
  await page.getByRole('button', { name: 'Quota actions' }).first().click()
  await page.getByRole('menuitem', { name: /Edit|编辑/i }).click()
  await expect(page.getByText(/Edit Quota Rule|编辑配额规则/i)).toBeVisible()

  // 10. Update limit
  await page.fill('#quota-limit', '75000')
  await page.getByRole('button', { name: /^(Save|保存)$/i }).click()

  // Verify updated limit in UI and DB
  await expect(page.getByText(/75,000 tokens|75000 tokens/i)).toBeVisible()
  const updatedRule = await prisma.quotaRule.findFirst({
    where: { id: createdRule?.id },
  })
  expect(updatedRule?.limit).toBe(75000)

  // 11. Delete quota rule
  await page.getByRole('button', { name: 'Quota actions' }).first().click()
  await page.getByRole('menuitem', { name: /Delete|删除/i }).click()
  await page
    .getByRole('button', { name: /Delete|删除/i })
    .last()
    .click()

  // Verify empty state returns
  await expect(page.getByText(/No resource quotas configured|暂未配置资源配额/i)).toBeVisible()
  const deletedRule = await prisma.quotaRule.findFirst({
    where: { id: createdRule?.id },
  })
  expect(deletedRule).toBeNull()
})
