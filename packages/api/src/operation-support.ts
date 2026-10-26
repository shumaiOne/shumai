import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Operation } from '@shumai/core/src/operations'
import { teamService } from '@shumai/core/src/team/team'
import { logger } from '@shumai/core/src/logger'

/**
 * Map an error thrown while running an Operation to a status and a message that is safe to
 * return to an external caller. `HTTPException`s and plain `Error`s raised by services carry
 * user-facing messages; anything else (e.g. database driver errors) is logged and hidden.
 */
export function describeOperationError(
  operation: string,
  err: unknown,
): { status: ContentfulStatusCode; message: string } {
  if (err instanceof HTTPException) {
    return { status: err.status as ContentfulStatusCode, message: err.message }
  }
  logger.error({ err, operation }, 'Operation failed')
  if (err instanceof Error && err.constructor === Error) {
    return { status: 500, message: err.message }
  }
  return { status: 500, message: 'Internal server error' }
}

/**
 * Mirrors the read-only demo mode enforced by `authMiddleware` for session requests:
 * Operations that change data are rejected for users without a writable role in any team.
 */
export async function assertWritableInDemoMode(op: Operation, userId: string): Promise<void> {
  if (process.env.SHUMAI_DEMO_MODE !== '1' || op.definition.annotations.readOnly) return
  if (!(await teamService.hasWritableRoleInAnyTeam(userId))) {
    throw new HTTPException(403, { message: 'System is in read-only mode' })
  }
}
