import * as transcodeActivities from '@/transcode/activities/transcode'
import * as dbActivities from './db'
import * as taskActivities from './task'

export const activities = {
  ...taskActivities,
  ...transcodeActivities,
  ...dbActivities,
}
