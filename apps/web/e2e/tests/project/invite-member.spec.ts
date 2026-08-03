import { expect, test } from '../../fixtures'
import { E2E_PASSWORD, uniqueEmail } from '../../helpers/auth'
import { apiCreateProject, uniqueProjectName } from '../../helpers/project'
import { generateInviteLink, openProjectMembersDialog } from '../../helpers/ui'

test('owner invites a member to a project; the member only sees the invited project', async ({
  project,
  browser,
  prisma,
}) => {
  const { page, context, teamId, projectId, projectName } = project

  // A second project the invitee must NOT see
  const secondProject = await apiCreateProject(context.request, teamId, uniqueProjectName())

  // 1. Owner opens the project members dialog and generates an invite link
  await page.goto(`/projects/${projectId}`)
  await expect(page.getByTestId('project-members-trigger')).toBeVisible()
  const dialog = await openProjectMembersDialog(page)
  const inviteLink = await generateInviteLink(dialog)

  const inviteCode = new URL(inviteLink).searchParams.get('inviteCode')
  if (!inviteCode) {
    throw new Error(`Invite link is missing the inviteCode param: ${inviteLink}`)
  }
  const origin = new URL(page.url()).origin
  expect(inviteLink.startsWith(`${origin}/signup?inviteCode=`)).toBe(true)

  // 2. The invitee signs up through the invite link in a brand-new session
  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  const inviteeEmail = uniqueEmail('project-invitee')
  try {
    await inviteePage.goto(inviteLink)

    // The invite context banner is shown on the signup page
    await expect(inviteePage.getByText(/invited you to join/)).toBeVisible()

    await inviteePage.fill('#email', inviteeEmail)
    await inviteePage.fill('#password', E2E_PASSWORD)
    await inviteePage.click('button[type="submit"]')

    // The invitee is redirected to the shared team page
    await expect(inviteePage).toHaveURL(/\/teams\/[^/]+/)

    // 3. The invitee only sees the invited project, not the second one
    await expect(inviteePage.getByText(projectName, { exact: true })).toBeVisible()
    await expect(inviteePage.getByText(secondProject.name, { exact: true })).not.toBeVisible()

    // 4. Direct access to the other project is denied (API returns 403)
    const res = await inviteeContext.request.get(`/api/projects/${secondProject.id}`)
    expect(res.status()).toBe(403)

    // 5. Opening the other project URL renders the router error boundary
    await inviteePage.goto(`/projects/${secondProject.id}`)
    await expect(inviteePage.getByText('Something went wrong!')).toBeVisible()
  } finally {
    await inviteeContext.close()
  }

  // 6. DB: the invitee is a project-scoped team member of exactly the invited project
  const inviteeUser = await prisma.user.findUnique({ where: { email: inviteeEmail } })
  expect(inviteeUser).not.toBeNull()

  const tm = await prisma.teamMember.findUnique({
    where: { teamIdUserId: { teamId, userId: inviteeUser!.id } },
  })
  expect(tm?.scope).toBe('project')

  const projectMemberships = await prisma.projectMember.findMany({
    where: { teamMemberId: tm!.id },
  })
  expect(projectMemberships).toHaveLength(1)
  expect(projectMemberships[0].projectId).toBe(projectId)

  const invite = await prisma.invite.findUnique({ where: { code: inviteCode } })
  expect(invite?.used).toBe(true)
  expect(invite?.projectId).toBe(projectId)
})
