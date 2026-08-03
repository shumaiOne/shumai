import type { PrismaClient } from '../../../../packages/db/src/generated/prisma/client'
import { uniqueEmail } from './auth'

export interface SeededMember {
  userId: string
  email: string
}

/**
 * Seeds a new user with a team membership of the given role directly through
 * the database (fast, no UI). The user is not authenticated.
 */
export async function seedTeamMember(
  prisma: PrismaClient,
  teamId: string,
  role: 'owner' | 'editor' | 'reviewer',
): Promise<SeededMember> {
  const email = uniqueEmail(`member-${role}`)
  const user = await prisma.user.create({
    data: { name: email, email, password: 'Password123!' },
  })
  await prisma.teamMember.create({
    data: { teamId, userId: user.id, role, scope: 'team' },
  })
  return { userId: user.id, email }
}
