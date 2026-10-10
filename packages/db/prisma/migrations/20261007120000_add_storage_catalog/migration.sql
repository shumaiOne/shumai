-- Storage catalog: queue of library changes that StorageCatalogService appends to the catalog in storage.
--
-- Changes are captured with triggers instead of calls from the services because several paths change
-- assets in bulk without going through a per-asset service method (trash/restore descendant cascades,
-- project deletion, the purge pipeline's raw SQL, version-stack symlink renames). A trigger sees every one
-- of them, inside the same transaction, so a change is queued exactly when it commits. The triggers are
-- statement-level with transition tables: a bulk update of 10,000 rows adds one INSERT ... SELECT, not
-- 10,000 trigger calls.
--
-- Queue ids: an asset id, 'project:<project id>' or 'field:<metadata field key>'. The primary key keeps one
-- row per changed object no matter how many times it changes before the next sync.

-- CreateTable
CREATE TABLE "storage_catalog_queue" (
    "id" TEXT NOT NULL,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_catalog_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storage_catalog_queue_queued_at_idx" ON "storage_catalog_queue"("queued_at");

-- CreateTable
CREATE TABLE "storage_catalog_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_seq" BIGINT NOT NULL DEFAULT 0,
    "snapshot_seq" BIGINT NOT NULL DEFAULT 0,
    "snapshot_bytes" BIGINT NOT NULL DEFAULT 0,
    "log_segments" INTEGER NOT NULL DEFAULT 0,
    "log_bytes" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_catalog_state_pkey" PRIMARY KEY ("id")
);

-- Assets: only the columns the catalog records. Size, file counts and media info change constantly during
-- uploads and transcodes and are not part of the library's structure, so they do not queue anything.
CREATE FUNCTION storage_catalog_assets_inserted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT id FROM new_rows ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_catalog_assets_updated() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id)
  SELECT n.id FROM new_rows n JOIN old_rows o ON o.id = n.id
  WHERE (n.name, n.type, n.status, n.is_deleted, n.deleted_at, n.sort_index, n.parent_id, n.target_id,
         n.storage_key_id, n.project_id, n.media_type, n.creator_id)
     IS DISTINCT FROM
        (o.name, o.type, o.status, o.is_deleted, o.deleted_at, o.sort_index, o.parent_id, o.target_id,
         o.storage_key_id, o.project_id, o.media_type, o.creator_id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_catalog_assets_deleted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT id FROM old_rows ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_catalog_assets_insert AFTER INSERT ON "assets"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_assets_inserted();
CREATE TRIGGER storage_catalog_assets_update AFTER UPDATE ON "assets"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_assets_updated();
CREATE TRIGGER storage_catalog_assets_delete AFTER DELETE ON "assets"
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_assets_deleted();

-- Metadata values: any change re-records the asset the value belongs to.
CREATE FUNCTION storage_catalog_values_inserted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT DISTINCT asset_id FROM new_rows ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_catalog_values_updated() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id)
  SELECT asset_id FROM new_rows UNION SELECT asset_id FROM old_rows
  ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_catalog_values_deleted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT DISTINCT asset_id FROM old_rows ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_catalog_values_insert AFTER INSERT ON "asset_metadata_values"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_values_inserted();
CREATE TRIGGER storage_catalog_values_update AFTER UPDATE ON "asset_metadata_values"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_values_updated();
CREATE TRIGGER storage_catalog_values_delete AFTER DELETE ON "asset_metadata_values"
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_values_deleted();

-- Projects.
CREATE FUNCTION storage_catalog_projects_inserted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT 'project:' || id FROM new_rows ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_catalog_projects_updated() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id)
  SELECT 'project:' || n.id FROM new_rows n JOIN old_rows o ON o.id = n.id
  WHERE (n.name, n.team_id, n.root_folder_id, n.share_root_id, n.metadata_overrides::text)
     IS DISTINCT FROM (o.name, o.team_id, o.root_folder_id, o.share_root_id, o.metadata_overrides::text)
  ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_catalog_projects_deleted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT 'project:' || id FROM old_rows ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_catalog_projects_insert AFTER INSERT ON "projects"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_projects_inserted();
CREATE TRIGGER storage_catalog_projects_update AFTER UPDATE ON "projects"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_projects_updated();
CREATE TRIGGER storage_catalog_projects_delete AFTER DELETE ON "projects"
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_projects_deleted();

-- Metadata fields (keyed by field key, which is what values refer to).
CREATE FUNCTION storage_catalog_fields_inserted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT 'field:' || key FROM new_rows ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_catalog_fields_updated() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id)
  SELECT 'field:' || key FROM new_rows UNION SELECT 'field:' || key FROM old_rows
  ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION storage_catalog_fields_deleted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT 'field:' || key FROM old_rows ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storage_catalog_fields_insert AFTER INSERT ON "metadata_fields"
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_fields_inserted();
CREATE TRIGGER storage_catalog_fields_update AFTER UPDATE ON "metadata_fields"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_fields_updated();
CREATE TRIGGER storage_catalog_fields_delete AFTER DELETE ON "metadata_fields"
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION storage_catalog_fields_deleted();
