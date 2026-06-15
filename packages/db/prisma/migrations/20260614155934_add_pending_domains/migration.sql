-- AlterTable
ALTER TABLE "sandboxes" ADD COLUMN     "pending_domains" TEXT[] DEFAULT ARRAY[]::TEXT[];
