import { expect, test } from '../../fixtures'
import { openMembersDialog } from '../../helpers/ui'
import { seedTeamMember } from '../../helpers/team'

test('owner removes a member via the members dialog and the membership is deleted', async ({
  owner,
  prisma,
}) => {
  const { page, teamId } = owner
  const member = await seedTeamMember(prisma, teamId, 'reviewer')

  // Reload so the members dialog fetches the newly seeded member
  await page.reload()
  const dialog = await openMembersDialog(page)

  const memberRow = dialog
    .locator('div.flex.items-center.justify-between')
    .filter({ hasText: member.email })
  await expect(memberRow).toBeVisible()

  // The last button in the row is the remove (trash) button
  await memberRow.getByRole('button').last().click()

  const removeDialog = page.getByRole('alertdialog')
  await expect(removeDialog).toBeVisible()
  await expect(removeDialog.getByRole('heading', { name: 'Remove Member' })).toBeVisible()
  await removeDialog.getByRole('button', { name: 'Remove' }).click()

  // The member row disappears from the dialog
  await expect(memberRow).not.toBeVisible()

  // DB: the owner is the only remaining team member, but the user still exists
  const remainingMembers = await prisma.teamMember.count({ where: { teamId } })
  expect(remainingMembers).toBe(1)

  const user = await prisma.user.findUnique({ where: { id: member.userId } })
  expect(user).not.toBeNull()
})
