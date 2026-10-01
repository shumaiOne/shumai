-- Migrate videoStrategy 'all' / 'full' to 'multi'
UPDATE "teams"
SET "settings" = jsonb_set("settings", '{transcode,videoStrategy}', '"multi"')
WHERE "settings"->'transcode'->>'videoStrategy' IN ('all', 'full');

-- Normalize legacy videoStrategy values 'single' / 'disable' to 'best_match'
UPDATE "teams"
SET "settings" = jsonb_set("settings", '{transcode,videoStrategy}', '"best_match"')
WHERE "settings"->'transcode'->>'videoStrategy' IN ('single', 'disable');

-- Backfill default videoResolutions where transcode settings exist without videoResolutions
UPDATE "teams"
SET "settings" = jsonb_set("settings", '{transcode,videoResolutions}', '["480p", "720p", "1080p", "1440p", "2160p"]'::jsonb)
WHERE "settings" IS NOT NULL
  AND jsonb_typeof("settings"->'transcode') = 'object'
  AND NOT ("settings"->'transcode' ? 'videoResolutions');