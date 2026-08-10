/*
  Warnings:

  - You are about to drop the column `enabled` on the `mcp_servers` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "mcp_servers_team_id_name_key";

-- AlterTable
ALTER TABLE "mcp_servers" DROP COLUMN "enabled",
ADD COLUMN     "description" TEXT;
