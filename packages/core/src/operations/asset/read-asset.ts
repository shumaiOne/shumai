import { getAssetRender, readAsset, type Via } from '@shumai/operations'
import {
  assetReadService,
  toAssetReadOutput,
  UnsupportedAssetTypeError,
} from '@shumai/core/src/asset-read'
import { implementOperation } from '../implement'

/**
 * How long each surface waits for a render before returning `pending`. MCP clients commonly
 * time out around 60s, so MCP and generic API callers get a short budget.
 */
export const READ_WAIT_BUDGET_MS: Record<Via, number> = {
  agent: 60_000,
  mcp: 20_000,
  cli: 120_000,
  api: 20_000,
}

/**
 * Surfaces whose results are presented on the server (agent tools, MCP tool results). They get
 * storage keys so the presenter can attach image bytes; the MCP presenter strips the keys
 * before anything leaves the server. CLI and REST callers only get links.
 */
const SERVER_PRESENTED: ReadonlySet<Via> = new Set(['agent', 'mcp'])

/** `maxWaitSeconds` can only shorten the surface budget. */
export function waitBudgetMs(via: Via, maxWaitSeconds: number | undefined): number {
  const budget = READ_WAIT_BUDGET_MS[via]
  return maxWaitSeconds === undefined ? budget : Math.min(budget, maxWaitSeconds * 1000)
}

export const readAssetOp = implementOperation(readAsset, {
  // assetReadService checks Read on the asset before planning or creating any render task.
  authz: () => [],
  execute: async (input, ctx) => {
    const { maxWaitSeconds, ...request } = input
    const outcome = await assetReadService
      .read({ kind: 'user', userId: ctx.userId }, request, {
        waitBudgetMs: waitBudgetMs(ctx.via, maxWaitSeconds),
      })
      .catch((err: unknown) => {
        // CLI users download with a command, not a tool.
        if (err instanceof UnsupportedAssetTypeError && ctx.via === 'cli') {
          throw new UnsupportedAssetTypeError(
            err.assetId,
            err.mediaType,
            `Run \`shumai-cli download ${err.assetId}\` to download it.`,
          )
        }
        throw err
      })
    return toAssetReadOutput(outcome, { includeKeys: SERVER_PRESENTED.has(ctx.via) })
  },
})

export const getAssetRenderOp = implementOperation(getAssetRender, {
  // Only the requesting user, with Read on the asset, can fetch a render (checked by the service).
  authz: () => [],
  execute: async (input, ctx) => {
    const outcome = await assetReadService.getRender(ctx.userId, input.taskId, {
      waitBudgetMs: waitBudgetMs(ctx.via, input.maxWaitSeconds),
    })
    return toAssetReadOutput(outcome, { includeKeys: SERVER_PRESENTED.has(ctx.via) })
  },
})
