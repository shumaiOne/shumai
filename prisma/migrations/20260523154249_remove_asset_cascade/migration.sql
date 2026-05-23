-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_project_id_fkey";

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_target_id_fkey";

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
