/*
  Warnings:

  - You are about to alter the column `code` on the `asset_comment_reactions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(32)`.

*/
-- AlterTable
ALTER TABLE "asset_comment_reactions" ALTER COLUMN "code" SET DATA TYPE VARCHAR(32);
