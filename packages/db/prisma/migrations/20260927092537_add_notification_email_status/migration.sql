-- CreateEnum
CREATE TYPE "NotificationEmailStatus" AS ENUM ('pending', 'processing', 'processed', 'failed');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "email_status" "NotificationEmailStatus" NOT NULL DEFAULT 'pending';

-- Update legacy rows to processed
UPDATE "notifications" SET "email_status" = 'processed';

-- CreateIndex
CREATE INDEX "notifications_email_status_created_at_idx" ON "notifications"("email_status", "created_at");
