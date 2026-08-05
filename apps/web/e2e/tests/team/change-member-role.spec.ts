import { expect, test } from '../../fixtures'
import { openMembersDialog } from '../../helpers/ui'
import { seedTeamMember } from '../../helpers/team'

test('owner changes a team member role in the members dialog and permissions update', async ({
  owner,
  browser,
  prisma,
}) => {
  const { page, teamId, context } = owner
  const member = await seedTeamMember(prisma, teamId, 'reviewer', browser, context)

  // Reload so the members dialog fetches the newly seeded member
  await page.reload()
  const dialog = await openMembersDialog(page)

  const memberRow = dialog
    .locator('div.flex.items-center.justify-between')
    .filter({ hasText: member.email })
  await expect(memberRow).toBeVisible()

  // Click role dropdown trigger for this member (currently Reviewer)
  await memberRow.getByRole('button', { name: /Reviewer/i }).click()

  // Select "Editor" from the dropdown menu
  await page.getByRole('menuitemradio', { name: 'Editor' }).click()

  // Verify UI displays updated role "Editor"
  await expect(memberRow.getByRole('button', { name: /Editor/i })).toBeVisible()

  // DB verification: teamMember role is updated to editor
  const tm = await prisma.teamMember.findUnique({
    where: { teamIdUserId: { teamId, userId: member.userId } },
  })
  expect(tm?.role).toBe('editor')

  // Functional verification: member can now create projects in their pre-authenticated session
  const memberContext = member.context!
  const memberPage = await memberContext.newPage()
  try {
    await memberPage.goto(`/teams/${teamId}`)

    // Verify "Create Project" button is visible for editor
    await expect(memberPage.getByRole('button', { name: 'Create Project' })).toBeVisible()

    // Verify project creation API succeeds for editor
    const res = await memberContext.request.post(`/api/teams/${teamId}/projects`, {
      data: { name: `Editor Project ${Date.now()}` },
    })
    expect(res.status()).toBe(200)
  } finally {
    await memberContext.close()
  }
})
