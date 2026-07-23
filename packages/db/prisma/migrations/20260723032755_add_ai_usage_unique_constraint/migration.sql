/*
  Warnings:

  - A unique constraint covering the columns `[team_id,user_id,period_start]` on the table `ai_usages` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ai_usages_team_id_user_id_period_start_key" ON "ai_usages"("team_id", "user_id", "period_start");
