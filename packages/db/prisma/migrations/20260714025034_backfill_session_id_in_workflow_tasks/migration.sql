-- Backfill session_id from existing task payloads
UPDATE "workflow_tasks"
SET "session_id" = (payload->'agent'->>'sessionId')
WHERE "session_id" IS NULL AND (payload->'agent'->>'sessionId') IS NOT NULL;