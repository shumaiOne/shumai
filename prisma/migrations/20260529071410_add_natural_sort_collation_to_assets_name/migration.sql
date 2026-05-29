-- Create ICU numeric collation for natural sort (numbers sort by value, not lexicographically)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'numeric') THEN
    CREATE COLLATION numeric (provider = icu, locale = 'en@colNumeric=yes');
  END IF;
END;
$$;

-- Alter assets.name to use the numeric collation
-- This makes all ORDER BY name queries (ORM and raw SQL) use natural sort automatically
ALTER TABLE "assets" ALTER COLUMN "name" TYPE TEXT COLLATE numeric;

-- CreateIndex: B-tree index on name using the numeric collation
-- Supports efficient ORDER BY name ASC/DESC without seq scans
CREATE INDEX "assets_name_idx" ON "assets" ("name" COLLATE numeric);