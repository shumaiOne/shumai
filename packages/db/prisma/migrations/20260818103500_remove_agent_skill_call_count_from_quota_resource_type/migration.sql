-- AlterEnum
BEGIN;
CREATE TYPE "QuotaResourceType_new" AS ENUM ('agent_total_tokens', 'agent_cost', 'agent_mcp_call_count', 'agent_bash_call_count', 'agent_tool_call_count');
ALTER TABLE "quota_rules" ALTER COLUMN "resource" TYPE "QuotaResourceType_new" USING ("resource"::text::"QuotaResourceType_new");
ALTER TYPE "QuotaResourceType" RENAME TO "QuotaResourceType_old";
ALTER TYPE "QuotaResourceType_new" RENAME TO "QuotaResourceType";
DROP TYPE "QuotaResourceType_old";
COMMIT;
