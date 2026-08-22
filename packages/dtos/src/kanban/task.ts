import { z } from 'zod'
import { KanbanTaskStatus, KanbanTaskPriority, KanbanTaskEventType } from '@shumai/db/enums'
import { paginationPageInfoSchema, paginationParamsSchema } from '../pagination'
import { kanbanUserInfoSchema, kanbanEventInfoSchema } from './event'
import { kanbanCommentInfoSchema } from './comment'

export { KanbanTaskStatus, KanbanTaskPriority, KanbanTaskEventType }

export const createKanbanTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  isAgentTask: z.boolean().optional(),
  priority: z.nativeEnum(KanbanTaskPriority).optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  goalId: z.string().optional(),
  projectId: z.string().optional(),
  reporterId: z.string().optional(),
  assigneeId: z.string().optional(),
  targetFolderId: z.string().optional(),
  parentIds: z.array(z.string()).optional(),
  assetIds: z.array(z.string()).optional(),
})
export type CreateKanbanTaskRequest = z.infer<typeof createKanbanTaskSchema>

export const updateKanbanTaskSchema = z.object({
  fromStatus: z.nativeEnum(KanbanTaskStatus).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
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
  beforeIndex: z.string().optional(),
  afterIndex: z.string().optional(),
  parentIds: z.array(z.string()).optional(),
  assetIds: z.array(z.string()).optional(),
})
export type UpdateKanbanTaskRequest = z.infer<typeof updateKanbanTaskSchema>

export const listKanbanTasksRequestSchema = z
  .object({
    status: z.nativeEnum(KanbanTaskStatus).optional(),
    isAgentTask: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === 'true')
      .optional(),
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

export const kanbanTaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  isAgentTask: z.boolean(),
  status: z.nativeEnum(KanbanTaskStatus),
  priority: z.nativeEnum(KanbanTaskPriority),
  sortIndex: z.string().nullable().optional(),
})
export type KanbanTaskSummary = z.infer<typeof kanbanTaskSummarySchema>

export const kanbanTaskAssetInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  proxyType: z.enum(['image', 'video', 'audio', 'pdf']).nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  path: z.string(),
  creator: kanbanUserInfoSchema.nullable().optional(),
  sizeByte: z.number().optional(),
  fileCount: z.number().optional(),
  projectId: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
})
export type KanbanTaskAssetInfo = z.infer<typeof kanbanTaskAssetInfoSchema>

export const kanbanTaskInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  isAgentTask: z.boolean(),
  status: z.nativeEnum(KanbanTaskStatus),
  priority: z.nativeEnum(KanbanTaskPriority),
  startDate: z.union([z.string(), z.date()]).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).nullable().optional(),
  startedAt: z.union([z.string(), z.date()]).nullable().optional(),
  completedAt: z.union([z.string(), z.date()]).nullable().optional(),
  teamId: z.string(),
  projectId: z.string().nullable().optional(),
  sortIndex: z.string().nullable().optional(),
  creator: kanbanUserInfoSchema,
  reporter: kanbanUserInfoSchema.nullable().optional(),
  assignee: kanbanUserInfoSchema.nullable().optional(),
  goal: kanbanTaskGoalSummarySchema.nullable().optional(),
  targetFolderId: z.string().nullable().optional(),
  latestStatusEvent: kanbanStatusEventInfoSchema.nullable().optional(),
  commentCount: z.number().default(0),
  dependencyCount: z.number().default(0),
  dependentCount: z.number().default(0),
  assetCount: z.number().default(0),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})
export type KanbanTaskInfo = z.infer<typeof kanbanTaskInfoSchema>

export const kanbanTaskDetailSchema = kanbanTaskInfoSchema.extend({
  dependencies: z.array(kanbanTaskSummarySchema),
  dependents: z.array(kanbanTaskSummarySchema),
  assets: z.array(kanbanTaskAssetInfoSchema),
  comments: z.array(kanbanCommentInfoSchema),
  events: z.array(kanbanEventInfoSchema),
})
export type KanbanTaskDetail = z.infer<typeof kanbanTaskDetailSchema>

export const listKanbanTasksResponseSchema = z.object({
  data: z.array(kanbanTaskInfoSchema),
  pageInfo: paginationPageInfoSchema,
})
export type ListKanbanTasksResponse = z.infer<typeof listKanbanTasksResponseSchema>

export const linkAssetToTaskSchema = z.object({
  taskId: z.string(),
})
export type LinkAssetToTaskRequest = z.infer<typeof linkAssetToTaskSchema>

export const linkTaskAssetsSchema = z.object({
  assetIds: z.array(z.string()),
})
export type LinkTaskAssetsRequest = z.infer<typeof linkTaskAssetsSchema>

export const listAssetTasksResponseSchema = z.object({
  data: z.array(kanbanTaskInfoSchema),
  total: z.number(),
})
export type ListAssetTasksResponse = z.infer<typeof listAssetTasksResponseSchema>
