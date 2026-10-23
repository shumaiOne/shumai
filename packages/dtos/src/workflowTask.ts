import { z } from 'zod'
import { WorkflowTaskType, WorkflowTaskStatus } from '@shumai/db/enums'

export { WorkflowTaskType, WorkflowTaskStatus }

export const workflowTaskTypeSchema = z.nativeEnum(WorkflowTaskType)
export type WorkflowTaskTypeEnum = z.infer<typeof workflowTaskTypeSchema>

export const workflowTaskStatusSchema = z.nativeEnum(WorkflowTaskStatus)
export type WorkflowTaskStatusEnum = z.infer<typeof workflowTaskStatusSchema>

export const workflowTaskItemSchema = z.object({
  id: z.string(),
  uid: z.string(),
  teamId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  assetId: z.string(),
  fileName: z.string().nullable().optional(),
  fileSize: z.number().nullable().optional(),
  type: z.nativeEnum(WorkflowTaskType).nullable().optional(),
  status: z.nativeEnum(WorkflowTaskStatus).nullable().optional(),
  payload: z.unknown().optional(),
  output: z.unknown().optional(),
  heartbeat: z.string().nullable().optional(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  model: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type WorkflowTaskItem = z.infer<typeof workflowTaskItemSchema>

export const listWorkflowTasksQuerySchema = z.object({
  first: z.coerce.number().optional(),
  after: z.string().optional(),
  status: z
    .union([z.nativeEnum(WorkflowTaskStatus), z.array(z.nativeEnum(WorkflowTaskStatus))])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
  types: z
    .union([z.nativeEnum(WorkflowTaskType), z.array(z.nativeEnum(WorkflowTaskType))])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
})

export type ListWorkflowTasksQuery = z.infer<typeof listWorkflowTasksQuerySchema>

export const listWorkflowTasksResponseSchema = z.object({
  nodes: z.array(workflowTaskItemSchema),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().nullable(),
  }),
  total: z.number(),
})

export type ListWorkflowTasksResponse = z.infer<typeof listWorkflowTasksResponseSchema>

export const batchWorkflowTaskStatusSchema = z.object({
  taskIds: z.array(z.string()).max(100),
})

export type BatchWorkflowTaskStatus = z.infer<typeof batchWorkflowTaskStatusSchema>

export const batchWorkflowTaskStatusResponseSchema = z.object({
  tasks: z.array(workflowTaskItemSchema),
})

export type BatchWorkflowTaskStatusResponse = z.infer<typeof batchWorkflowTaskStatusResponseSchema>

export const stopWorkflowTaskResponseSchema = z.object({
  success: z.boolean(),
  task: workflowTaskItemSchema,
})

export type StopWorkflowTaskResponse = z.infer<typeof stopWorkflowTaskResponseSchema>
