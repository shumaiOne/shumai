-- AlterTable
ALTER TABLE "asset_comments" ADD COLUMN     "completion_last_changed_by_id" TEXT,
ADD COLUMN     "is_completed" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "asset_comments" ADD CONSTRAINT "asset_comments_completion_last_changed_by_id_fkey" FOREIGN KEY ("completion_last_changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
