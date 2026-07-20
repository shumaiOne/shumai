-- Backfill media.proxyType for legacy assets
UPDATE "assets"
SET "media" = jsonb_set(
  COALESCE("media"::jsonb, '{}'::jsonb),
  '{proxyType}',
  '"video"'::jsonb
)
WHERE "media" IS NOT NULL AND "media_type" LIKE 'video/%';

UPDATE "assets"
SET "media" = jsonb_set(
  COALESCE("media"::jsonb, '{}'::jsonb),
  '{proxyType}',
  '"audio"'::jsonb
)
WHERE "media" IS NOT NULL AND "media_type" LIKE 'audio/%';

UPDATE "assets"
SET "media" = jsonb_set(
  COALESCE("media"::jsonb, '{}'::jsonb),
  '{proxyType}',
  '"image"'::jsonb
)
WHERE "media" IS NOT NULL AND "media_type" LIKE 'image/%';

UPDATE "assets"
SET "media" = jsonb_set(
  COALESCE("media"::jsonb, '{}'::jsonb),
  '{proxyType}',
  '"pdf"'::jsonb
)
WHERE "media" IS NOT NULL AND ("media_type" = 'application/pdf' OR "name" ILIKE '%.pdf');