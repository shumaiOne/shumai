/*
  Warnings:

  - You are about to drop the `sandboxes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sandboxes" DROP CONSTRAINT "sandboxes_team_id_fkey";

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "runner_id" TEXT;

-- DropTable
DROP TABLE "sandboxes";

-- CreateTable
CREATE TABLE "runners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_connected_at" TIMESTAMP(3),
    "last_disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "team_id" TEXT NOT NULL,

    CONSTRAINT "runners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "runners_key_hash_key" ON "runners"("key_hash");

-- CreateIndex
CREATE INDEX "runners_team_id_idx" ON "runners"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "runners_team_id_name_key" ON "runners"("team_id", "name");

-- AddForeignKey
ALTER TABLE "runners" ADD CONSTRAINT "runners_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "runners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
