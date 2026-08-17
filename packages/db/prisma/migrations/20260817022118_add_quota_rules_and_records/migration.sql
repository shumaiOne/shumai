-- CreateEnum
CREATE TYPE "QuotaScopeMode" AS ENUM ('all_members', 'each_member', 'selected_members');

-- CreateEnum
CREATE TYPE "QuotaPeriod" AS ENUM ('1hour', '5hour', '1day', '7day');

-- CreateEnum
CREATE TYPE "QuotaResourceType" AS ENUM ('agent_total_tokens', 'agent_cost', 'agent_skill_call_count', 'agent_mcp_call_count', 'agent_bash_call_count', 'agent_tool_call_count');

-- CreateTable
CREATE TABLE "quota_rules" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "scope_mode" "QuotaScopeMode" NOT NULL,
    "role" "TeamMemberRole",
    "user_ids" JSONB,
    "resource" "QuotaResourceType" NOT NULL,
    "resource_data" JSONB,
    "limit" DOUBLE PRECISION NOT NULL,
    "period" "QuotaPeriod" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_records" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "consumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quota_rules_team_id_enabled_idx" ON "quota_rules"("team_id", "enabled");

-- CreateIndex
CREATE INDEX "quota_rules_team_id_resource_idx" ON "quota_rules"("team_id", "resource");

-- CreateIndex
CREATE INDEX "quota_records_team_id_user_id_idx" ON "quota_records"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "quota_records_rule_id_idx" ON "quota_records"("rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "quota_records_rule_id_user_id_key" ON "quota_records"("rule_id", "user_id");

-- AddForeignKey
ALTER TABLE "quota_rules" ADD CONSTRAINT "quota_rules_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_records" ADD CONSTRAINT "quota_records_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "quota_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_records" ADD CONSTRAINT "quota_records_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_records" ADD CONSTRAINT "quota_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
