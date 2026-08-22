/*
  Warnings:

  - The values [CANCELLED] on the enum `KanbanTaskEventType` will be removed. If these variants are still used in the database, this will fail.
  - The values [CANCELLED] on the enum `KanbanTaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "KanbanTaskEventType_new" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'COMMENTED', 'CHANGES_REQUESTED', 'BLOCKED', 'UNBLOCKED', 'PRIORITY_CHANGED', 'GOAL_CHANGED', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED');
ALTER TABLE "kanban_task_events" ALTER COLUMN "type" TYPE "KanbanTaskEventType_new" USING ("type"::text::"KanbanTaskEventType_new");
ALTER TYPE "KanbanTaskEventType" RENAME TO "KanbanTaskEventType_old";
ALTER TYPE "KanbanTaskEventType_new" RENAME TO "KanbanTaskEventType";
DROP TYPE "public"."KanbanTaskEventType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "KanbanTaskStatus_new" AS ENUM ('TODO', 'READY', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE');
ALTER TABLE "public"."kanban_tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "kanban_tasks" ALTER COLUMN "status" TYPE "KanbanTaskStatus_new" USING ("status"::text::"KanbanTaskStatus_new");
ALTER TABLE "kanban_task_events" ALTER COLUMN "from_status" TYPE "KanbanTaskStatus_new" USING ("from_status"::text::"KanbanTaskStatus_new");
ALTER TABLE "kanban_task_events" ALTER COLUMN "to_status" TYPE "KanbanTaskStatus_new" USING ("to_status"::text::"KanbanTaskStatus_new");
ALTER TYPE "KanbanTaskStatus" RENAME TO "KanbanTaskStatus_old";
ALTER TYPE "KanbanTaskStatus_new" RENAME TO "KanbanTaskStatus";
DROP TYPE "public"."KanbanTaskStatus_old";
ALTER TABLE "kanban_tasks" ALTER COLUMN "status" SET DEFAULT 'TODO';
COMMIT;
