/*
  Warnings:

  - You are about to drop the column `bot_id` on the `asset_comments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "asset_comments" DROP COLUMN "bot_id",
ADD COLUMN     "agent_id" TEXT;
