// Use type-only imports for activities to avoid bundling them in Temporal workflows
import type { activities } from './activities/index'
import * as wf from '@temporalio/workflow'

/**
 * Task queue constants.
 */
export const TaskQueueDb = 'db_queue'
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

/**
 * A proxy that mimics proxyActivities for local execution.
 */
function localActivitiesProxy(): typeof activities {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acts = (globalThis as any).__localActivities
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
export function getActivities(): typeof activities {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baseProxy: any
  if (isTemporal()) {
    baseProxy = wf.proxyActivities<typeof activities>({
      startToCloseTimeout: '10 minutes',
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__localLogger || console
}

/**
 * Execute an activity on a specific task queue.
 * @param queue The task queue to run the activity on
 * @param activityFunc The proxy function obtained from `getActivities()`
 * @param args The arguments to pass to the activity
 */
export async function executeActivity<TArgs extends unknown[], TRet>(
  queue: string,
  activityFunc: (...args: TArgs) => Promise<TRet>,
  ...args: TArgs
): Promise<TRet> {
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
    let result: TRet
    if (isTemporal()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = wf.proxyActivities<any>({
        startToCloseTimeout: '10 minutes',
        taskQueue: queue,
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
