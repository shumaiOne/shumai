/*
  Warnings:

  - You are about to drop the column `is_ai` on the `asset_comments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "asset_comments" DROP COLUMN "is_ai",
ADD COLUMN     "session_id" TEXT;

-- AddForeignKey
ALTER TABLE "asset_comments" ADD CONSTRAINT "asset_comments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
