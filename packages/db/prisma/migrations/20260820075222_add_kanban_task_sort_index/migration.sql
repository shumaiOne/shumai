-- AlterTable
ALTER TABLE "kanban_tasks" ADD COLUMN     "sort_index" TEXT COLLATE "C";

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_status_sort_index_idx" ON "kanban_tasks"("team_id", "status", "sort_index" COLLATE "C");

-- CreateIndex
CREATE INDEX "kanban_tasks_sort_index_idx" ON "kanban_tasks"("sort_index" COLLATE "C");
