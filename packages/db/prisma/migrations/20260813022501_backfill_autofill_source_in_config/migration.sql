-- Backfill autofillSource in config JSON where ai_autofill is true
UPDATE "metadata_fields"
SET "config" = jsonb_set(COALESCE("config", '{}'::jsonb), '{autofillSource}', '"CONTENT"')
WHERE "ai_autofill" = true;

UPDATE "metadata_fields"
SET "config" = jsonb_set(COALESCE("config", '{}'::jsonb), '{autofillSource}', '"NONE"')
WHERE "ai_autofill" = false OR "ai_autofill" IS NULL;
