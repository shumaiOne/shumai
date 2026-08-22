-- CreateTable
CREATE TABLE "kanban_task_assets" (
    "task_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_task_assets_pkey" PRIMARY KEY ("task_id","asset_id")
);

-- CreateIndex
CREATE INDEX "kanban_task_assets_asset_id_idx" ON "kanban_task_assets"("asset_id");

-- AddForeignKey
ALTER TABLE "kanban_task_assets" ADD CONSTRAINT "kanban_task_assets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "kanban_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_task_assets" ADD CONSTRAINT "kanban_task_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
