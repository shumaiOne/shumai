-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "has_jpeg_preview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "has_jpeg_cover" BOOLEAN NOT NULL DEFAULT false;
