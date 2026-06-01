import { registerActivities } from '@shumai/workflow-core'
import * as dbActivities from './activities/db'

export function initDbWorkflows() {
  registerActivities(dbActivities)
}

export * from './activities/db'
