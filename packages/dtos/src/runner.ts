import { z } from 'zod'

export const runnerStatusSchema = z.enum(['connected', 'disconnected'])
export type RunnerStatus = z.infer<typeof runnerStatusSchema>

export const runnerInfoSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  keyPrefix: z.string(),
  isDefault: z.boolean(),
  status: runnerStatusSchema,
  lastConnectedAt: z.union([z.string(), z.date()]).nullable().optional(),
  lastDisconnectedAt: z.union([z.string(), z.date()]).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})
export type RunnerInfo = z.infer<typeof runnerInfoSchema>

export const createRunnerRequestSchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(256).optional(),
  isDefault: z.boolean().optional(),
})
export type CreateRunnerRequest = z.infer<typeof createRunnerRequestSchema>

export const createRunnerResponseSchema = z.object({
  runner: runnerInfoSchema,
  key: z.string(),
})
export type CreateRunnerResponse = z.infer<typeof createRunnerResponseSchema>

export const updateRunnerRequestSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(256).nullable().optional(),
  isDefault: z.boolean().optional(),
})
export type UpdateRunnerRequest = z.infer<typeof updateRunnerRequestSchema>

export const rotateRunnerKeyResponseSchema = z.object({
  runner: runnerInfoSchema,
  key: z.string(),
})
export type RotateRunnerKeyResponse = z.infer<typeof rotateRunnerKeyResponseSchema>

// ----------------------------------------------------------------------
// WebSocket Wire Protocol Schemas
// ----------------------------------------------------------------------

export const runnerWelcomeMessageSchema = z.object({
  type: z.literal('welcome'),
  runnerId: z.string(),
  runnerName: z.string(),
  serverTime: z.number(),
  inFlightExecutionIds: z.array(z.string()),
})
export type RunnerWelcomeMessage = z.infer<typeof runnerWelcomeMessageSchema>

export const runnerExecStartMessageSchema = z.object({
  type: z.literal('exec.start'),
  executionId: z.string(),
  command: z.string(),
  timeoutSec: z.number().optional(),
  env: z.record(z.string(), z.string()).optional(),
})
export type RunnerExecStartMessage = z.infer<typeof runnerExecStartMessageSchema>

export const runnerExecCancelMessageSchema = z.object({
  type: z.literal('exec.cancel'),
  executionId: z.string(),
})
export type RunnerExecCancelMessage = z.infer<typeof runnerExecCancelMessageSchema>

export const runnerFileDownloadMessageSchema = z.object({
  type: z.literal('file.download'),
  executionId: z.string(),
  url: z.string(),
  destPath: z.string(),
  extractZip: z.boolean().optional(),
  expectedHash: z.string().optional(),
})
export type RunnerFileDownloadMessage = z.infer<typeof runnerFileDownloadMessageSchema>

export const runnerFileUploadMessageSchema = z.object({
  type: z.literal('file.upload'),
  executionId: z.string(),
  srcPath: z.string(),
  url: z.string(),
  contentType: z.string().optional(),
})
export type RunnerFileUploadMessage = z.infer<typeof runnerFileUploadMessageSchema>

export const runnerFileStatMessageSchema = z.object({
  type: z.literal('file.stat'),
  executionId: z.string(),
  srcPath: z.string(),
})
export type RunnerFileStatMessage = z.infer<typeof runnerFileStatMessageSchema>

export const runnerPingMessageSchema = z.object({
  type: z.literal('ping'),
  ts: z.number(),
})
export type RunnerPingMessage = z.infer<typeof runnerPingMessageSchema>

export const serverToRunnerMessageSchema = z.discriminatedUnion('type', [
  runnerWelcomeMessageSchema,
  runnerExecStartMessageSchema,
  runnerExecCancelMessageSchema,
  runnerFileDownloadMessageSchema,
  runnerFileUploadMessageSchema,
  runnerFileStatMessageSchema,
  runnerPingMessageSchema,
])
export type ServerToRunnerMessage = z.infer<typeof serverToRunnerMessageSchema>

export const runnerExecOutputMessageSchema = z.object({
  type: z.literal('exec.output'),
  executionId: z.string(),
  stream: z.enum(['stdout', 'stderr']),
  data: z.string(),
  offset: z.number().int().nonnegative(),
})
export type RunnerExecOutputMessage = z.infer<typeof runnerExecOutputMessageSchema>

export const runnerExecResultMessageSchema = z.object({
  type: z.literal('exec.result'),
  executionId: z.string(),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  timedOut: z.boolean(),
  aborted: z.boolean().optional(),
  fullOutputPath: z.string().optional(),
  error: z.string().optional(),
})
export type RunnerExecResultMessage = z.infer<typeof runnerExecResultMessageSchema>

export const runnerReconcileMessageSchema = z.object({
  type: z.literal('reconcile'),
  activeExecutions: z.array(
    z.object({
      executionId: z.string(),
      nextOffset: z.number().int().nonnegative(),
    }),
  ),
  completedExecutions: z.array(runnerExecResultMessageSchema),
})
export type RunnerReconcileMessage = z.infer<typeof runnerReconcileMessageSchema>

export const runnerFileDownloadResultMessageSchema = z.object({
  type: z.literal('file.download.result'),
  executionId: z.string(),
  ok: z.boolean(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  cached: z.boolean().optional(),
  error: z.string().optional(),
})
export type RunnerFileDownloadResultMessage = z.infer<typeof runnerFileDownloadResultMessageSchema>

export const runnerFileUploadResultMessageSchema = z.object({
  type: z.literal('file.upload.result'),
  executionId: z.string(),
  ok: z.boolean(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  name: z.string().optional(),
  error: z.string().optional(),
})
export type RunnerFileUploadResultMessage = z.infer<typeof runnerFileUploadResultMessageSchema>

export const runnerFileStatResultMessageSchema = z.object({
  type: z.literal('file.stat.result'),
  executionId: z.string(),
  ok: z.boolean(),
  exists: z.boolean(),
  isFile: z.boolean().optional(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  name: z.string().optional(),
  error: z.string().optional(),
})
export type RunnerFileStatResultMessage = z.infer<typeof runnerFileStatResultMessageSchema>

export const runnerPongMessageSchema = z.object({
  type: z.literal('pong'),
  ts: z.number(),
})
export type RunnerPongMessage = z.infer<typeof runnerPongMessageSchema>

export const runnerToServerMessageSchema = z.discriminatedUnion('type', [
  runnerReconcileMessageSchema,
  runnerExecOutputMessageSchema,
  runnerExecResultMessageSchema,
  runnerFileDownloadResultMessageSchema,
  runnerFileUploadResultMessageSchema,
  runnerFileStatResultMessageSchema,
  runnerPongMessageSchema,
])
export type RunnerToServerMessage = z.infer<typeof runnerToServerMessageSchema>
