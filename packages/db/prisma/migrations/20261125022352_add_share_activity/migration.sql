-- CreateEnum
CREATE TYPE "ShareActivityKind" AS ENUM ('share_viewed', 'asset_viewed', 'asset_downloaded', 'comment_created');

-- AlterTable
ALTER TABLE "share_links" ADD COLUMN     "last_viewed_at" TIMESTAMP(3),
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "share_activities" (
    "id" TEXT NOT NULL,
    "share_link_id" TEXT NOT NULL,
    "kind" "ShareActivityKind" NOT NULL,
    "user_id" TEXT,
    "asset_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "share_activities_dedup_idx" ON "share_activities"("share_link_id", "kind", "user_id", "asset_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "share_activities_share_link_id_id_idx" ON "share_activities"("share_link_id", "id" DESC);

-- AddForeignKey
ALTER TABLE "share_activities" ADD CONSTRAINT "share_activities_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
