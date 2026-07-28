-- AlterTable
ALTER TABLE "agent_session_entries" ADD COLUMN     "asset_id" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "data" JSONB,
ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "type" TEXT,
ALTER COLUMN "session_id" DROP NOT NULL,
ALTER COLUMN "entry" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "agent_session_entries_parent_id_idx" ON "agent_session_entries"("parent_id");

-- CreateIndex
CREATE INDEX "agent_session_entries_asset_id_idx" ON "agent_session_entries"("asset_id");
