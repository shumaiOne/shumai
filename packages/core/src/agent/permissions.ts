import type { TeamMemberRole } from '@shumai/db'

/**
 * Numeric levels for the team role hierarchy used by agent permissions.
 * The record is typed exhaustively over `TeamMemberRole`, so adding a new
 * role to the enum will fail compilation until it is handled here.
 */
const ROLE_LEVELS: Record<TeamMemberRole, number> = {
  reviewer: 1,
  editor: 2,
  owner: 3,
}

/**
 * Numeric level of a team role for agent-permission comparisons.
 * Unknown or missing roles resolve to 0, which is below every agent
 * permission, so lookups fail closed.
 */
export function getRoleLevel(role: TeamMemberRole | null | undefined): number {
  if (!role) return 0
  return ROLE_LEVELS[role] ?? 0
}

/**
 * Minimum role level required to use an agent with the given permission.
 * Unknown or missing permissions resolve to 1 (reviewer), the most
 * permissive default.
 */
export function getAgentRequiredLevel(permission: TeamMemberRole | null | undefined): number {
  if (!permission) return 1
  return ROLE_LEVELS[permission] ?? 1
}

/**
 * Roles allowed to use agents, following the inclusive role hierarchy:
 * owner sees owner+editor+reviewer agents, editor sees editor+reviewer,
 * reviewer (or any unknown/missing role) sees reviewer agents only.
 */
export function getAllowedAgentRoles(role: TeamMemberRole | null | undefined): TeamMemberRole[] {
  const level = getRoleLevel(role)
  if (level >= 3) return ['reviewer', 'editor', 'owner']
  if (level === 2) return ['reviewer', 'editor']
  return ['reviewer']
}
