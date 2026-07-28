-- Migrate existing entry JSON data to new columns
UPDATE agent_session_entries
SET
  type = entry->>'type',
  parent_id = entry->>'parentId',
  asset_id = (SELECT s.asset_id FROM agent_sessions s WHERE s.id = agent_session_entries.session_id),
  created_at = CASE 
    WHEN entry->>'timestamp' IS NOT NULL THEN (entry->>'timestamp')::timestamptz 
    ELSE created_at 
  END,
  data = (entry::jsonb - 'id' - 'type' - 'parentId' - 'timestamp')::text::json
WHERE entry IS NOT NULL;