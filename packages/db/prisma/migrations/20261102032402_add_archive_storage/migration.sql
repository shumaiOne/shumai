-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetStatus" ADD VALUE 'archiving';
ALTER TYPE "AssetStatus" ADD VALUE 'archived';
ALTER TYPE "AssetStatus" ADD VALUE 'restoring';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowTaskType" ADD VALUE 'archive_asset';
ALTER TYPE "WorkflowTaskType" ADD VALUE 'restore_asset';

-- AlterTable
ALTER TABLE "storage_keys" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;
