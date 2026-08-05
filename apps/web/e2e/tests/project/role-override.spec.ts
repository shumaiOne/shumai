import { expect, test } from '../../fixtures'
import { openProjectMembersDialog } from '../../helpers/ui'
import { seedTeamMember } from '../../helpers/team'

test('owner adds team member to project with role override and permissions enforce project role', async ({
  project,
  browser,
  prisma,
}) => {
  const { page, teamId, projectId, context } = project

  // Seed a team-scoped member with role 'editor'
  const member = await seedTeamMember(prisma, teamId, 'editor', browser, context)

  // Open the project page and project members dialog
  await page.goto(`/projects/${projectId}`)
  const dialog = await openProjectMembersDialog(page)

  // Find the team member in the "Add team member to project" section
  const teamMemberSectionRow = dialog
    .locator('div.flex.items-center.justify-between')
    .filter({ hasText: member.email })
  await expect(teamMemberSectionRow).toBeVisible()

  // Select "Reviewer" role override from the dropdown in that row (initially "Editor")
  await teamMemberSectionRow.getByRole('button', { name: /Editor/i }).click()
  await page.getByRole('menuitemradio', { name: 'Reviewer' }).click()

  // Click "Set Role" button to save the project role override
  await teamMemberSectionRow.getByRole('button', { name: 'Set Role' }).click()

  // DB verification: projectMember record exists with role 'reviewer'
  await expect
    .poll(
      async () =>
        prisma.projectMember.findUnique({
          where: {
            projectIdTeamMemberId: {
              projectId,
              teamMemberId: member.teamMemberId,
            },
          },
        }),
      { timeout: 10000 },
    )
    .not.toBeNull()

  const pm = await prisma.projectMember.findUnique({
    where: {
      projectIdTeamMemberId: {
        projectId,
        teamMemberId: member.teamMemberId,
      },
    },
  })
  expect(pm?.role).toBe('reviewer')

  // Functional verification: team editor's permissions in this project are overridden to reviewer (edit returns 403)
  const memberContext = member.context!
  const memberPage = await memberContext.newPage()
  try {
    await memberPage.goto(`/teams/${teamId}`)

    // Project edit action is rejected with 403 because the project role override is 'reviewer'
    const res = await memberContext.request.put(`/api/projects/${projectId}`, {
      data: { enableNotification: true },
    })
    expect(res.status()).toBe(403)
  } finally {
    await memberContext.close()
  }
})
