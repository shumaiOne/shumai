import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { defineOperation } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation, type OperationImplementation } from './implement'
import { runOperation } from './run'
import type { OperationContext } from './context'

const touchThing = defineOperation({
  name: 'touch_thing',
  title: 'Touch Thing',
  description: 'Touch a thing for testing.',
  input: z.object({ thingId: z.string().min(1), otherId: z.string().optional() }),
  output: z.object({ touched: z.string() }),
  surfaces: ['agent'],
  annotations: { readOnly: false, destructive: false },
})

const ctx: OperationContext = { userId: 'user-1', agentId: 'agent-1', via: 'agent' }

describe('runOperation', () => {
  const calls: string[] = []

  beforeEach(() => {
    calls.length = 0
    vi.spyOn(authzService, 'hasPermission').mockImplementation(async (req) => {
      calls.push(`authz:${req.id}`)
    })
    vi.spyOn(assetService, 'getAssetContext').mockResolvedValue({
      teamId: 'team-ctx',
      projectId: 'project-ctx',
    })
    vi.spyOn(auditLogService, 'logAction').mockImplementation(async (params) => {
      calls.push(`audit:${params.itemId}`)
      return null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeOp(overrides: Partial<OperationImplementation<typeof touchThing, unknown>> = {}) {
    return implementOperation(touchThing, {
      authz: (input) => {
        const checks = [
          { permission: Permission.Edit, type: ResourceType.Asset, id: input.thingId },
        ]
        if (input.otherId) {
          checks.push({ permission: Permission.Read, type: ResourceType.Asset, id: input.otherId })
        }
        return checks
      },
      prepare: async () => {
        calls.push('prepare')
        return { label: 'prepared' }
      },
      execute: async (input, _ctx, prepared) => {
        calls.push(`execute:${(prepared as { label: string }).label}`)
        return { touched: input.thingId }
      },
      audit: (input) => [
        { action: AuditAction.file_update, itemId: input.thingId, contextAssetId: input.thingId },
      ],
      ...overrides,
    })
  }

  it('runs validate → authz → prepare → execute → audit in order and returns the output', async () => {
    const output = await runOperation(makeOp(), ctx, { thingId: 't1', otherId: 't2' })

    expect(output).toEqual({ touched: 't1' })
    expect(calls).toEqual(['authz:t1', 'authz:t2', 'prepare', 'execute:prepared', 'audit:t1'])
    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: 't1',
    })
  })

  it('rejects invalid input with a 400 before checking permissions', async () => {
    const promise = runOperation(makeOp(), ctx, { thingId: '' })

    await expect(promise).rejects.toBeInstanceOf(HTTPException)
    await expect(runOperation(makeOp(), ctx, { thingId: '' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Invalid input for touch_thing'),
    })
    expect(calls).toEqual([])
  })

  it('treats a missing input as an empty object', async () => {
    await expect(runOperation(makeOp(), ctx, undefined)).rejects.toMatchObject({ status: 400 })
  })

  it('stops before any side effect when a later permission check fails', async () => {
    vi.mocked(authzService.hasPermission).mockImplementation(async (req) => {
      calls.push(`authz:${req.id}`)
      if (req.id === 't2') throw new HTTPException(403, { message: 'Forbidden' })
    })

    await expect(runOperation(makeOp(), ctx, { thingId: 't1', otherId: 't2' })).rejects.toThrow(
      'Forbidden',
    )
    expect(calls).toEqual(['authz:t1', 'authz:t2'])
    expect(auditLogService.logAction).not.toHaveBeenCalled()
  })

  it('fails with a 500 and writes no audit entry when the output does not match the schema', async () => {
    const op = makeOp({
      // Simulates an implementation bug the type checker cannot see
      execute: async () => ({ touched: 42 }) as unknown as { touched: string },
    })

    await expect(runOperation(op, ctx, { thingId: 't1' })).rejects.toMatchObject({ status: 500 })
    expect(auditLogService.logAction).not.toHaveBeenCalled()
  })

  it('strips fields that are not part of the output schema', async () => {
    const op = makeOp({
      execute: async () => ({ touched: 't1', secret: 'x' }) as { touched: string },
    })

    await expect(runOperation(op, ctx, { thingId: 't1' })).resolves.toEqual({ touched: 't1' })
  })

  it('records audit entries with the caller, agent, via, and the resource team context', async () => {
    await runOperation(makeOp(), { ...ctx, teamId: 'session-team' }, { thingId: 't1' })

    expect(assetService.getAssetContext).toHaveBeenCalledWith('t1')
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.file_update,
      teamId: 'team-ctx',
      projectId: 'project-ctx',
      itemId: 't1',
      userId: 'user-1',
      agentId: 'agent-1',
      via: 'agent',
    })
  })

  it('uses explicit team context from audit entries when provided', async () => {
    const op = makeOp({
      audit: () => [
        { action: AuditAction.file_delete, itemId: 't1', teamId: 'team-x', projectId: 'p-x' },
      ],
    })

    await runOperation(op, { userId: 'user-1', via: 'api' }, { thingId: 't1' })

    expect(assetService.getAssetContext).not.toHaveBeenCalled()
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.file_delete,
      teamId: 'team-x',
      projectId: 'p-x',
      itemId: 't1',
      userId: 'user-1',
      agentId: undefined,
      via: 'api',
    })
  })

  it('still succeeds when the audit context cannot be resolved', async () => {
    vi.mocked(assetService.getAssetContext).mockRejectedValue(new Error('Asset not found'))

    await expect(runOperation(makeOp(), ctx, { thingId: 't1' })).resolves.toEqual({
      touched: 't1',
    })
    expect(auditLogService.logAction).not.toHaveBeenCalled()
  })

  it('propagates errors thrown by execute without auditing', async () => {
    const op = makeOp({
      execute: async () => {
        throw new HTTPException(409, { message: 'Conflict' })
      },
    })

    await expect(runOperation(op, ctx, { thingId: 't1' })).rejects.toMatchObject({ status: 409 })
    expect(auditLogService.logAction).not.toHaveBeenCalled()
  })
})
