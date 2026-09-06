-- Append 'delete_asset' to deniedTools of existing agents if not already present
UPDATE "agents"
SET "config" = jsonb_set(
  "config"::jsonb,
  '{deniedTools}',
  CASE
    WHEN "config"::jsonb ? 'deniedTools' AND jsonb_typeof("config"::jsonb->'deniedTools') = 'array' THEN
      CASE
        WHEN "config"::jsonb->'deniedTools' @> '["delete_asset"]'::jsonb THEN "config"::jsonb->'deniedTools'
        ELSE ("config"::jsonb->'deniedTools') || '["delete_asset"]'::jsonb
      END
    ELSE
      '["delete_asset"]'::jsonb
  END
);