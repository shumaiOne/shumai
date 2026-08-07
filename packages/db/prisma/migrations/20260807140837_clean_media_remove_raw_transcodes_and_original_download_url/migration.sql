-- Data cleanup: remove legacy media JSON fields that are no longer used.
--
-- WebUI now displays transcoded proxies only and never falls back to the raw
-- original file:
--   1. Drop the raw-original marker entries (`isRaw: true`) from
--      videoTranscodes / imageTranscodes. They pointed at the original file
--      key and were only consumed by the removed display fallbacks and the
--      download-menu entries, which now use media.original.key directly.
--   2. Strip the now-removed `isRaw` field from remaining transcode entries.
--   3. Drop `original.downloadUrl` (removed from the AssetInfo DTO; downloads
--      resolve a fresh presigned URL from `key` via the download-url APIs).

UPDATE "assets"
SET "media" = jsonb_set(
  jsonb_set(
    CASE WHEN jsonb_typeof("media"->'original') = 'object'
         THEN "media" #- '{original,downloadUrl}'
         ELSE "media" END,
    '{videoTranscodes}',
    COALESCE(
      (SELECT jsonb_agg(elem - 'isRaw')
       FROM jsonb_array_elements("media"->'videoTranscodes') elem
       WHERE jsonb_typeof(elem) = 'object'
         AND NOT COALESCE((elem->>'isRaw')::boolean, false)),
      '[]'::jsonb
    )
  ),
  '{imageTranscodes}',
  COALESCE(
    (SELECT jsonb_agg(elem - 'isRaw')
     FROM jsonb_array_elements("media"->'imageTranscodes') elem
     WHERE jsonb_typeof(elem) = 'object'
       AND NOT COALESCE((elem->>'isRaw')::boolean, false)),
    '[]'::jsonb
  )
)
WHERE "media" IS NOT NULL
  AND (
    (jsonb_typeof("media"->'original') = 'object' AND "media"->'original' ? 'downloadUrl')
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE("media"->'videoTranscodes', '[]'::jsonb)) e
      WHERE jsonb_typeof(e) = 'object' AND e ? 'isRaw'
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE("media"->'imageTranscodes', '[]'::jsonb)) e
      WHERE jsonb_typeof(e) = 'object' AND e ? 'isRaw'
    )
  );

-- Same cleanup for watermarked proxy media.
UPDATE "watermark_files"
SET "media" = jsonb_set(
  jsonb_set(
    CASE WHEN jsonb_typeof("media"->'original') = 'object'
         THEN "media" #- '{original,downloadUrl}'
         ELSE "media" END,
    '{videoTranscodes}',
    COALESCE(
      (SELECT jsonb_agg(elem - 'isRaw')
       FROM jsonb_array_elements("media"->'videoTranscodes') elem
       WHERE jsonb_typeof(elem) = 'object'
         AND NOT COALESCE((elem->>'isRaw')::boolean, false)),
      '[]'::jsonb
    )
  ),
  '{imageTranscodes}',
  COALESCE(
    (SELECT jsonb_agg(elem - 'isRaw')
     FROM jsonb_array_elements("media"->'imageTranscodes') elem
     WHERE jsonb_typeof(elem) = 'object'
       AND NOT COALESCE((elem->>'isRaw')::boolean, false)),
    '[]'::jsonb
  )
)
WHERE "media" IS NOT NULL
  AND (
    (jsonb_typeof("media"->'original') = 'object' AND "media"->'original' ? 'downloadUrl')
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE("media"->'videoTranscodes', '[]'::jsonb)) e
      WHERE jsonb_typeof(e) = 'object' AND e ? 'isRaw'
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE("media"->'imageTranscodes', '[]'::jsonb)) e
      WHERE jsonb_typeof(e) = 'object' AND e ? 'isRaw'
    )
  );
