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
  await page.click('button[type="submit"]')

  // 6. Verify quota policy card appears in the list
  await expect(page.getByText(/50,000 tokens|50000 tokens/i)).toBeVisible()
  await expect(page.getByText(/Entire Team|整个团队/i)).toBeVisible()

  // Verify in database
  const createdPolicy = await prisma.quotaPolicy.findFirst({
    where: { teamId, limit: 50000 },
  })
  expect(createdPolicy).not.toBeNull()
  expect(createdPolicy?.enabled).toBe(true)

  // 7. Toggle quota rule switch
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).not.toBeChecked()
  const disabledPolicy = await prisma.quotaPolicy.findFirst({
    where: { id: createdPolicy?.id },
  })
  expect(disabledPolicy?.enabled).toBe(false)

  // Toggle back on
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toBeChecked()

  // 8. Click card to open edit dialog
  await page
    .getByText(/AI Tokens|AI Token 总量/i)
    .first()
    .click()
  await expect(page.getByText(/Edit Quota Rule|编辑配额规则/i)).toBeVisible()
  await expect(page.getByText(/Current Usage|当前使用量/i)).toBeVisible()

  // 9. Update limit
  await page.fill('#quota-limit', '75000')
  await page.click('button[type="submit"]')

  // Verify updated limit in UI and DB
  await expect(page.getByText(/75,000 tokens|75000 tokens/i)).toBeVisible()
  const updatedPolicy = await prisma.quotaPolicy.findFirst({
    where: { id: createdPolicy?.id },
  })
  expect(updatedPolicy?.limit).toBe(75000)

  // 9. Delete quota rule
  await page
    .getByText(/AI Tokens|AI Token 总量/i)
    .first()
    .click()
  await page.getByRole('button', { name: /Delete Quota|删除配额/i }).click()
  await page
    .getByRole('button', { name: /Delete|删除/i })
    .last()
    .click()

  // Verify empty state returns
  await expect(page.getByText(/No resource quotas configured|暂未配置资源配额/i)).toBeVisible()
  const deletedPolicy = await prisma.quotaPolicy.findFirst({
    where: { id: createdPolicy?.id },
  })
  expect(deletedPolicy).toBeNull()
})
