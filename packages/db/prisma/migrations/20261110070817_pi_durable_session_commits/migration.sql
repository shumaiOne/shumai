BEGIN;

-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN     "writer_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "agent_session_commits" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "agent_session_commits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_session_commits_session_id_seq_key" ON "agent_session_commits"("session_id", "seq");

-- AddForeignKey
ALTER TABLE "agent_session_commits" ADD CONSTRAINT "agent_session_commits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill historical transcripts as idle Pi Durable 1.5 sessions. No provider requests run.
DO $migration$
BEGIN
  CREATE TEMP TABLE pi_legacy_path ON COMMIT DROP AS
  WITH RECURSIVE path AS (
    SELECT s.id AS session_id, e.id AS old_id, e.parent_id, e.type, e.data,
           e.created_at, 0 AS depth, ARRAY[e.id] AS visited
    FROM agent_sessions s JOIN agent_session_entries e ON e.id = s.leaf_id
    UNION ALL
    SELECT p.session_id, e.id, e.parent_id, e.type, e.data, e.created_at,
           p.depth + 1, p.visited || e.id
    FROM path p JOIN agent_session_entries e ON e.id = p.parent_id
    WHERE NOT e.id = ANY(p.visited)
  ), all_entries AS (
    SELECT session_id, old_id, parent_id, type, data, created_at, depth, visited FROM path
    UNION ALL
    SELECT s.id, e.id, e.parent_id, e.type, e.data, e.created_at,
           -row_number() OVER (PARTITION BY s.id ORDER BY e.id)::integer, ARRAY[e.id]
    FROM agent_sessions s JOIN agent_session_entries e ON e.session_id = s.id
    WHERE s.leaf_id IS NULL
  )
  SELECT *, row_number() OVER (PARTITION BY session_id ORDER BY depth DESC) AS position
  FROM all_entries;

  IF EXISTS (SELECT 1 FROM agent_sessions s WHERE s.leaf_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agent_session_entries e WHERE e.id = s.leaf_id)) THEN
    RAISE EXCEPTION 'Cannot migrate agent sessions: a session leaf is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pi_legacy_path p WHERE p.parent_id = ANY(p.visited)) THEN
    RAISE EXCEPTION 'Cannot migrate agent sessions: cyclic history';
  END IF;
  IF EXISTS (SELECT 1 FROM pi_legacy_path p WHERE p.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM agent_session_entries e WHERE e.id = p.parent_id)) THEN
    RAISE EXCEPTION 'Cannot migrate agent sessions: an ancestor is missing';
  END IF;

  -- Migration-only ULIDs: preserve the historical timestamp and derive collision-resistant entropy.
  CREATE FUNCTION pg_temp.pi_commit_id(seed text, stamp timestamp) RETURNS text
  LANGUAGE plpgsql AS $id$
  DECLARE
    alphabet text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    number numeric := floor(extract(epoch FROM stamp) * 1000);
    bytes bytea := decode(substr(md5(seed), 1, 20), 'hex');
    encoded text := '';
    i integer;
  BEGIN
    FOR i IN 0..9 LOOP number := number * 256 + get_byte(bytes, i); END LOOP;
    FOR i IN 1..26 LOOP
      encoded := substr(alphabet, mod(number, 32)::integer + 1, 1) || encoded;
      number := trunc(number / 32);
    END LOOP;
    RETURN encoded;
  END $id$;

  CREATE TEMP TABLE pi_legacy_usage ON COMMIT DROP AS
  SELECT session_id, coalesce(message->>'provider', 'legacy') || '/' || coalesce(message->>'model', 'unknown') AS model,
    jsonb_build_object(
      'input', sum(coalesce((message->'usage'->>'input')::numeric, 0)),
      'output', sum(coalesce((message->'usage'->>'output')::numeric, 0)),
      'cacheRead', sum(coalesce((message->'usage'->>'cacheRead')::numeric, 0)),
      'cacheWrite', sum(coalesce((message->'usage'->>'cacheWrite')::numeric, 0)),
      'totalTokens', sum(coalesce((message->'usage'->>'totalTokens')::numeric, 0)),
      'cost', jsonb_build_object(
        'input', sum(coalesce((message->'usage'->'cost'->>'input')::numeric, 0)),
        'output', sum(coalesce((message->'usage'->'cost'->>'output')::numeric, 0)),
        'cacheRead', sum(coalesce((message->'usage'->'cost'->>'cacheRead')::numeric, 0)),
        'cacheWrite', sum(coalesce((message->'usage'->'cost'->>'cacheWrite')::numeric, 0)),
        'total', sum(coalesce((message->'usage'->'cost'->>'total')::numeric, 0)))) AS usage
  FROM (SELECT session_id, CASE WHEN type IN ('compaction', 'branch_summary') THEN data ELSE data->'message' END AS message FROM pi_legacy_path) messages
  WHERE message->>'role' = 'assistant' OR message->'usage' IS NOT NULL
  GROUP BY session_id, coalesce(message->>'provider', 'legacy') || '/' || coalesce(message->>'model', 'unknown');

  INSERT INTO agent_session_commits (id, session_id, seq, data)
  SELECT pg_temp.pi_commit_id(s.id || ':bootstrap', s.created_at), s.id, 1,
    jsonb_build_object('version', 1, 'writes', jsonb_build_array(
      jsonb_build_object('type', 'conversation', 'value', jsonb_build_object('id', 1)),
      jsonb_build_object('type', 'document.create', 'record', jsonb_build_object('id', 2, 'kind', 'pi.live', 'scope', jsonb_build_object('kind', 'conversation', 'conversationId', 1), 'history', 'latest', 'fork', 'initial'), 'content', jsonb_build_object('version', 3, 'kind', 'base', 'value', '{}'::jsonb)),
      jsonb_build_object('type', 'document.create', 'record', jsonb_build_object('id', 3, 'kind', 'pi.inbox', 'scope', jsonb_build_object('kind', 'conversation', 'conversationId', 1), 'history', 'latest', 'fork', 'initial'), 'content', jsonb_build_object('version', 1, 'kind', 'base', 'value', '{"items":[]}'::jsonb)),
      jsonb_build_object('type', 'document.create', 'record', jsonb_build_object('id', 4, 'kind', 'pi.usage', 'scope', jsonb_build_object('kind', 'conversation', 'conversationId', 1), 'history', 'latest', 'fork', 'initial'), 'content', jsonb_build_object('version', 1, 'kind', 'base', 'value', jsonb_build_object('models', coalesce((SELECT jsonb_object_agg(u.model, u.usage) FROM pi_legacy_usage u WHERE u.session_id = s.id), '{}'::jsonb), 'tools', '{}'::jsonb))),
      jsonb_build_object('type', 'document.create', 'record', jsonb_build_object('id', 5, 'kind', 'pi.provider', 'scope', jsonb_build_object('kind', 'conversation', 'conversationId', 1), 'history', 'latest', 'fork', 'initial'), 'content', jsonb_build_object('version', 1, 'kind', 'base', 'value', jsonb_build_object('sessionId', gen_random_uuid()::text))),
      jsonb_build_object('type', 'document.create', 'record', jsonb_build_object('id', 6, 'kind', 'pi.agent', 'scope', jsonb_build_object('kind', 'conversation', 'conversationId', 1), 'history', 'rewindable', 'fork', 'asOf'), 'content', jsonb_build_object('version', 1, 'kind', 'base', 'value', '{}'::jsonb))
    ))
  FROM agent_sessions s
  WHERE NOT EXISTS (SELECT 1 FROM agent_session_commits c WHERE c.session_id = s.id);

  CREATE TEMP TABLE pi_migrated_entries ON COMMIT DROP AS
  SELECT p.*, 5 + 2 * p.position AS entry_id,
    CASE
      WHEN p.type = 'custom_message' AND p.data->>'customType' = 'shumai_message' THEN 'shumai.message'
      WHEN p.type = 'message' AND p.data->>'customType' = 'shumai_message' THEN 'shumai.message'
      WHEN p.type = 'message' THEN CASE p.data->'message'->>'role'
        WHEN 'user' THEN 'pi.user' WHEN 'assistant' THEN 'pi.assistant'
        WHEN 'toolResult' THEN 'pi.tool-result' WHEN 'system' THEN 'pi.system'
        ELSE 'shumai.legacy' END
      WHEN p.type = 'compaction' THEN 'pi.compaction'
      ELSE 'shumai.' || coalesce(p.type, 'legacy') END AS kind
  FROM pi_legacy_path p;

  CREATE FUNCTION pg_temp.pi_references(value jsonb, target_session text) RETURNS jsonb
  LANGUAGE plpgsql AS $refs$
  DECLARE result jsonb; item record; reference text; text_value text;
  BEGIN
    IF jsonb_typeof(value) = 'object' THEN
      result := '{}'::jsonb;
      FOR item IN SELECT * FROM jsonb_each(value) LOOP
        IF item.key = 'annotationId' AND jsonb_typeof(item.value) = 'string' THEN
          SELECT 'chat:' || target_session || ':legacy-' || p.old_id INTO reference
          FROM pi_migrated_entries p WHERE p.session_id = target_session AND p.old_id = item.value #>> '{}'
            AND NOT EXISTS (SELECT 1 FROM asset_comments c WHERE c.id = p.old_id);
          result := result || jsonb_build_object(item.key, coalesce(to_jsonb(reference), item.value));
        ELSE result := result || jsonb_build_object(item.key, pg_temp.pi_references(item.value, target_session)); END IF;
      END LOOP;
      RETURN result;
    ELSIF jsonb_typeof(value) = 'array' THEN
      SELECT coalesce(jsonb_agg(pg_temp.pi_references(element, target_session) ORDER BY ordinal), '[]'::jsonb) INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS items(element, ordinal);
      RETURN result;
    ELSIF jsonb_typeof(value) = 'string' THEN
      text_value := value #>> '{}';
      FOR item IN SELECT old_id FROM pi_migrated_entries p WHERE p.session_id = target_session AND NOT EXISTS (SELECT 1 FROM asset_comments c WHERE c.id = p.old_id) LOOP
        text_value := replace(text_value, 'id="' || item.old_id || '"', 'id="chat:' || target_session || ':legacy-' || item.old_id || '"');
      END LOOP;
      RETURN to_jsonb(text_value);
    END IF;
    RETURN value;
  END $refs$;

  UPDATE pi_migrated_entries SET data = pg_temp.pi_references(data, session_id);

  IF EXISTS (SELECT 1 FROM pi_migrated_entries p WHERE p.type = 'compaction' AND p.data->>'firstKeptEntryId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pi_migrated_entries k WHERE k.session_id = p.session_id AND k.old_id = p.data->>'firstKeptEntryId')) THEN
    RAISE EXCEPTION 'Cannot migrate agent sessions: compaction boundary is missing';
  END IF;

  INSERT INTO agent_session_commits (id, session_id, seq, data)
  SELECT pg_temp.pi_commit_id(p.session_id || ':' || p.position::text, p.created_at), p.session_id, p.position + 1,
    jsonb_build_object('version', 1, 'writes', jsonb_build_array(
      jsonb_build_object('type', 'entry', 'value', jsonb_strip_nulls(jsonb_build_object(
        'id', p.entry_id, 'conversationId', 1, 'kind', p.kind,
        'model', CASE
          WHEN p.kind = 'shumai.message' THEN jsonb_build_array(jsonb_build_object('role', 'user', 'content', coalesce(p.data->>'content', ''), 'timestamp', floor(extract(epoch FROM p.created_at) * 1000)))
          WHEN p.kind IN ('pi.user', 'pi.assistant', 'pi.tool-result', 'pi.system') THEN jsonb_build_array(p.data->'message')
          WHEN p.kind IN ('pi.compaction', 'shumai.branch_summary') THEN jsonb_build_array(jsonb_build_object('role', 'user', 'content', 'The conversation history before this point was compacted into the following summary:' || chr(10) || '<summary>' || chr(10) || coalesce(p.data->>'summary', '') || chr(10) || '</summary>', 'timestamp', floor(extract(epoch FROM p.created_at) * 1000)))
          WHEN p.type = 'custom_message' AND p.data->>'content' IS NOT NULL THEN jsonb_build_array(jsonb_build_object('role', 'user', 'content', p.data->>'content', 'timestamp', floor(extract(epoch FROM p.created_at) * 1000)))
          ELSE NULL END,
        'head', CASE WHEN p.kind = 'pi.compaction' THEN (SELECT k.entry_id FROM pi_migrated_entries k WHERE k.session_id = p.session_id AND k.old_id = p.data->>'firstKeptEntryId') ELSE NULL END,
        'data', CASE WHEN p.kind = 'shumai.message' THEN jsonb_build_object(
          'displayText', coalesce(p.data->>'content', ''),
          'timestamp', floor(extract(epoch FROM p.created_at) * 1000),
          'sourceCommentId', CASE WHEN EXISTS (SELECT 1 FROM asset_comments a WHERE a.id = p.old_id) THEN p.old_id ELSE NULL END,
          'context', coalesce(p.data->'details', '{}'::jsonb) || jsonb_build_object('id', CASE WHEN EXISTS (SELECT 1 FROM asset_comments a WHERE a.id = p.old_id) THEN p.old_id ELSE 'chat:' || p.session_id || ':legacy-' || p.old_id END),
          'legacyId', p.old_id)
        WHEN p.kind = 'pi.tool-result' THEN '{"diagnostics":[]}'::jsonb
        WHEN p.kind = 'pi.compaction' THEN '{"reason":"manual"}'::jsonb
        ELSE coalesce(p.data, '{}'::jsonb) || jsonb_build_object('legacyId', p.old_id) END
      ))),
      jsonb_build_object('type', 'submission', 'value', jsonb_build_object(
        'id', p.entry_id + 1, 'conversationId', 1, 'type', 'write', 'status', 'done',
        'entry', p.entry_id, 'requestId', 'legacy-' || p.old_id))
    ))
  FROM pi_migrated_entries p
  WHERE NOT EXISTS (SELECT 1 FROM agent_session_commits c WHERE c.session_id = p.session_id AND c.seq = p.position + 1)
  ORDER BY p.session_id, p.position;

  DROP FUNCTION pg_temp.pi_references(jsonb, text);
  DROP TABLE pi_legacy_usage;
  DROP FUNCTION pg_temp.pi_commit_id(text, timestamp);
  DROP TABLE pi_migrated_entries;
  DROP TABLE pi_legacy_path;
END $migration$;

COMMIT;
