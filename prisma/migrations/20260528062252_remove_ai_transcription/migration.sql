/*
  Warnings:

  - The values [transcription] on the enum `AgentType` will be removed. If these variants are still used in the database, this will fail.
  - The values [ai_transcription] on the enum `WorkflowTaskType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AgentType_new" AS ENUM ('chat', 'autofill', 'embedding');
ALTER TABLE "agents" ALTER COLUMN "type" TYPE "AgentType_new" USING ("type"::text::"AgentType_new");
ALTER TYPE "AgentType" RENAME TO "AgentType_old";
ALTER TYPE "AgentType_new" RENAME TO "AgentType";
DROP TYPE "public"."AgentType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "WorkflowTaskType_new" AS ENUM ('transcode', 'ai_metadata_autofill', 'chat', 'ai_embedding');
ALTER TABLE "workflow_tasks" ALTER COLUMN "type" TYPE "WorkflowTaskType_new" USING ("type"::text::"WorkflowTaskType_new");
ALTER TYPE "WorkflowTaskType" RENAME TO "WorkflowTaskType_old";
ALTER TYPE "WorkflowTaskType_new" RENAME TO "WorkflowTaskType";
DROP TYPE "public"."WorkflowTaskType_old";
COMMIT;
