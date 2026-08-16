-- CreateEnum
CREATE TYPE "QuotaScopeType" AS ENUM ('team', 'role', 'user');

-- CreateEnum
CREATE TYPE "QuotaPeriod" AS ENUM ('1hour', '5hour', '1day', '7day');

-- CreateEnum
CREATE TYPE "QuotaResourceType" AS ENUM ('agent_total_tokens', 'agent_cost', 'agent_skill_call_count', 'agent_mcp_call_count', 'agent_bash_call_count', 'agent_network_call_count');

-- CreateTable
CREATE TABLE "quota_policies" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "scope_type" "QuotaScopeType" NOT NULL,
    "role" "TeamMemberRole",
    "user_id" TEXT,
    "resource" "QuotaResourceType" NOT NULL,
    "resource_data" JSONB,
    "limit" DOUBLE PRECISION NOT NULL,
    "period" "QuotaPeriod" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_usages" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "consumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quota_policies_team_id_enabled_idx" ON "quota_policies"("team_id", "enabled");

-- CreateIndex
CREATE INDEX "quota_policies_team_id_resource_idx" ON "quota_policies"("team_id", "resource");

-- CreateIndex
CREATE INDEX "quota_usages_policy_id_user_id_period_end_idx" ON "quota_usages"("policy_id", "user_id", "period_end");

-- CreateIndex
CREATE INDEX "quota_usages_team_id_user_id_idx" ON "quota_usages"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "quota_usages_period_end_idx" ON "quota_usages"("period_end");

-- AddForeignKey
ALTER TABLE "quota_policies" ADD CONSTRAINT "quota_policies_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_policies" ADD CONSTRAINT "quota_policies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_usages" ADD CONSTRAINT "quota_usages_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "quota_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_usages" ADD CONSTRAINT "quota_usages_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_usages" ADD CONSTRAINT "quota_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
