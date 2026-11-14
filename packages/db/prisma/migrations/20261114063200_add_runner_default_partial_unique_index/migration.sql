-- Enforce single default runner per team at the database level
CREATE UNIQUE INDEX "runners_one_default_per_team_idx" ON "runners"("team_id") WHERE "is_default" = true;
