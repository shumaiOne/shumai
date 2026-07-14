-- AlterTable
ALTER TABLE "workflow_tasks" ADD COLUMN     "session_id" TEXT;

-- CreateIndex
CREATE INDEX "workflow_tasks_session_id_idx" ON "workflow_tasks"("session_id");
