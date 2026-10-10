ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "content_hash" TEXT;
CREATE INDEX IF NOT EXISTS "assets_project_id_content_hash_idx" ON "assets"("project_id", "content_hash");
