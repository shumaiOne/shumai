-- CreateIndex
CREATE INDEX "asset_embeddings_asset_id_idx" ON "asset_embeddings"("asset_id");

-- CreateIndex
CREATE INDEX "assets_parent_id_is_deleted_sort_index_id_idx" ON "assets"("parent_id", "is_deleted", "sort_index", "id");
