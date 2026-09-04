-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "agent_id" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "agent_id" TEXT;

-- CreateIndex
CREATE INDEX "assets_agent_id_idx" ON "assets"("agent_id");

-- CreateIndex
CREATE INDEX "audit_logs_agent_id_idx" ON "audit_logs"("agent_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
