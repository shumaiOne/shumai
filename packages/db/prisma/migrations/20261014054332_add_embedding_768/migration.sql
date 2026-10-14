-- AlterTable
ALTER TABLE "asset_embeddings" ADD COLUMN     "embedding_768" vector(768);

-- CreateIndex: HNSW index on asset_embeddings.embedding_768
CREATE INDEX "AssetEmbedding_embedding_768_idx"
  ON "asset_embeddings"
  USING hnsw (embedding_768 vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
