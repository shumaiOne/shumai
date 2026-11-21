-- AlterEnum
ALTER TYPE "WorkflowTaskType" ADD VALUE 'transcode_video_chunk_preview';

-- CreateTable
CREATE TABLE "video_chunk_previews" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "start_time" DOUBLE PRECISION NOT NULL,
    "end_time" DOUBLE PRECISION NOT NULL,
    "task_id" TEXT,
    "media" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_chunk_previews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_chunk_previews_asset_id_start_time_end_time_key" ON "video_chunk_previews"("asset_id", "start_time", "end_time");

-- AddForeignKey
ALTER TABLE "video_chunk_previews" ADD CONSTRAINT "video_chunk_previews_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
