-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN     "asset_id" TEXT,
ADD COLUMN     "user_comment_id" TEXT;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
