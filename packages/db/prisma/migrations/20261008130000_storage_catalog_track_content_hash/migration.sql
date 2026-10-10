-- Storage catalog follow-up to add_storage_catalog and add_asset_content_hash.
--
-- 1. storage_catalog_assets_updated() compared only the columns the catalog recorded when it was written, and
--    content_hash did not exist then. Setting a hash therefore queued nothing and hashes never reached the
--    catalog. content_hash is now one of the compared columns (its only change from the earlier body).
--
-- 2. Queue inserts are ordered. Two transactions that queue overlapping ids in different orders can deadlock on
--    the queue's primary key; inserting in id order gives every statement the same lock order.
--
-- 3. Queueing an id that is already queued now refreshes queued_at instead of doing nothing. The catalog writer
--    removes a queue row only if its queued_at is unchanged since it read the row, so a change that commits while
--    a log segment is being written to storage keeps its row and goes out in the next segment.
--
-- Only functions are replaced; the triggers that call them are unchanged.

-- Assets.
CREATE OR REPLACE FUNCTION storage_catalog_assets_inserted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT id FROM new_rows ORDER BY id
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_catalog_assets_updated() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id)
  SELECT n.id FROM new_rows n JOIN old_rows o ON o.id = n.id
  WHERE (n.name, n.type, n.status, n.is_deleted, n.deleted_at, n.sort_index, n.parent_id, n.target_id,
         n.storage_key_id, n.project_id, n.media_type, n.creator_id, n.content_hash)
     IS DISTINCT FROM
        (o.name, o.type, o.status, o.is_deleted, o.deleted_at, o.sort_index, o.parent_id, o.target_id,
         o.storage_key_id, o.project_id, o.media_type, o.creator_id, o.content_hash)
  ORDER BY n.id
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_catalog_assets_deleted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT id FROM old_rows ORDER BY id
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Metadata values: any change re-records the asset the value belongs to.
CREATE OR REPLACE FUNCTION storage_catalog_values_inserted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT DISTINCT asset_id FROM new_rows ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_catalog_values_updated() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id)
  SELECT asset_id FROM new_rows UNION SELECT asset_id FROM old_rows
  ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_catalog_values_deleted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT DISTINCT asset_id FROM old_rows ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Projects.
CREATE OR REPLACE FUNCTION storage_catalog_projects_inserted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT 'project:' || id FROM new_rows ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_catalog_projects_updated() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id)
  SELECT 'project:' || n.id FROM new_rows n JOIN old_rows o ON o.id = n.id
  WHERE (n.name, n.team_id, n.root_folder_id, n.share_root_id, n.metadata_overrides::text)
     IS DISTINCT FROM (o.name, o.team_id, o.root_folder_id, o.share_root_id, o.metadata_overrides::text)
  ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_catalog_projects_deleted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT 'project:' || id FROM old_rows ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Metadata fields (keyed by field key, which is what values refer to; DISTINCT because a key can repeat
-- across scopes and ON CONFLICT DO UPDATE may not touch the same queue row twice in one statement).
CREATE OR REPLACE FUNCTION storage_catalog_fields_inserted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT DISTINCT 'field:' || key FROM new_rows ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_catalog_fields_updated() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id)
  SELECT 'field:' || key FROM new_rows UNION SELECT 'field:' || key FROM old_rows
  ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION storage_catalog_fields_deleted() RETURNS trigger AS $$
BEGIN
  INSERT INTO storage_catalog_queue (id) SELECT DISTINCT 'field:' || key FROM old_rows ORDER BY 1
  ON CONFLICT (id) DO UPDATE SET queued_at = clock_timestamp();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
