-- Store API tokens as SHA-256 digests instead of plaintext.
--
-- Existing tokens keep working: their plaintext is hashed in place with the same
-- algorithm the application uses (hex-encoded SHA-256 of the UTF-8 token), so
-- clients holding the plaintext still authenticate. This migration is one-way:
-- after it runs the plaintext values are gone.

-- AlterTable: add the new columns as nullable so existing rows can be backfilled
ALTER TABLE "api_tokens" ADD COLUMN     "token_hash" TEXT,
ADD COLUMN     "token_hint" TEXT;

-- Backfill: keep the last 4 characters for display, then hash the plaintext
UPDATE "api_tokens"
SET "token_hint" = right("token", 4),
    "token_hash" = encode(sha256(convert_to("token", 'UTF8')), 'hex');

-- AlterTable: enforce the final shape
ALTER TABLE "api_tokens" ALTER COLUMN "token_hash" SET NOT NULL,
ALTER COLUMN "token_hint" SET NOT NULL;

-- DropIndex
DROP INDEX "api_tokens_token_key";

-- AlterTable
ALTER TABLE "api_tokens" DROP COLUMN "token";

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");
