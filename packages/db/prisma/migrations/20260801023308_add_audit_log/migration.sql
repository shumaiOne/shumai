-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('team_create', 'team_update', 'team_delete', 'team_member_add', 'team_member_update', 'team_member_remove', 'project_create', 'project_update', 'project_delete', 'project_empty_trash', 'project_member_add', 'project_member_update', 'project_member_remove', 'asset_create', 'asset_update', 'asset_delete', 'asset_reparent', 'asset_copy', 'share_create', 'share_update', 'share_delete', 'agent_create', 'agent_update', 'agent_delete', 'skill_create', 'skill_update', 'skill_delete', 'provider_create', 'provider_update', 'provider_delete', 'invite_create', 'invite_revoke', 'metadata_field_create', 'metadata_field_update', 'metadata_field_delete', 'comment_create', 'comment_update', 'comment_delete', 'comment_complete');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_team_id_id_idx" ON "audit_logs"("team_id", "id" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_item_id_idx" ON "audit_logs"("item_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
