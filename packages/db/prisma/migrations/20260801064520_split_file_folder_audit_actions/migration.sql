-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'file_create';
ALTER TYPE "AuditAction" ADD VALUE 'file_update';
ALTER TYPE "AuditAction" ADD VALUE 'file_delete';
ALTER TYPE "AuditAction" ADD VALUE 'folder_create';
ALTER TYPE "AuditAction" ADD VALUE 'folder_update';
ALTER TYPE "AuditAction" ADD VALUE 'folder_delete';
