-- CreateTable
CREATE TABLE "recent_file_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_file_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recent_file_items_user_id_project_id_viewed_at_idx" ON "recent_file_items"("user_id", "project_id", "viewed_at" DESC);

-- CreateIndex
CREATE INDEX "recent_file_items_asset_id_idx" ON "recent_file_items"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "recent_file_items_user_id_project_id_asset_id_key" ON "recent_file_items"("user_id", "project_id", "asset_id");

-- AddForeignKey
ALTER TABLE "recent_file_items" ADD CONSTRAINT "recent_file_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_file_items" ADD CONSTRAINT "recent_file_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_file_items" ADD CONSTRAINT "recent_file_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
