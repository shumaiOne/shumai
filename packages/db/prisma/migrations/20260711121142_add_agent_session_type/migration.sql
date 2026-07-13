-- CreateEnum
CREATE TYPE "AgentSessionType" AS ENUM ('comment', 'chat');

-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN     "type" "AgentSessionType" NOT NULL DEFAULT 'comment';

-- CreateIndex
CREATE INDEX "agent_sessions_type_idx" ON "agent_sessions"("type");
