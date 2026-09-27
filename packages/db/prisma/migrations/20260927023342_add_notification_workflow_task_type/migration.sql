-- AlterEnum
ALTER TYPE "WorkflowTaskType" ADD VALUE 'notification';

-- AlterTable
ALTER TABLE "workflow_tasks" ALTER COLUMN "asset_id" SET DEFAULT '';
