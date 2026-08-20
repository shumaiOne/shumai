import { z } from 'zod'
import {
  KanbanTaskType,
  KanbanTaskStatus,
  KanbanTaskPriority,
  KanbanTaskRunStatus,
  KanbanTaskEventType,
} from '@shumai/db/enums'
import { paginationPageInfoSchema, paginationParamsSchema } from '../pagination'
import { kanbanUserInfoSchema, kanbanEventInfoSchema } from './event'
import { kanbanCommentInfoSchema } from './comment'

export {
  KanbanTaskType,
  KanbanTaskStatus,
  KanbanTaskPriority,
  KanbanTaskRunStatus,
  KanbanTaskEventType,
}

export const createKanbanTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(KanbanTaskType).optional(),
  priority: z.nativeEnum(KanbanTaskPriority).optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  goalId: z.string().optional(),
  projectId: z.string().optional(),
  reporterId: z.string().optional(),
  assigneeId: z.string().optional(),
  targetFolderId: z.string().optional(),
  parentIds: z.array(z.string()).optional(),
})
export type CreateKanbanTaskRequest = z.infer<typeof createKanbanTaskSchema>

export const updateKanbanTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.nativeEnum(KanbanTaskType).optional(),
  status: z.nativeEnum(KanbanTaskStatus).optional(),
  reason: z.string().optional(),
  priority: z.nativeEnum(KanbanTaskPriority).optional(),
  startDate: z.union([z.string(), z.date()]).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).nullable().optional(),
  goalId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  reporterId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  targetFolderId: z.string().nullable().optional(),
})
export type UpdateKanbanTaskRequest = z.infer<typeof updateKanbanTaskSchema>

export const requestChangesSchema = z.object({
  reason: z.string().min(1),
})
export type RequestChangesRequest = z.infer<typeof requestChangesSchema>

export const listKanbanTasksRequestSchema = z
  .object({
    status: z.nativeEnum(KanbanTaskStatus).optional(),
    type: z.nativeEnum(KanbanTaskType).optional(),
    goalId: z.string().optional(),
    projectId: z.string().optional(),
    priority: z.nativeEnum(KanbanTaskPriority).optional(),
    assigneeId: z.string().optional(),
    reporterId: z.string().optional(),
  })
  .merge(paginationParamsSchema)
export type ListKanbanTasksRequest = z.infer<typeof listKanbanTasksRequestSchema>

export const kanbanStatusEventInfoSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(KanbanTaskEventType),
  actor: kanbanUserInfoSchema.nullable().optional(),
  summary: z.string().optional(),
  blockReason: z.string().optional(),
  blockKind: z.string().optional(),
  reason: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]),
})
export type KanbanStatusEventInfo = z.infer<typeof kanbanStatusEventInfoSchema>

export const kanbanTaskGoalSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
})
export type KanbanTaskGoalSummary = z.infer<typeof kanbanTaskGoalSummarySchema>

export const kanbanRunSummarySchema = z.object({
  id: z.string(),
  status: z.nativeEnum(KanbanTaskRunStatus),
  attempt: z.number(),
  summary: z.string().nullable().optional(),
  claimToken: z.string().optional(),
  startedAt: z.union([z.string(), z.date()]),
  endedAt: z.union([z.string(), z.date()]).nullable().optional(),
})
export type KanbanRunSummary = z.infer<typeof kanbanRunSummarySchema>

export const kanbanTaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.nativeEnum(KanbanTaskType),
  status: z.nativeEnum(KanbanTaskStatus),
  priority: z.nativeEnum(KanbanTaskPriority),
})
export type KanbanTaskSummary = z.infer<typeof kanbanTaskSummarySchema>

export const kanbanTaskInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  type: z.nativeEnum(KanbanTaskType),
  status: z.nativeEnum(KanbanTaskStatus),
  priority: z.nativeEnum(KanbanTaskPriority),
  startDate: z.union([z.string(), z.date()]).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).nullable().optional(),
  startedAt: z.union([z.string(), z.date()]).nullable().optional(),
  completedAt: z.union([z.string(), z.date()]).nullable().optional(),
  teamId: z.string(),
  projectId: z.string().nullable().optional(),
  creator: kanbanUserInfoSchema,
  reporter: kanbanUserInfoSchema.nullable().optional(),
  assignee: kanbanUserInfoSchema.nullable().optional(),
  goal: kanbanTaskGoalSummarySchema.nullable().optional(),
  targetFolderId: z.string().nullable().optional(),
  latestRun: kanbanRunSummarySchema.nullable().optional(),
  latestStatusEvent: kanbanStatusEventInfoSchema.nullable().optional(),
  commentCount: z.number().default(0),
  dependencyCount: z.number().default(0),
  dependentCount: z.number().default(0),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})
export type KanbanTaskInfo = z.infer<typeof kanbanTaskInfoSchema>

export const kanbanTaskDetailSchema = kanbanTaskInfoSchema.extend({
  dependencies: z.array(kanbanTaskSummarySchema),
  dependents: z.array(kanbanTaskSummarySchema),
  runs: z.array(kanbanRunSummarySchema),
  comments: z.array(kanbanCommentInfoSchema),
  events: z.array(kanbanEventInfoSchema),
})
export type KanbanTaskDetail = z.infer<typeof kanbanTaskDetailSchema>

export const listKanbanTasksResponseSchema = z.object({
  data: z.array(kanbanTaskInfoSchema),
  pageInfo: paginationPageInfoSchema,
})
export type ListKanbanTasksResponse = z.infer<typeof listKanbanTasksResponseSchema>
