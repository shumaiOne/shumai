/*
  Warnings:

  - You are about to drop the column `enable_ai_autofill` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `enable_ai_transcription` on the `projects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "projects" DROP COLUMN "enable_ai_autofill",
DROP COLUMN "enable_ai_transcription";
