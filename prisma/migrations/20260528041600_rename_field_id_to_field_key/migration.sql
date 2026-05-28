-- AlterTable
ALTER TABLE "asset_metadata_values" RENAME COLUMN "field_id" TO "field_key";

-- RenameIndex
ALTER INDEX "asset_metadata_values_asset_id_field_id_key" RENAME TO "asset_metadata_values_asset_id_field_key_key";
