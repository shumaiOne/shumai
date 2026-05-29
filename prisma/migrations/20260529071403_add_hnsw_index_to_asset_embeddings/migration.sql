-- Enable iterative index scans for HNSW so filtered queries don't fall back to seq scan.
-- Uses current_database() so this works across all environments without hardcoding the DB name.
-- ALTER DATABASE ... SET persists the GUC for all future connections to this database.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET hnsw.iterative_scan = ''relaxed_order''', current_database());
END;
$$;

-- CreateIndex: HNSW index on asset_embeddings.embedding
-- Uses cosine distance ops (suited for normalized OpenAI-style embeddings)
-- m=16: controls graph connectivity (higher = better recall, more memory)
-- ef_construction=64: build-time search width (higher = better quality, slower build)
CREATE INDEX "AssetEmbedding_embedding_idx"
  ON "asset_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
