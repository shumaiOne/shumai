-- CreateTable
CREATE TABLE "sandboxes" (
    "id" TEXT NOT NULL,
    "allowedDomains" TEXT[] DEFAULT ARRAY['github.com', 'api.github.com', 'raw.githubusercontent.com']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "team_id" TEXT NOT NULL,

    CONSTRAINT "sandboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sandboxes_team_id_key" ON "sandboxes"("team_id");

-- AddForeignKey
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
