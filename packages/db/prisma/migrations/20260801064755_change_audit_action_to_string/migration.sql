-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE TEXT USING "action"::text;

-- DropEnum
DROP TYPE "AuditAction";
