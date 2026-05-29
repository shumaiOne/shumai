-- Create ICU collation for natural sort (numbers sort by value, not lexicographically)
-- Named 'natural_sort' to avoid conflict with the 'numeric' reserved keyword / built-in type in PostgreSQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'natural_sort') THEN
    CREATE COLLATION natural_sort (provider = icu, locale = 'en@colNumeric=yes');
  END IF;
END;
$$;

-- Alter assets.name to use the natural_sort collation
-- This makes all ORDER BY name queries (ORM and raw SQL) use natural sort automatically
ALTER TABLE "assets" ALTER COLUMN "name" TYPE TEXT COLLATE natural_sort;

-- CreateIndex: B-tree index on name using the natural_sort collation
-- Supports efficient ORDER BY name ASC/DESC without seq scans
CREATE INDEX "assets_name_idx" ON "assets" ("name" COLLATE natural_sort);