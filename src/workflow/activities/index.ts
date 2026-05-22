import * as taskActivities from './task'
import * as aiActivities from './ai'
import * as transcodeActivities from '@/transcode/activities/transcode'
import * as agentActivities from './agent'
import * as dbActivities from './db'

export const activities = {
  ...taskActivities,
  ...aiActivities,
  ...transcodeActivities,
  ...agentActivities,
  ...dbActivities,
}
