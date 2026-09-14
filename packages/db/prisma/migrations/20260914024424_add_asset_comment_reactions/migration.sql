-- CreateTable
CREATE TABLE "asset_comment_reactions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "asset_comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_comment_reactions_comment_id_idx" ON "asset_comment_reactions"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_comment_reactions_comment_id_user_id_code_key" ON "asset_comment_reactions"("comment_id", "user_id", "code");

-- AddForeignKey
ALTER TABLE "asset_comment_reactions" ADD CONSTRAINT "asset_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "asset_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_comment_reactions" ADD CONSTRAINT "asset_comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
