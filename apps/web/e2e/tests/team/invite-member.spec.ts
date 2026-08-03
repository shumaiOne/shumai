import { expect, test } from '../../fixtures'
import { E2E_PASSWORD, uniqueEmail } from '../../helpers/auth'
import { generateInviteLink, openMembersDialog } from '../../helpers/ui'

test('owner invites a member via invite link and the invitee joins', async ({
  owner,
  browser,
  prisma,
}) => {
  const { page, teamId } = owner

  // 1. Open the team members dialog and generate an invite link
  const dialog = await openMembersDialog(page)
  const inviteLink = await generateInviteLink(dialog)

  const inviteCode = new URL(inviteLink).searchParams.get('inviteCode')
  if (!inviteCode) {
    throw new Error(`Invite link is missing the inviteCode param: ${inviteLink}`)
  }
  const origin = new URL(page.url()).origin
  expect(inviteLink.startsWith(`${origin}/signup?inviteCode=`)).toBe(true)

  // 2. The invitee opens the link in a brand-new session (no cookies)
  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  const inviteeEmail = uniqueEmail('invitee')
  try {
    await inviteePage.goto(inviteLink)

    // The invite context banner is shown on the signup page
    await expect(inviteePage.getByText(/invited you to join/)).toBeVisible()

    // 3. The invitee signs up through the invite flow
    await inviteePage.fill('#email', inviteeEmail)
    await inviteePage.fill('#password', E2E_PASSWORD)
    await inviteePage.click('button[type="submit"]')

    // The invitee is redirected to the shared team
    await expect(inviteePage).toHaveURL(/\/teams\/[^/]+/)
  } finally {
    await inviteeContext.close()
  }

  // 4. The owner reloads and sees the new member in the members dialog
  await page.reload()
  const membersDialog = await openMembersDialog(page)
  await expect(membersDialog).toContainText(inviteeEmail)

  // 5. DB: the invitee is a team member and the invite was consumed
  const membershipCount = await prisma.teamMember.count({ where: { teamId } })
  expect(membershipCount).toBe(2)

  const invite = await prisma.invite.findUnique({ where: { code: inviteCode } })
  expect(invite?.used).toBe(true)

  const inviteeUser = await prisma.user.findUnique({ where: { email: inviteeEmail } })
  expect(inviteeUser).not.toBeNull()
})
