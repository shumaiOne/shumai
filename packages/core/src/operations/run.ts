import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import type { AnyOperationDefinition } from '@shumai/operations'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService } from '@shumai/core/src/authz/authz'
import { logger } from '@shumai/core/src/logger'
import type { OperationContext } from './context'
import type { AuditEntry, Operation, OperationInput, OperationOutput } from './implement'

/**
 * Run an Operation for a caller. Every surface (agent tools, MCP, CLI, REST routes) goes
 * through this pipeline, in this order:
 *
 * 1. validate the input against the definition (HTTP 400 on failure)
 * 2. check every declared permission, before any side effect
 * 3. prepare (optional read-only step)
 * 4. execute
 * 5. validate the output against the definition (HTTP 500 on failure: a bug)
 * 6. write audit entries
 *
 * Errors from authorization and services propagate unchanged (usually `HTTPException`).
 */
export async function runOperation<TDef extends AnyOperationDefinition>(
  op: Operation<TDef>,
  ctx: OperationContext,
  rawInput: unknown,
): Promise<OperationOutput<TDef>> {
  const { definition, implementation } = op

  const parsedInput = definition.input.safeParse(rawInput ?? {})
  if (!parsedInput.success) {
    throw new HTTPException(400, {
      message: `Invalid input for ${definition.name}: ${z.prettifyError(parsedInput.error)}`,
    })
  }
  // safeParse on the generic schema type loses the concrete shape; the schema guarantees it.
  const input = parsedInput.data as OperationInput<TDef>

  const checks = await implementation.authz(input, ctx)
  for (const check of checks) {
    await authzService.hasPermission({ user: { id: ctx.userId }, ...check })
  }

  const prepared = implementation.prepare ? await implementation.prepare(input, ctx) : undefined
  const result = await implementation.execute(input, ctx, prepared)

  const parsedOutput = definition.output.safeParse(result)
  if (!parsedOutput.success) {
    logger.error(
      { operation: definition.name, issues: parsedOutput.error.issues },
      'Operation returned output that does not match its schema',
    )
    throw new HTTPException(500, { message: `Operation ${definition.name} failed` })
  }
  const output = parsedOutput.data as OperationOutput<TDef>

  if (implementation.audit) {
    const entries = await implementation.audit(input, output, ctx, prepared)
    for (const entry of entries) {
      await writeAuditEntry(definition.name, entry, ctx)
    }
  }

  return output
}

async function writeAuditEntry(
  operation: string,
  entry: AuditEntry,
  ctx: OperationContext,
): Promise<void> {
  let teamId: string
  let projectId: string | undefined
  if ('contextAssetId' in entry) {
    try {
      ;({ teamId, projectId } = await assetService.getAssetContext(entry.contextAssetId))
    } catch (err) {
      // The Operation already succeeded; a missing audit entry must not turn it into a failure.
      logger.warn(
        { err, operation, itemId: entry.itemId, contextAssetId: entry.contextAssetId },
        'Skipping audit entry: could not resolve team context',
      )
      return
    }
  } else {
    teamId = entry.teamId
    projectId = entry.projectId
  }

  await auditLogService.logAction({
    action: entry.action,
    teamId,
    projectId,
    itemId: entry.itemId,
    userId: ctx.userId,
    agentId: ctx.agentId,
    via: ctx.via,
  })
}
