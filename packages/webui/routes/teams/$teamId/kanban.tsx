import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const kanbanSearchSchema = z.object({
  taskId: z.string().optional(),
})

export const Route = createFileRoute('/teams/$teamId/kanban')({
  validateSearch: (search) => kanbanSearchSchema.parse(search),
})
