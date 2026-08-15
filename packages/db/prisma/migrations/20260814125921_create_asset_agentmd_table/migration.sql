/*
  Warnings:

  - You are about to drop the column `agentmd` on the `assets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "assets" DROP COLUMN "agentmd";

-- CreateTable
CREATE TABLE "asset_agentmd" (
    "asset_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_agentmd_pkey" PRIMARY KEY ("asset_id")
);

-- AddForeignKey
ALTER TABLE "asset_agentmd" ADD CONSTRAINT "asset_agentmd_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
