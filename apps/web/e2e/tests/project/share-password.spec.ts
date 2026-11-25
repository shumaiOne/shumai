import { expect, test } from '../../fixtures'
import { apiAddAssetsToShare, apiCreateShare, fileCard } from '../../helpers/files'

test('owner protects a share with a password and guests must enter it to view', async ({
  file,
  browser,
  prisma,
}) => {
  const { context, page, projectId, fileName, fileId } = file

  // Seed the share with the file through the API (setup, not the flow under test)
  const share = await apiCreateShare(context.request, projectId, 'Shared Doc')
  await apiAddAssetsToShare(context.request, share.id, [fileId])

  await page.goto(`/projects/${projectId}/shares/${share.id}`)
  await expect(fileCard(page, fileName)).toBeVisible()

  // Open the Security accordion and enable a password
  await page.getByRole('button', { name: 'Security' }).click()
  const passwordRow = page.getByText('Password').locator('..')
  await passwordRow.getByRole('switch').click()

  const passwordInput = page.getByPlaceholder('Enter password')
  await expect(passwordInput).toBeVisible()
  await passwordInput.fill('secret123')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Settings updated')).toBeVisible()

  const saved = await prisma.shareLink.findUnique({ where: { id: share.id } })
  expect(saved?.password).toBe('secret123')

  // A guest visiting the public link hits the password gate
  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  try {
    await guestPage.goto(`/share/${share.id}`)
    await expect(guestPage.getByText('Password Protected')).toBeVisible()

    // Wrong password keeps the gate open with an error
    await guestPage.getByPlaceholder('Enter password').fill('wrong-password')
    await guestPage.getByRole('button', { name: 'Access Share' }).click()
    await expect(guestPage.getByText('Incorrect password. Please try again.')).toBeVisible()

    // Correct password grants access to the shared file
    await guestPage.getByPlaceholder('Enter password').fill('secret123')
    await guestPage.getByRole('button', { name: 'Access Share' }).click()
    await expect(fileCard(guestPage, fileName)).toBeVisible()
  } finally {
    await guestContext.close()
  }
})

test('a guest can unlock a protected printable comments link directly', async ({
  file,
  browser,
}) => {
  const { context, projectId, fileName, fileId } = file
  const share = await apiCreateShare(context.request, projectId, 'Shared Print')
  await apiAddAssetsToShare(context.request, share.id, [fileId])
  const res = await context.request.put(`/api/shares/${share.id}`, {
    data: { password: 'secret123' },
  })
  expect(res.ok()).toBe(true)

  const guestContext = await browser.newContext()
  const page = await guestContext.newPage()
  try {
    await page.goto(`/print/comments/${fileId}?shareId=${share.id}`)
    const passwordInput = page.getByPlaceholder('Enter password')
    await expect(passwordInput).toBeVisible()
    await passwordInput.fill('wrong-password')
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByText('Incorrect password. Please try again.')).toBeVisible()
    await passwordInput.fill('secret123')
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByTitle(fileName)).toBeVisible()
    await expect(page).toHaveURL(`/print/comments/${fileId}?shareId=${share.id}`)
  } finally {
    await guestContext.close()
  }
})
