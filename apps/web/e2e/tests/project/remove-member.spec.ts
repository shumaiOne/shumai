import { expect, test } from '../../fixtures'
import { openProjectMembersDialog } from '../../helpers/ui'
import { seedProjectMember } from '../../helpers/team'

test('owner deletes a member from project via the members dialog and project access is revoked', async ({
  project,
  browser,
  prisma,
}) => {
  const { page, teamId, projectId, context } = project
  const member = await seedProjectMember(
    prisma,
    teamId,
    projectId,
    'editor',
    'project',
    browser,
    context,
  )

  // Open project detail page and project members dialog
  await page.goto(`/projects/${projectId}`)
  const dialog = await openProjectMembersDialog(page)

  const memberRow = dialog
    .locator('div.flex.items-center.justify-between')
    .filter({ hasText: member.email })
  await expect(memberRow).toBeVisible()

  // Click the remove (trash) button for this member
  await memberRow.getByRole('button').last().click()

  // Confirm removal in the alert dialog
  const removeDialog = page.getByRole('alertdialog')
  await expect(removeDialog).toBeVisible()
  await expect(removeDialog.getByRole('heading', { name: 'Remove Member' })).toBeVisible()
  await removeDialog.getByRole('button', { name: 'Remove' }).click()

  // The member is removed from project members and now appears under "Add members from other projects"
  await expect(memberRow.getByRole('button', { name: 'Add to Project' })).toBeVisible()

  // DB verification: projectMember record is deleted
  const pm = await prisma.projectMember.findUnique({
    where: {
      projectIdTeamMemberId: {
        projectId,
        teamMemberId: member.teamMemberId,
      },
    },
  })
  expect(pm).toBeNull()

  // Functional verification: removed member can no longer access the project
  const memberContext = member.context!
  const memberPage = await memberContext.newPage()
  try {
    await memberPage.goto(`/teams/${teamId}`)

    // API request to project returns 403 Forbidden
    const res = await memberContext.request.get(`/api/projects/${projectId}`)
    expect(res.status()).toBe(403)

    // Direct navigation renders error boundary
    await memberPage.goto(`/projects/${projectId}`)
    await expect(memberPage.getByText('Something went wrong!')).toBeVisible()
  } finally {
    await memberContext.close()
  }
})
