import { setupTestDbHooks } from '@shumai/db/test'
import { describe, expect, it } from 'vitest'

import { prisma } from '@shumai/db'
import { resolveEffectiveRole } from '@shumai/core/src/authz/authz'

describe('resolveEffectiveRole', () => {
  setupTestDbHooks()

  async function setupData() {
    const team = await prisma.team.create({ data: { name: 'Role Team' } })
    const projectA = await prisma.project.create({
      data: { name: 'Project A', teamId: team.id },
    })
    const projectB = await prisma.project.create({
      data: { name: 'Project B', teamId: team.id },
    })

    // Team-scoped owner
    const owner = await prisma.user.create({ data: { name: 'Owner', email: 'o@x.com' } })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: owner.id, role: 'owner', scope: 'team' },
    })

    // Team-scoped reviewer, promoted to project owner in Project A
    const promoted = await prisma.user.create({ data: { name: 'Promoted', email: 'p@x.com' } })
    const promotedTm = await prisma.teamMember.create({
      data: { teamId: team.id, userId: promoted.id, role: 'reviewer', scope: 'team' },
    })
    await prisma.projectMember.create({
      data: { projectId: projectA.id, teamMemberId: promotedTm.id, role: 'owner' },
    })

    // Team-scoped editor, demoted to project reviewer in Project A
    const demoted = await prisma.user.create({ data: { name: 'Demoted', email: 'd@x.com' } })
    const demotedTm = await prisma.teamMember.create({
      data: { teamId: team.id, userId: demoted.id, role: 'editor', scope: 'team' },
    })
    await prisma.projectMember.create({
      data: { projectId: projectA.id, teamMemberId: demotedTm.id, role: 'reviewer' },
    })

    // Project-scoped member (invited to Project A only, as editor)
    const guest = await prisma.user.create({ data: { name: 'Guest', email: 'g@x.com' } })
    const guestTm = await prisma.teamMember.create({
      data: { teamId: team.id, userId: guest.id, role: 'reviewer', scope: 'project' },
    })
    await prisma.projectMember.create({
      data: { projectId: projectA.id, teamMemberId: guestTm.id, role: 'editor' },
    })

    // Non-member
    const outsider = await prisma.user.create({ data: { name: 'Outsider', email: 'x@x.com' } })

    return { team, projectA, projectB, owner, promoted, demoted, guest, outsider }
  }

  it('returns the team role for team-scoped members without a project override', async () => {
    const { team, projectA, owner } = await setupData()
    await expect(resolveEffectiveRole(team.id, projectA.id, owner.id)).resolves.toBe('owner')
    await expect(resolveEffectiveRole(team.id, undefined, owner.id)).resolves.toBe('owner')
  })

  it('prefers the project override over the team role', async () => {
    const { team, projectA, projectB, promoted, demoted } = await setupData()

    // Promoted: team reviewer -> project owner
    await expect(resolveEffectiveRole(team.id, projectA.id, promoted.id)).resolves.toBe('owner')
    // Outside the overridden project, the team role applies
    await expect(resolveEffectiveRole(team.id, projectB.id, promoted.id)).resolves.toBe('reviewer')

    // Demoted: team editor -> project reviewer
    await expect(resolveEffectiveRole(team.id, projectA.id, demoted.id)).resolves.toBe('reviewer')
    await expect(resolveEffectiveRole(team.id, projectB.id, demoted.id)).resolves.toBe('editor')
  })

  it('resolves the project role for project-scoped members inside their project', async () => {
    const { team, projectA, guest } = await setupData()
    await expect(resolveEffectiveRole(team.id, projectA.id, guest.id)).resolves.toBe('editor')
  })

  it('restricts project-scoped members without a matching project record', async () => {
    const { team, projectB, guest } = await setupData()
    await expect(resolveEffectiveRole(team.id, projectB.id, guest.id)).resolves.toBeNull()
    await expect(resolveEffectiveRole(team.id, undefined, guest.id)).resolves.toBeNull()
  })

  it('returns null for non-members', async () => {
    const { team, projectA, outsider } = await setupData()
    await expect(resolveEffectiveRole(team.id, projectA.id, outsider.id)).resolves.toBeNull()
    await expect(resolveEffectiveRole(team.id, undefined, outsider.id)).resolves.toBeNull()
  })
})
