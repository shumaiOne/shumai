-- AlterTable: Change sort_index column collation to "C"
ALTER TABLE "assets" ALTER COLUMN "sort_index" TYPE TEXT COLLATE "C";

-- Recreate index on sort_index with "C" collation
DROP INDEX IF EXISTS "assets_sort_index_idx";
CREATE INDEX "assets_sort_index_idx" ON "assets" ("sort_index" COLLATE "C");