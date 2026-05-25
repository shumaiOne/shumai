/*
  Warnings:

  - You are about to drop the column `key` on the `assets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "assets" DROP COLUMN "key",
ADD COLUMN     "storage_key_id" TEXT;

-- CreateTable
CREATE TABLE "storage_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_keys_key_key" ON "storage_keys"("key");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_storage_key_id_fkey" FOREIGN KEY ("storage_key_id") REFERENCES "storage_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
