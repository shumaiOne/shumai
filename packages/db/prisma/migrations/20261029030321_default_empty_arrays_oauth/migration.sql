-- AlterTable
ALTER TABLE "oauth_access_tokens" ALTER COLUMN "resources" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "requested_user_info_claims" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "oauth_clients" ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "contacts" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "redirect_uris" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "post_logout_redirect_uris" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "grant_types" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "response_types" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "oauth_consents" ALTER COLUMN "resources" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "requested_user_info_claims" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "oauth_refresh_tokens" ALTER COLUMN "resources" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "requested_user_info_claims" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "oauth_resources" ALTER COLUMN "allowed_scopes" SET DEFAULT ARRAY[]::TEXT[];
