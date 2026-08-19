import { Hono } from 'hono'
import type { Prisma } from '@shumai/db'
import goalsRoute from './goals'
import tasksRoute from './tasks'
import linksRoute from './links'
import commentsRoute from './comments'

type User = Prisma.UserGetPayload<Record<string, never>>

const kanbanRoute = new Hono<{ Variables: { user: User } }>()
  .route('/', goalsRoute)
  .route('/', tasksRoute)
  .route('/', linksRoute)
  .route('/', commentsRoute)

export default kanbanRoute
