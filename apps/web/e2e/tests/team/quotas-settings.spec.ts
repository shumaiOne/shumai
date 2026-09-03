import { expect, test } from '../../fixtures'

test('owner manages resource quotas in settings and resets usage from the dashboard', async ({
  owner,
  prisma,
}) => {
  const { page, teamId, email } = owner

  // 1. Navigate to team settings
  await page.goto(`/teams/${teamId}/settings`)

  // 2. Click the Quotas sidebar tab
  await page.getByRole('button', { name: /Quotas|配额/i }).click()

  // Verify URL contains #quotas and remains after reload
  expect(page.url()).toContain('#quotas')
  await page.reload()
  expect(page.url()).toContain('#quotas')

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

  // 7. Usage is now monitored from the dashboard, not the settings rule card.
  await expect(page.getByRole('button', { name: /View Usage|查看使用量/i })).not.toBeVisible()

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

  // 9. Open Edit Dialog by clicking the quota card
  await page.getByText(/50,000 tokens|50000 tokens/i).click()
  await expect(page.getByText(/Edit Quota Rule|编辑配额规则/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Each Member|每个成员/i })).toBeDisabled()
  await expect(page.locator('#quota-resource')).toBeDisabled()

  // 10. Update limit
  await page.fill('#quota-limit', '75000')
  await page.getByRole('button', { name: /^(Save|保存)$/i }).click()

  // Verify updated limit in UI and DB
  await expect(page.getByText(/75,000 tokens|75000 tokens/i)).toBeVisible()
  const updatedRule = await prisma.quotaRule.findFirst({
    where: { id: createdRule?.id },
  })
  expect(updatedRule?.limit).toBe(75000)

  // 11. Verify quota usage and reset it from the dashboard
  const ownerUser = await prisma.user.findUnique({ where: { email } })
  expect(ownerUser).not.toBeNull()
  await prisma.quotaRecord.create({
    data: {
      ruleId: createdRule?.id as string,
      teamId,
      userId: ownerUser?.id,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
      consumed: 100,
    },
  })
  await page.goto(`/teams/${teamId}/dashboard`)
  await page.getByRole('button', { name: /Quotas|配额/i }).click()
  await expect(
    page.getByText(/Monitor live quota usage|在仪表盘中监控实时配额使用情况/),
  ).toBeVisible()

  const quotaRuleButton = page.getByRole('button', { name: /Expand quota rule|展开配额规则/i })
  await quotaRuleButton.click()
  await expect(page.getByText(/^100 \/ 75,000 tokens$|^100 \/ 75000 tokens$/i)).toBeVisible()
  await page.getByRole('button', { name: /Reset Usage|重置使用量/i }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: /Confirm|确认/i }).click()
  await expect(page.getByText(/^0 \/ 75,000 tokens$|^0 \/ 75000 tokens$/i)).toBeVisible()

  const resetRecord = await prisma.quotaRecord.findFirst({
    where: { ruleId: createdRule?.id, userId: ownerUser?.id },
  })
  expect(resetRecord?.consumed).toBe(0)

  // 12. Delete quota rule from settings
  await page.goto(`/teams/${teamId}/settings`)
  await page.getByRole('button', { name: /Quotas|配额/i }).click()
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
