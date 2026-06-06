-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "creator_id" TEXT;

-- AlterTable
ALTER TABLE "share_links" ADD COLUMN     "creator_id" TEXT;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
