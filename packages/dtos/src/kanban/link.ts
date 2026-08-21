import { z } from 'zod'

export const createKanbanLinkSchema = z.object({
  parentId: z.string(),
})
export type CreateKanbanLinkRequest = z.infer<typeof createKanbanLinkSchema>

export const setKanbanDependenciesSchema = z.object({
  parentIds: z.array(z.string()),
})
export type SetKanbanDependenciesRequest = z.infer<typeof setKanbanDependenciesSchema>

export const kanbanLinkInfoSchema = z.object({
  parentId: z.string(),
  childId: z.string(),
  createdAt: z.union([z.string(), z.date()]),
})
export type KanbanLinkInfo = z.infer<typeof kanbanLinkInfoSchema>
