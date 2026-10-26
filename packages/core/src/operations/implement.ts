import type { z } from 'zod'
import type { AnyOperationDefinition } from '@shumai/operations'
import type { AuditAction } from '@shumai/dtos'
import type { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import type { OperationContext } from './context'

/** A permission the caller must hold before the Operation runs. */
export interface AuthzCheck {
  permission: Permission
  type: ResourceType
  id: string
}

/**
 * An audit log entry written after the Operation succeeds. Team and project are resolved
 * from `contextAssetId`, or supplied explicitly when that asset may no longer resolve
 * (e.g. after a delete; load them in `prepare`).
 */
export type AuditEntry =
  | { action: AuditAction; itemId: string; contextAssetId: string }
  | { action: AuditAction; itemId: string; teamId: string; projectId?: string }

export type OperationInput<TDef extends AnyOperationDefinition> = z.output<TDef['input']>
export type OperationOutput<TDef extends AnyOperationDefinition> = z.output<TDef['output']>
type OperationResult<TDef extends AnyOperationDefinition> = z.input<TDef['output']>

export interface OperationImplementation<TDef extends AnyOperationDefinition, TPrepared> {
  /** Permissions required for this input. All are checked before any side effect. */
  authz(
    input: OperationInput<TDef>,
    ctx: OperationContext,
  ): readonly AuthzCheck[] | Promise<readonly AuthzCheck[]>
  /** Optional read-only step after authorization; its result is passed to `execute` and `audit`. */
  prepare?(input: OperationInput<TDef>, ctx: OperationContext): Promise<TPrepared>
  /** Perform the Operation by calling core services. Must return data matching the output schema. */
  execute(
    input: OperationInput<TDef>,
    ctx: OperationContext,
    prepared: TPrepared,
  ): Promise<OperationResult<TDef>>
  /** Audit entries to record for a successful invocation. */
  audit?(
    input: OperationInput<TDef>,
    output: OperationOutput<TDef>,
    ctx: OperationContext,
    prepared: TPrepared,
  ): readonly AuditEntry[] | Promise<readonly AuditEntry[]>
}

/** An Operation definition bound to its implementation. Run it with `runOperation`. */
export interface Operation<TDef extends AnyOperationDefinition = AnyOperationDefinition> {
  readonly definition: TDef
  readonly implementation: OperationImplementation<TDef, unknown>
}

export function implementOperation<TDef extends AnyOperationDefinition, TPrepared = undefined>(
  definition: TDef,
  implementation: OperationImplementation<TDef, TPrepared>,
): Operation<TDef> {
  return Object.freeze({
    definition,
    // The prepared value only flows from this implementation's `prepare` into its own
    // `execute`/`audit`, so erasing its type here is safe.
    implementation: implementation as OperationImplementation<TDef, unknown>,
  })
}
