import { expect, test } from '../../fixtures'
import { apiSignup, E2E_PASSWORD, uniqueEmail } from '../../helpers/auth'
import { loginViaUi } from '../../helpers/ui'

test('should log in with existing credentials', async ({ page, request }) => {
  const email = uniqueEmail('login')
  const password = E2E_PASSWORD

  // Seed an existing user through the API (setup, not the flow under test)
  await apiSignup(request, email, password)

  // The default page context is a fresh, logged-out session
  await loginViaUi(page, email, password)

  // The logged-in user lands on their team page
  await expect(page).toHaveURL(/\/teams\/[^/]+/)
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
})
