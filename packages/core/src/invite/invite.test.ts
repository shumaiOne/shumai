import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db'
import { inviteService } from '@shumai/core/src/invite/invite'
import { beforeEach, describe, expect, it } from 'vitest'

describe('Invite Service', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let team: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let project: any

  beforeEach(async () => {
    admin = await prisma.user.create({
      data: { name: 'admin', email: 'admin-invite@example.com', password: 'pass' },
    })

    team = await prisma.team.create({
      data: { name: 'Team A' },
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: admin.id,
        role: 'owner',
        scope: 'team',
      },
    })

    project = await prisma.project.create({
      data: { name: 'Project A', teamId: team.id },
    })
  })

  it('handles Team Invite', async () => {
    const inv = await inviteService.createTeamInvite({
      teamId: team.id,
      role: 'editor',
      inviterId: admin.id,
    })

    expect(inv.code).toBeDefined()
    expect(inv.teamId).toBe(team.id)

    const newUser = await prisma.user.create({
      data: { name: 'user1', email: 'user1-invite@example.com', password: 'password' },
    })

    await inviteService.consumeInvite(inv.code, newUser.id)

    const tm = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: { teamId: team.id, userId: newUser.id },
      },
    })

    expect(tm).toBeDefined()
    expect(tm?.role).toBe('editor')
    expect(tm?.scope).toBe('team')

    const dbInv = await prisma.invite.findUnique({ where: { code: inv.code } })
    expect(dbInv?.used).toBe(true)

    await expect(inviteService.consumeInvite(inv.code, newUser.id)).rejects.toThrow(
      'invite code already used',
    )
  })

  it('handles Project Invite', async () => {
    const inv = await inviteService.createProjectInvite({
      projectId: project.id,
      role: 'editor',
      inviterId: admin.id,
    })

    expect(inv.code).toBeDefined()
    expect(inv.projectId).toBe(project.id)

    const newUser = await prisma.user.create({
      data: { name: 'user2', email: 'user2-invite@example.com', password: 'password' },
    })

    await inviteService.consumeInvite(inv.code, newUser.id)

    const tm = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: { teamId: team.id, userId: newUser.id },
      },
      include: { projectMembers: true },
    })

    expect(tm).toBeDefined()
    expect(tm?.role).toBe('reviewer')
    expect(tm?.scope).toBe('project')
    expect(tm?.projectMembers.length).toBe(1)
    expect(tm?.projectMembers[0].projectId).toBe(project.id)
    expect(tm?.projectMembers[0].role).toBe('editor')

    const dbInv = await prisma.invite.findUnique({ where: { code: inv.code } })
    expect(dbInv?.used).toBe(true)
  })

  it('handles Upgrade Scope', async () => {
    const user3 = await prisma.user.create({
      data: { name: 'user3', email: 'user3-invite@example.com', password: 'pass' },
    })

    const tm = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user3.id,
        role: 'reviewer',
        scope: 'project',
      },
    })

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        teamMemberId: tm.id,
        role: 'editor',
      },
    })

    const inv = await inviteService.createTeamInvite({
      teamId: team.id,
      role: 'editor',
      inviterId: admin.id,
    })

    await inviteService.consumeInvite(inv.code, user3.id)

    const updatedTm = await prisma.teamMember.findUnique({
      where: { id: tm.id },
    })

    expect(updatedTm?.scope).toBe('team')
    expect(updatedTm?.role).toBe('editor')
  })
})
