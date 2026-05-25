/*
  Warnings:

  - The values [purging] on the enum `AssetStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "StorageKeyStatus" AS ENUM ('active', 'purging');

-- AlterEnum
BEGIN;
CREATE TYPE "AssetStatus_new" AS ENUM ('uploading', 'uploaded', 'processing', 'processed', 'trashed', 'pending_purge');
ALTER TABLE "assets" ALTER COLUMN "status" TYPE "AssetStatus_new" USING ("status"::text::"AssetStatus_new");
ALTER TYPE "AssetStatus" RENAME TO "AssetStatus_old";
ALTER TYPE "AssetStatus_new" RENAME TO "AssetStatus";
DROP TYPE "public"."AssetStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "storage_keys" ADD COLUMN     "status" "StorageKeyStatus" NOT NULL DEFAULT 'active';
