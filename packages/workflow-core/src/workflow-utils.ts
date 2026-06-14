// Use type-only imports for activities to avoid bundling them in Temporal workflows
import * as wf from '@temporalio/workflow'

/**
 * Task queue constants.
 */
export const TaskQueueAgent = 'agent_queue'
export const TaskQueueTranscode = 'transcode_queue'

/**
 * Detects if the current execution is within a Temporal Workflow isolate.
 */
export function isTemporal(): boolean {
  try {
    // In Temporal TS SDK, workflowInfo() throws if called outside of a workflow context.
    wf.workflowInfo()
    return true
  } catch {
    return false
  }
}

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

/**
 * A proxy that mimics proxyActivities for local execution.
 */
function localActivitiesProxy(): Record<string, unknown> {
  const acts = globalObj.__localActivities
  if (!acts) {
    throw new Error('Local activities not injected into globalThis.__localActivities')
  }
  return acts
}

/**
 * Environment-aware sleep function.
 */
export async function sleep(ms: number): Promise<void> {
  if (isTemporal()) {
    await wf.sleep(ms)
  } else {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Environment-aware activity proxy.
 */
// getActivities must default to `any` so that workflows can dynamically
// destructure and call any activity when they do not supply a precise type parameter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getActivities<T = any>(): T {
  // baseProxy is dynamically proxying all activities, so we must type it as any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baseProxy: any
  if (isTemporal()) {
    // Temporal's proxyActivities requires a type parameter, so we use any for generic activities.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    baseProxy = wf.proxyActivities<any>({
      startToCloseTimeout: '10 minutes',
      retry: {
        maximumAttempts: 5,
        initialInterval: '10s',
      },
    })
  } else {
    baseProxy = localActivitiesProxy()
  }

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

/**
 * Environment-aware logger for workflows and activities.
 */
function getLogger() {
  if (isTemporal()) {
    return {
      debug: (obj: Record<string, unknown>, msg: string) => wf.log.debug(msg, obj),
      info: (obj: Record<string, unknown>, msg: string) => wf.log.info(msg, obj),
      error: (obj: Record<string, unknown>, msg: string) => wf.log.error(msg, obj),
      warn: (obj: Record<string, unknown>, msg: string) => wf.log.warn(msg, obj),
    }
  }
  return globalObj.__localLogger || console
}

/**
 * Execute an activity on a specific task queue.
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
    if (isTemporal()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = wf.proxyActivities<any>({
        startToCloseTimeout: '10 minutes',
        taskQueue: queue,
        retry: {
          maximumAttempts: 5,
          initialInterval: '10s',
        },
      })
      result = await handle[activityName](...args)
    } else {
      // For local execution, queue is ignored and we just execute the function
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
