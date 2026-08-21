-- AlterTable: Change sort_index column collation to "C" on kanban_tasks
ALTER TABLE "kanban_tasks" ALTER COLUMN "sort_index" TYPE TEXT COLLATE "C";

-- Recreate index on sort_index with "C" collation
DROP INDEX IF EXISTS "kanban_tasks_sort_index_idx";
CREATE INDEX "kanban_tasks_sort_index_idx" ON "kanban_tasks" ("sort_index" COLLATE "C");

-- Recreate compound index with "C" collation
DROP INDEX IF EXISTS "kanban_tasks_team_id_status_sort_index_idx";
CREATE INDEX "kanban_tasks_team_id_status_sort_index_idx" ON "kanban_tasks" ("team_id", "status", "sort_index" COLLATE "C");
