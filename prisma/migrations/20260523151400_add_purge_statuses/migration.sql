/*
  Warnings:

  - The values [removed] on the enum `AssetStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `removed` on the `assets` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssetStatus_new" AS ENUM ('uploading', 'uploaded', 'processing', 'processed', 'trashed', 'pending_purge', 'purging');
ALTER TABLE "assets" ALTER COLUMN "status" TYPE "AssetStatus_new" USING ("status"::text::"AssetStatus_new");
ALTER TYPE "AssetStatus" RENAME TO "AssetStatus_old";
ALTER TYPE "AssetStatus_new" RENAME TO "AssetStatus";
DROP TYPE "public"."AssetStatus_old";
COMMIT;

-- DropIndex
DROP INDEX "assets_removed_idx";

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "removed",
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "assets_is_deleted_idx" ON "assets"("is_deleted");
