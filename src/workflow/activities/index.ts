import * as transcodeActivities from '@/transcode/activities/transcode'
import * as agentActivities from './agent'
import * as aiActivities from './ai'
import * as dbActivities from './db'
import * as taskActivities from './task'

export const activities = {
  ...taskActivities,
  ...aiActivities,
  ...transcodeActivities,
  ...agentActivities,
  ...dbActivities,
}
