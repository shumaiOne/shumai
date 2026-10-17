import { WorkflowTask } from '@shumai/db'
import * as taskActivities from './activities/task'
import { logger } from '@shumai/core/src/logger'

export type WorkflowFn = (task: WorkflowTask) => Promise<void>

const workflowRegistry = new Map<string, WorkflowFn>()
const activityRegistry: Record<string, unknown> = { ...taskActivities }

export function registerWorkflow(type: string, fn: WorkflowFn): void {
  workflowRegistry.set(type, fn)
}

export function getRegisteredWorkflows(): Map<string, WorkflowFn> {
  return workflowRegistry
}

/* eslint-disable @typescript-eslint/naming-convention */
const globalObj = globalThis as typeof globalThis & {
  __localActivities?: Record<string, unknown>
  __localLogger?: unknown
}
/* eslint-enable @typescript-eslint/naming-convention */

export function registerActivities(acts: Record<string, unknown>): void {
  Object.assign(activityRegistry, acts)
  globalObj.__localActivities = activityRegistry
}

export function getActivityRegistry(): Record<string, unknown> {
  return activityRegistry
}

// Inject dependencies into global scope for workflow-utils
globalObj.__localActivities = activityRegistry
globalObj.__localLogger = logger
