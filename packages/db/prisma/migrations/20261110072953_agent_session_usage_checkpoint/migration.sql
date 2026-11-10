-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN     "accounted_usage" JSONB;

-- Historical spend has already been charged. Seed its checkpoint so continuation only bills new work.
UPDATE agent_sessions s SET accounted_usage = (
  SELECT jsonb_build_object(
    'inputTokens', coalesce(sum((model.value->>'input')::numeric), 0),
    'outputTokens', coalesce(sum((model.value->>'output')::numeric), 0),
    'cacheReadTokens', coalesce(sum((model.value->>'cacheRead')::numeric), 0),
    'totalTokens', coalesce(sum((model.value->>'totalTokens')::numeric), 0),
    'cost', coalesce(sum((model.value->'cost'->>'total')::numeric), 0))
  FROM agent_session_commits c,
    jsonb_array_elements(c.data->'writes') AS write,
    jsonb_each(write->'content'->'value'->'models') AS model
  WHERE c.session_id = s.id AND c.seq = 1 AND write->'record'->>'kind' = 'pi.usage'
);
