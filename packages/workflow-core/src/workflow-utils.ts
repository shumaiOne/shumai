import { DBOS } from '@dbos-inc/dbos-sdk'

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

const CLEANUP_OR_FINALIZE_ACTIVITIES = new Set([
  'cleanupTmpDirActivity',
  'updateTaskStatusActivity',
  'updateWorkflowTaskActivity',
  'updateAssetStatusActivity',
  'updateCommentActivity',
  'deleteS3ObjectActivity',
])

interface LocalLogger {
  debug(obj: Record<string, unknown>, msg: string): void
  info(obj: Record<string, unknown>, msg: string): void
  error(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
}

/* eslint-disable @typescript-eslint/naming-convention */
const globalObj = globalThis as typeof globalThis & {
  __localActivities?: Record<string, unknown>
  __localLogger?: LocalLogger
}
/* eslint-enable @typescript-eslint/naming-convention */

function localActivitiesProxy(): Record<string, unknown> {
  const acts = globalObj.__localActivities
  if (!acts) {
    throw new Error('Local activities not injected into globalThis.__localActivities')
  }
  return acts
}

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

/**
 * Dynamic activities proxy that exposes registered activities and attaches metadata.
 */
// getActivities must default to `any` so that workflows can dynamically
// destructure and call any activity when they do not supply a precise type parameter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getActivities<T = any>(): T {
  const baseProxy = localActivitiesProxy()

  // Wrap the base proxy to attach the activity name to the returned functions
  // We use any here because we are dynamically intercepting properties on the proxy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Proxy(baseProxy as any, {
    get(target, prop) {
      if (typeof prop === 'string') {
        const original = target[prop]
        if (typeof original === 'function') {
          // Return a wrapper function that has the _activityName property
          const wrapped = (...args: unknown[]) => original(...args)
          // We attach a hidden property to track the activity name for executeActivity
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(wrapped as any)._activityName = prop
          return wrapped
        }
        return original
      }
      return Reflect.get(target, prop)
    },
  })
}

function getLogger(): LocalLogger | Console {
  return globalObj.__localLogger || console
}

/**
 * Execute an activity on a specific task queue. In DBOS context, executes as a checkpointed step.
 * @param queue The task queue to run the activity on
 * @param activityFunc The proxy function obtained from `getActivities()`
 * @param args The arguments to pass to the activity
 */
// Overload signature for untyped or generic activity callbacks.
export async function executeActivity(
  queue: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activityFunc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any>
export async function executeActivity<TArgs extends unknown[], TRet>(
  queue: string,
  activityFunc: (...args: TArgs) => Promise<TRet>,
  ...args: TArgs
): Promise<TRet>
// Implementation signature for executeActivity.
export async function executeActivity(
  queue: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activityFunc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // We extract the hidden _activityName property attached by getActivities()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activityName = (activityFunc as any)._activityName
  if (!activityName) {
    throw new Error(
      'executeActivity must be called with an activity function obtained from getActivities()',
    )
  }

  const logger = getLogger()
  logger.debug({ queue, activityName }, `Executing activity ${activityName} on queue ${queue}`)

  try {
    // result holds the untyped return value from the dynamic activity proxy, so we type it as any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any
    if (DBOS.isWithinWorkflow()) {
      try {
        result = await DBOS.runStep(() => activityFunc(...args), {
          name: activityName,
          retriesAllowed: true,
          maxAttempts: 5,
          intervalSeconds: process.env.NODE_ENV === 'test' ? 1 : 10,
          backoffRate: 2,
          // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS StepOptions property name
          timeoutMS: 120 * 60 * 1000,
          shouldRetry: (err) => !isNonRetryableError(err),
        })
      } catch (stepErr) {
        if (
          stepErr instanceof Error &&
          stepErr.name === 'DBOSWorkflowCancelledError' &&
          CLEANUP_OR_FINALIZE_ACTIVITIES.has(activityName)
        ) {
          result = await activityFunc(...args)
        } else {
          throw stepErr
        }
      }
    } else {
      result = await activityFunc(...args)
    }
    logger.debug(
      { queue, activityName },
      `Activity ${activityName} completed successfully on queue ${queue}`,
    )
    return result
  } catch (err) {
    logger.error(
      { queue, activityName, err },
      `Activity ${activityName} failed on queue ${queue}: ${err instanceof Error ? err.message : String(err)}`,
    )
    throw err
  }
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
