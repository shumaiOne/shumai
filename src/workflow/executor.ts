import { WorkflowTask } from '@/generated/prisma/client'

export interface Executor {
  submit(task: WorkflowTask): Promise<string>
  start(): void
  close(): void
}
