import { logger } from '../logger'

export class KanbanDispatcher {
  /**
   * Post-commit nudge to signal that an agentic task may be ready for execution.
   * In Phase 1, this is a stub that logs the event.
   * In Phase 2, this will trigger the CAS claim loop and Temporal workflow.
   */
  nudge(taskId?: string): void {
    logger.debug({ taskId }, 'KanbanDispatcher nudge called (Phase 1 stub)')
  }
}

export const kanbanDispatcher = new KanbanDispatcher()
