import { expect, test } from '../../fixtures'
import { E2E_PASSWORD, uniqueEmail } from '../../helpers/auth'
import { signupViaUi } from '../../helpers/ui'

test('should sign up as the first user and become the team owner', async ({ page, prisma }) => {
  const email = uniqueEmail('signup')
  const password = E2E_PASSWORD

  const teamId = await signupViaUi(page, email, password)

  // The first user is redirected to their single team
  await expect(page).toHaveURL(/\/teams\/[^/]+/)
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()

  // The new user exists and is the owner of the team
  const user = await prisma.user.findUnique({ where: { email } })
  expect(user).not.toBeNull()

  const membership = await prisma.teamMember.findUnique({
    where: { teamIdUserId: { teamId, userId: user!.id } },
  })
  expect(membership?.role).toBe('owner')
  expect(membership?.scope).toBe('team')
})
