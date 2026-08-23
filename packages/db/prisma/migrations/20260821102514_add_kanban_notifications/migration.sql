-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'kanban_task_created';
ALTER TYPE "NotificationType" ADD VALUE 'kanban_task_assigned';
ALTER TYPE "NotificationType" ADD VALUE 'kanban_task_status_updated';
ALTER TYPE "NotificationType" ADD VALUE 'kanban_task_updated';
ALTER TYPE "NotificationType" ADD VALUE 'kanban_task_deleted';
ALTER TYPE "NotificationType" ADD VALUE 'kanban_task_comment_created';

-- AlterEnum
ALTER TYPE "WorkflowTaskType" ADD VALUE 'kanban_agent_run';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "kanban_task_id" TEXT;

-- CreateIndex
CREATE INDEX "notifications_kanban_task_id_idx" ON "notifications"("kanban_task_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kanban_task_id_fkey" FOREIGN KEY ("kanban_task_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
