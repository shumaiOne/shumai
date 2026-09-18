import { AsyncLocalStorage } from 'node:async_hooks'
import type { LocalTaskContext } from './workflow-utils'

// Store AsyncLocalStorage on globalThis to share with workflow-utils without
// requiring workflow-utils to import node:async_hooks (which would break Temporal's Webpack workflow bundler).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalObj = globalThis as any
if (!globalObj.__localTaskStorage) {
  globalObj.__localTaskStorage = new AsyncLocalStorage<LocalTaskContext>()
}

export const localTaskStorage: AsyncLocalStorage<LocalTaskContext> = globalObj.__localTaskStorage
