-- CreateEnum
CREATE TYPE "KanbanTaskType" AS ENUM ('MANUAL', 'AGENTIC');

-- CreateEnum
CREATE TYPE "KanbanTaskStatus" AS ENUM ('TODO', 'READY', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KanbanTaskRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'REVIEW_REQUESTED', 'BLOCKED', 'FAILED', 'TIMED_OUT', 'CANCELLED', 'RECLAIMED');

-- CreateEnum
CREATE TYPE "KanbanTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "KanbanTaskEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'COMMENTED', 'REVIEW_REQUESTED', 'CHANGES_REQUESTED', 'BLOCKED', 'UNBLOCKED', 'RUN_STARTED', 'RUN_COMPLETED', 'RUN_FAILED', 'PRIORITY_CHANGED', 'GOAL_CHANGED', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED', 'ANCESTOR_REOPENED', 'RECLAIMED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "WorkflowTaskType" ADD VALUE 'kanban_agent_run';

-- CreateTable
CREATE TABLE "kanban_goals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "team_id" TEXT NOT NULL,
    "creator_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "KanbanTaskType" NOT NULL DEFAULT 'MANUAL',
    "status" "KanbanTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "KanbanTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "goal_id" TEXT,
    "team_id" TEXT NOT NULL,
    "project_id" TEXT,
    "creator_id" TEXT NOT NULL,
    "reporter_id" TEXT,
    "assignee_id" TEXT,
    "target_folder_id" TEXT,
    "latest_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_task_links" (
    "parent_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_task_links_pkey" PRIMARY KEY ("parent_id","child_id")
);

-- CreateTable
CREATE TABLE "kanban_task_runs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "status" "KanbanTaskRunStatus" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "claim_token" TEXT NOT NULL,
    "claim_expires_at" TIMESTAMP(3),
    "summary" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "workflow_task_id" TEXT,
    "workflow_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_task_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_task_comments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanban_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_task_events" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "KanbanTaskEventType" NOT NULL,
    "from_status" "KanbanTaskStatus",
    "to_status" "KanbanTaskStatus",
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_task_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kanban_goals_team_id_idx" ON "kanban_goals"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_tasks_latest_run_id_key" ON "kanban_tasks"("latest_run_id");

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_status_idx" ON "kanban_tasks"("team_id", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_type_status_idx" ON "kanban_tasks"("team_id", "type", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_goal_id_status_idx" ON "kanban_tasks"("team_id", "goal_id", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_assignee_id_status_idx" ON "kanban_tasks"("team_id", "assignee_id", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_project_id_status_idx" ON "kanban_tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "kanban_task_links_child_id_idx" ON "kanban_task_links"("child_id");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_task_runs_claim_token_key" ON "kanban_task_runs"("claim_token");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_task_runs_workflow_task_id_key" ON "kanban_task_runs"("workflow_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_task_runs_workflow_id_key" ON "kanban_task_runs"("workflow_id");

-- CreateIndex
CREATE INDEX "kanban_task_runs_task_id_started_at_idx" ON "kanban_task_runs"("task_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "kanban_task_runs_task_id_status_idx" ON "kanban_task_runs"("task_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_task_runs_task_id_attempt_key" ON "kanban_task_runs"("task_id", "attempt");

-- CreateIndex
CREATE INDEX "kanban_task_comments_task_id_created_at_idx" ON "kanban_task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "kanban_task_events_task_id_created_at_idx" ON "kanban_task_events"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "kanban_task_events_actor_id_created_at_idx" ON "kanban_task_events"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "kanban_goals" ADD CONSTRAINT "kanban_goals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_goals" ADD CONSTRAINT "kanban_goals_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "kanban_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_target_folder_id_fkey" FOREIGN KEY ("target_folder_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_latest_run_id_fkey" FOREIGN KEY ("latest_run_id") REFERENCES "kanban_task_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_links" ADD CONSTRAINT "kanban_task_links_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_links" ADD CONSTRAINT "kanban_task_links_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_runs" ADD CONSTRAINT "kanban_task_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_runs" ADD CONSTRAINT "kanban_task_runs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_runs" ADD CONSTRAINT "kanban_task_runs_workflow_task_id_fkey" FOREIGN KEY ("workflow_task_id") REFERENCES "workflow_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_comments" ADD CONSTRAINT "kanban_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_comments" ADD CONSTRAINT "kanban_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_events" ADD CONSTRAINT "kanban_task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_events" ADD CONSTRAINT "kanban_task_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
