/*
  Warnings:

  - A unique constraint covering the columns `[session_id]` on the table `asset_comments` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "asset_comments_session_id_key" ON "asset_comments"("session_id");
