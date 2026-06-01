import { WorkflowTask } from '@shumai/db'

export interface Executor {
  submit(task: WorkflowTask): Promise<string>
  start(): void
  close(): void
}
