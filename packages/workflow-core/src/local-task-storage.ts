import { AsyncLocalStorage } from 'node:async_hooks'
import type { LocalTaskContext } from './workflow-utils'

// Store AsyncLocalStorage on globalThis to share with workflow-utils.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalObj = globalThis as any
if (!globalObj.__localTaskStorage) {
  globalObj.__localTaskStorage = new AsyncLocalStorage<LocalTaskContext>()
}

export const localTaskStorage: AsyncLocalStorage<LocalTaskContext> = globalObj.__localTaskStorage
