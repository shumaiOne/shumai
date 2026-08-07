-- CreateEnum
CREATE TYPE "WatermarkStatus" AS ENUM ('disabled', 'processing', 'ready', 'failed');

-- AlterEnum
ALTER TYPE "WorkflowTaskType" ADD VALUE 'transcode_watermark';

-- AlterTable
ALTER TABLE "share_links" ADD COLUMN     "watermark_config_id" TEXT,
ADD COLUMN     "watermark_status" "WatermarkStatus" NOT NULL DEFAULT 'disabled';

-- CreateTable
CREATE TABLE "watermark_configs" (
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watermark_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watermark_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "team_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watermark_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watermark_files" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "watermark_config_id" TEXT NOT NULL,
    "media" JSONB,
    "status" "WorkflowTaskStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watermark_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "watermark_configs_hash_key" ON "watermark_configs"("hash");

-- CreateIndex
CREATE INDEX "watermark_templates_team_id_idx" ON "watermark_templates"("team_id");

-- CreateIndex
CREATE INDEX "watermark_files_watermark_config_id_idx" ON "watermark_files"("watermark_config_id");

-- CreateIndex
CREATE UNIQUE INDEX "watermark_files_asset_id_watermark_config_id_key" ON "watermark_files"("asset_id", "watermark_config_id");

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_watermark_config_id_fkey" FOREIGN KEY ("watermark_config_id") REFERENCES "watermark_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watermark_templates" ADD CONSTRAINT "watermark_templates_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watermark_files" ADD CONSTRAINT "watermark_files_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watermark_files" ADD CONSTRAINT "watermark_files_watermark_config_id_fkey" FOREIGN KEY ("watermark_config_id") REFERENCES "watermark_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
