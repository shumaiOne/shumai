/*
  Warnings:

  - You are about to drop the column `autofill_context` on the `assets` table. All the data in the column will be lost.
  - You are about to drop the column `ai_autofill` on the `metadata_fields` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "assets" DROP COLUMN "autofill_context";

-- AlterTable
ALTER TABLE "metadata_fields" DROP COLUMN "ai_autofill";
