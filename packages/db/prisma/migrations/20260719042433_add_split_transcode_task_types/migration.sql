-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowTaskType" ADD VALUE 'transcode_video';
ALTER TYPE "WorkflowTaskType" ADD VALUE 'transcode_image';
ALTER TYPE "WorkflowTaskType" ADD VALUE 'transcode_pdf';
ALTER TYPE "WorkflowTaskType" ADD VALUE 'transcode_pdf_pages';
ALTER TYPE "WorkflowTaskType" ADD VALUE 'transcode_screenshot';
ALTER TYPE "WorkflowTaskType" ADD VALUE 'transcode_image_annotation';
