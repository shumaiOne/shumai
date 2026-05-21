/*
  Warnings:

  - Added the required column `team_id` to the `agents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "team_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
