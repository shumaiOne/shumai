-- CreateEnum
CREATE TYPE "WatermarkFileStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- AlterTable
ALTER TABLE "watermark_files" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "watermark_files" ALTER COLUMN "status" TYPE "WatermarkFileStatus" USING ("status"::text::"WatermarkFileStatus");
ALTER TABLE "watermark_files" ALTER COLUMN "status" SET DEFAULT 'pending';
