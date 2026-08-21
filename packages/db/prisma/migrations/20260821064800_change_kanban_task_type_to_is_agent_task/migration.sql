-- AlterTable
ALTER TABLE "kanban_tasks" ADD COLUMN "is_agent_task" BOOLEAN NOT NULL DEFAULT false;

-- Backfill
UPDATE "kanban_tasks" SET "is_agent_task" = true WHERE "type" = 'AGENTIC';

-- DropIndex
DROP INDEX "kanban_tasks_team_id_type_status_idx";

-- AlterTable
ALTER TABLE "kanban_tasks" DROP COLUMN "type";

-- DropEnum
DROP TYPE "KanbanTaskType";

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_is_agent_task_status_idx" ON "kanban_tasks"("team_id", "is_agent_task", "status");
