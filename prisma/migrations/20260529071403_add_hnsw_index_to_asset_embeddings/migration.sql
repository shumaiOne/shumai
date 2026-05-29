-- Enable iterative index scans for HNSW so filtered queries don't fall back to seq scan
SET hnsw.iterative_scan = relaxed_order;

-- CreateIndex: HNSW index on asset_embeddings.embedding
-- Uses cosine distance ops (suited for normalized OpenAI-style embeddings)
-- m=16: controls graph connectivity (higher = better recall, more memory)
-- ef_construction=64: build-time search width (higher = better quality, slower build)
CREATE INDEX "AssetEmbedding_embedding_idx"
  ON "asset_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
