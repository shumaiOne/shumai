-- CreateEnum
CREATE TYPE "KanbanTaskStatus" AS ENUM ('TODO', 'READY', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KanbanTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "KanbanTaskEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'COMMENTED', 'CHANGES_REQUESTED', 'BLOCKED', 'UNBLOCKED', 'PRIORITY_CHANGED', 'GOAL_CHANGED', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED', 'CANCELLED');

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
    "is_agent_task" BOOLEAN NOT NULL DEFAULT false,
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
    "sort_index" TEXT,
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
CREATE TABLE "kanban_task_comments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
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
CREATE INDEX "kanban_tasks_team_id_status_idx" ON "kanban_tasks"("team_id", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_status_sort_index_idx" ON "kanban_tasks"("team_id", "status", "sort_index");

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_is_agent_task_status_idx" ON "kanban_tasks"("team_id", "is_agent_task", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_goal_id_status_idx" ON "kanban_tasks"("team_id", "goal_id", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_team_id_assignee_id_status_idx" ON "kanban_tasks"("team_id", "assignee_id", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_project_id_status_idx" ON "kanban_tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "kanban_tasks_sort_index_idx" ON "kanban_tasks"("sort_index");

-- CreateIndex
CREATE INDEX "kanban_task_links_child_id_idx" ON "kanban_task_links"("child_id");

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
ALTER TABLE "kanban_task_links" ADD CONSTRAINT "kanban_task_links_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_links" ADD CONSTRAINT "kanban_task_links_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_comments" ADD CONSTRAINT "kanban_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_comments" ADD CONSTRAINT "kanban_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_events" ADD CONSTRAINT "kanban_task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_events" ADD CONSTRAINT "kanban_task_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
