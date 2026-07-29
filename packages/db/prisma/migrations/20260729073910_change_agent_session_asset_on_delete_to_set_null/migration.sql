-- DropForeignKey
ALTER TABLE "agent_sessions" DROP CONSTRAINT "agent_sessions_asset_id_fkey";

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
