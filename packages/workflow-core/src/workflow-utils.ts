import { DBOS, Error as DBOSError } from '@dbos-inc/dbos-sdk'

/**
 * Task queue constants.
 */
export const TaskQueueAgent = 'agent_queue'
export const TaskQueueTranscode = 'transcode_queue'

export class WorkflowFailure extends Error {
  readonly nonRetryable: boolean

  private constructor(message: string, nonRetryable: boolean, cause?: unknown) {
    super(message, { cause })
    this.name = 'WorkflowFailure'
    this.nonRetryable = nonRetryable
  }

  static create(opts: {
    message: string
    nonRetryable?: boolean
    cause?: unknown
  }): WorkflowFailure {
    return new WorkflowFailure(opts.message, opts.nonRetryable ?? false, opts.cause)
  }
}

export const ApplicationFailure = WorkflowFailure

export function isNonRetryableError(err: unknown): boolean {
  if (err instanceof WorkflowFailure) {
    return err.nonRetryable
  }
  if (err && typeof err === 'object' && 'nonRetryable' in err) {
    return (err as { nonRetryable?: unknown }).nonRetryable === true
  }
  return false
}

export function isDbosWorkflowCancelledError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false
  }
  if (err instanceof DBOSError.DBOSWorkflowCancelledError) {
    return true
  }
  const errorObj = err as {
    name?: unknown
    constructor?: { name?: unknown }
    dbosErrorCode?: unknown
  }
  return (
    errorObj.name === 'DBOSWorkflowCancelledError' ||
    errorObj.constructor?.name === 'DBOSWorkflowCancelledError' ||
    errorObj.dbosErrorCode === 24
  )
}

import { logger } from '@shumai/core/src/logger'

/**
 * Environment-aware sleep function. Uses DBOS.sleepms in workflow context.
 */
export async function sleep(ms: number): Promise<void> {
  if (DBOS.isWithinWorkflow()) {
    await DBOS.sleepms(ms)
  } else {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export interface StepOptions {
  name?: string
  runOnCancel?: boolean
}

/**
 * Wraps an activity function so that when invoked within a DBOS workflow, it executes
 * as a durable checkpointed step with retries, timeout, and cancellation handling.
 * When called outside a workflow (e.g. in unit tests), it invokes the underlying function directly.
 */
export function defineStep<TArgs extends unknown[], TRet>(
  fn: (...args: TArgs) => Promise<TRet>,
  options?: StepOptions,
): (...args: TArgs) => Promise<TRet> {
  const stepName = options?.name || fn.name || 'anonymousStep'
  const runOnCancel = options?.runOnCancel ?? false

  const wrapped = async (...args: TArgs): Promise<TRet> => {
    logger.debug({ activityName: stepName }, `Executing step ${stepName}`)

    try {
      let result: TRet
      if (DBOS.isWithinWorkflow()) {
        try {
          result = await DBOS.runStep(() => fn(...args), {
            name: stepName,
            retriesAllowed: true,
            maxAttempts: 5,
            intervalSeconds: process.env.NODE_ENV === 'test' ? 1 : 10,
            backoffRate: 2,
            // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS StepOptions property name
            timeoutMS: 120 * 60 * 1000,
            shouldRetry: (err) => !isNonRetryableError(err),
          })
        } catch (stepErr) {
          if (runOnCancel && isDbosWorkflowCancelledError(stepErr)) {
            result = await fn(...args)
          } else {
            throw stepErr
          }
        }
      } else {
        result = await fn(...args)
      }
      logger.debug({ activityName: stepName }, `Step ${stepName} completed successfully`)
      return result
    } catch (err) {
      logger.error(
        { activityName: stepName, err },
        `Step ${stepName} failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      throw err
    }
  }

  Object.defineProperty(wrapped, 'name', { value: stepName })
  return wrapped
}

/**
 * Parses and validates a concurrency limit environment variable.
 * If the value is undefined, NaN, or <= 0, it falls back to the default value.
 */
export function getConcurrencyLimit(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue
  const parsed = parseInt(envVar, 10)
  if (isNaN(parsed) || parsed <= 0) {
    return defaultValue
  }
  return parsed
}

export interface LocalTaskContext {
  taskId: string
  abortController: AbortController
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalObjWithCancel = globalThis as any
if (!globalObjWithCancel.__localCancelHandlers) {
  globalObjWithCancel.__localCancelHandlers = new Map<string, () => void>()
}
const localCancelHandlers: Map<string, () => void> = globalObjWithCancel.__localCancelHandlers

if (!globalObjWithCancel.__localTaskAbortControllers) {
  globalObjWithCancel.__localTaskAbortControllers = new Map<string, AbortController>()
}
const localTaskAbortControllers: Map<string, AbortController> =
  globalObjWithCancel.__localTaskAbortControllers

interface LocalTaskStorageHolder {
  getStore: () => LocalTaskContext | undefined
  run: <T>(store: LocalTaskContext, fn: () => T) => T
}

function getLocalTaskStorage(): LocalTaskStorageHolder | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__localTaskStorage
}

export function registerLocalTaskAbortController(
  taskId: string,
  controller: AbortController,
): void {
  localTaskAbortControllers.set(taskId, controller)
}

export function unregisterLocalTaskAbortController(taskId: string): void {
  localTaskAbortControllers.delete(taskId)
}

export function runInLocalTaskContext<T>(context: LocalTaskContext, fn: () => T): T {
  registerLocalTaskAbortController(context.taskId, context.abortController)
  const storage = getLocalTaskStorage()
  if (storage) {
    return storage.run(context, fn)
  }
  return fn()
}

export function getLocalTaskAbortSignal(taskId?: string): AbortSignal | undefined {
  if (DBOS.stepStatus?.cancelSignal) {
    return DBOS.stepStatus.cancelSignal
  }
  if (taskId) {
    const controller = localTaskAbortControllers.get(taskId)
    if (controller) {
      return controller.signal
    }
  }
  return getLocalTaskStorage()?.getStore()?.abortController?.signal
}

export function registerLocalCancelHandler(taskId: string, cancelFn: () => void) {
  localCancelHandlers.set(taskId, cancelFn)
}

export function unregisterLocalCancelHandler(taskId: string) {
  localCancelHandlers.delete(taskId)
}

export function triggerLocalCancel(taskId: string): boolean {
  let cancelled = false
  const controller = localTaskAbortControllers.get(taskId)
  if (controller) {
    controller.abort()
    localTaskAbortControllers.delete(taskId)
    cancelled = true
  }
  const handler = localCancelHandlers.get(taskId)
  if (handler) {
    handler()
    cancelled = true
  }
  return cancelled
}
