import { expect, test } from '../../fixtures'
import { openProjectMembersDialog } from '../../helpers/ui'
import { seedProjectMember } from '../../helpers/team'

test('owner changes a project member role in the members dialog and permissions update', async ({
  project,
  browser,
  prisma,
}) => {
  const { page, teamId, projectId, context } = project
  const member = await seedProjectMember(
    prisma,
    teamId,
    projectId,
    'reviewer',
    'project',
    browser,
    context,
  )

  // Open the project detail page and open the project members dialog
  await page.goto(`/projects/${projectId}`)
  const dialog = await openProjectMembersDialog(page)

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

  // DB verification: projectMember role is updated to editor
  const pm = await prisma.projectMember.findUnique({
    where: {
      projectIdTeamMemberId: {
        projectId,
        teamMemberId: member.teamMemberId,
      },
    },
  })
  expect(pm?.role).toBe('editor')

  // Functional verification: project member can now perform edit API operations on the project
  const memberContext = member.context!
  const memberPage = await memberContext.newPage()
  try {
    await memberPage.goto(`/teams/${teamId}`)

    // Verify edit permission on project via API (PUT /api/projects/:projectId requires Edit permission)
    const res = await memberContext.request.put(`/api/projects/${projectId}`, {
      data: { enableNotification: true },
    })
    expect(res.status()).toBe(200)
  } finally {
    await memberContext.close()
  }
})
