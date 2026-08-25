import { expect, test } from '../../fixtures'
import { apiSignup, E2E_PASSWORD, uniqueEmail } from '../../helpers/auth'
import { loginViaUi } from '../../helpers/ui'

test('should show error when accessing reset-password page without token', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(page.getByText('Invalid or missing reset token.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Go to Login' })).toBeVisible()
})

test('should reset password with valid token and allow logging in with new password', async ({
  page,
  request,
  prisma,
}) => {
  const email = uniqueEmail('reset-pw')
  const oldPassword = E2E_PASSWORD
  const newPassword = 'newSecretPassword123'

  // 1. Seed user
  await apiSignup(request, email, oldPassword)

  // 2. Request password reset via API
  const resetRes = await request.post('/api/auth/request-password-reset', {
    data: {
      email,
      redirectTo: '/reset-password',
    },
  })
  expect(resetRes.ok()).toBe(true)

  // Retrieve the generated verification token from DB
  const verification = await prisma.verification.findFirst({
    where: {
      identifier: { startsWith: 'reset-password:' },
    },
    orderBy: { createdAt: 'desc' },
  })
  expect(verification).not.toBeNull()
  const token = verification!.identifier.replace('reset-password:', '')

  // 3. Open reset password page with token
  await page.goto(`/reset-password?token=${token}`)

  // 4. Fill in new password and confirmation
  await page.locator('input#password').fill(newPassword)
  await page.locator('input#confirmPassword').fill(newPassword)

  // 5. Submit form
  await page.getByRole('button', { name: 'Reset Password' }).click()

  // 6. Verify success state
  await expect(page.getByText('Password reset successfully!')).toBeVisible()

  // 7. Click Go to Login
  await page.getByRole('button', { name: 'Go to Login' }).click()
  await expect(page).toHaveURL('/login')

  // 8. Log in with the new password
  await loginViaUi(page, email, newPassword)
  await expect(page).toHaveURL(/\/teams\/[^/]+/)
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
})
