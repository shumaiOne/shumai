-- Update assets where media->'metadata' is not null, but 'totalFrames' or 'startTimecode' is missing
UPDATE "assets"
SET "media" = jsonb_set(
  "media",
  '{metadata}',
  coalesce("media"->'metadata', '{}'::jsonb) || jsonb_build_object(
    'totalFrames', ROUND(COALESCE(("media"->'metadata'->>'duration')::numeric, ("media"->>'duration')::numeric, 0) * COALESCE(("media"->'metadata'->>'frameRate')::numeric, 30)),
    'startTimecode', COALESCE("media"->'metadata'->>'startTimecode', '00:00:00:00')
  )
)
WHERE "media" IS NOT NULL
  AND "media"->'metadata' IS NOT NULL
  AND ("media"->'metadata'->'totalFrames' IS NULL OR "media"->'metadata'->'startTimecode' IS NULL);