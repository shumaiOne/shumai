import type { Browser, BrowserContext } from '@playwright/test'
import type { PrismaClient } from '../../../../packages/db/src/generated/prisma/client'
import { E2E_APP_URL, E2E_PASSWORD, apiSignup, injectAuthState, uniqueEmail } from './auth'

export interface SeededMember {
  userId: string
  email: string
  teamMemberId: string
  context?: BrowserContext
}

/**
 * Seeds a new user with a team membership of the given role.
 * If `browser` and `ownerContext` are provided, generates an invite code via the owner's request context
 * so `apiSignup` succeeds and session cookies/auth state are initialized.
 */
export async function seedTeamMember(
  prisma: PrismaClient,
  teamId: string,
  role: 'owner' | 'editor' | 'reviewer',
  browser?: Browser,
  ownerContext?: BrowserContext,
): Promise<SeededMember> {
  if (browser && ownerContext) {
    const inviteRes = await ownerContext.request.post(`/api/teams/${teamId}/invite`, {
      data: { role: role === 'owner' ? 'editor' : role },
    })
    if (!inviteRes.ok()) {
      throw new Error(`Failed to generate team invite code: ${await inviteRes.text()}`)
    }
    const inviteBody = (await inviteRes.json()) as { code: string }

    const context = await browser.newContext({ baseURL: E2E_APP_URL })
    const email = uniqueEmail(`member-${role}`)
    const user = await apiSignup(context.request, email, E2E_PASSWORD, {
      inviteCode: inviteBody.code,
    })
    await injectAuthState(context, user)

    const tm = await prisma.teamMember.findUnique({
      where: { teamIdUserId: { teamId, userId: user.id } },
    })
    if (tm && tm.role !== role) {
      await prisma.teamMember.update({
        where: { id: tm.id },
        data: { role, scope: 'team' },
      })
    }
    return { userId: user.id, email, teamMemberId: tm!.id, context }
  }

  const email = uniqueEmail(`member-${role}`)
  const user = await prisma.user.create({
    data: { name: email, email, password: 'Password123!' },
  })
  const tm = await prisma.teamMember.create({
    data: { teamId, userId: user.id, role, scope: 'team' },
  })
  return { userId: user.id, email, teamMemberId: tm.id }
}

/**
 * Seeds a new user with a project membership of the given role.
 * If `browser` and `ownerContext` are provided, generates an invite code via the owner's request context
 * so `apiSignup` succeeds and session cookies/auth state are initialized.
 */
export async function seedProjectMember(
  prisma: PrismaClient,
  teamId: string,
  projectId: string,
  role: 'editor' | 'reviewer',
  scope: 'team' | 'project' = 'project',
  browser?: Browser,
  ownerContext?: BrowserContext,
): Promise<SeededMember & { projectMemberId: string }> {
  if (browser && ownerContext) {
    const inviteRes = await ownerContext.request.post(`/api/projects/${projectId}/invite`, {
      data: { role },
    })
    if (!inviteRes.ok()) {
      throw new Error(`Failed to generate project invite code: ${await inviteRes.text()}`)
    }
    const inviteBody = (await inviteRes.json()) as { code: string }

    const context = await browser.newContext({ baseURL: E2E_APP_URL })
    const email = uniqueEmail(`proj-member-${role}`)
    const user = await apiSignup(context.request, email, E2E_PASSWORD, {
      inviteCode: inviteBody.code,
    })
    await injectAuthState(context, user)

    const tm = await prisma.teamMember.findUnique({
      where: { teamIdUserId: { teamId, userId: user.id } },
    })
    const pm = await prisma.projectMember.findFirst({
      where: { projectId, teamMemberId: tm!.id },
    })
    if (pm && pm.role !== role) {
      await prisma.projectMember.update({
        where: { id: pm.id },
        data: { role },
      })
    }

    return { userId: user.id, email, teamMemberId: tm!.id, projectMemberId: pm!.id, context }
  }

  const email = uniqueEmail(`proj-member-${role}`)
  const user = await prisma.user.create({
    data: { name: email, email, password: 'Password123!' },
  })
  const tm = await prisma.teamMember.create({
    data: { teamId, userId: user.id, role: scope === 'team' ? 'editor' : 'reviewer', scope },
  })
  const pm = await prisma.projectMember.create({
    data: { projectId, teamMemberId: tm.id, role },
  })
  return { userId: user.id, email, teamMemberId: tm.id, projectMemberId: pm.id }
}
