import { z } from 'zod'

export const createKanbanGoalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
})
export type CreateKanbanGoalRequest = z.infer<typeof createKanbanGoalSchema>

export const updateKanbanGoalSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})
export type UpdateKanbanGoalRequest = z.infer<typeof updateKanbanGoalSchema>

export const kanbanGoalInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  teamId: z.string(),
  creatorId: z.string().nullable().optional(),
  taskCount: z.number().optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})
export type KanbanGoalInfo = z.infer<typeof kanbanGoalInfoSchema>

export const listKanbanGoalsRequestSchema = z.object({
  // Filter or search params can be added here
})
export type ListKanbanGoalsRequest = z.infer<typeof listKanbanGoalsRequestSchema>

export const listKanbanGoalsResponseSchema = z.object({
  data: z.array(kanbanGoalInfoSchema),
})
export type ListKanbanGoalsResponse = z.infer<typeof listKanbanGoalsResponseSchema>
