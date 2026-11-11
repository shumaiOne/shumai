-- Preserve explicit JSON nulls in historical payloads. The first conversion omits
-- absent optional entry fields; nested payloads must keep their original values.
BEGIN;
CREATE FUNCTION pg_temp.pi_restore_nulls(original jsonb, converted jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $restore$
DECLARE item record; result jsonb := converted;
BEGIN
  IF jsonb_typeof(original) = 'object' AND jsonb_typeof(converted) = 'object' THEN
    FOR item IN SELECT * FROM jsonb_each(original) LOOP
      IF item.value = 'null'::jsonb AND NOT result ? item.key THEN
        result := result || jsonb_build_object(item.key, NULL);
      ELSIF result ? item.key THEN
        result := jsonb_set(result, ARRAY[item.key], pg_temp.pi_restore_nulls(item.value, result->item.key));
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(original) = 'array' AND jsonb_typeof(converted) = 'array' THEN
    FOR item IN SELECT value, ordinality FROM jsonb_array_elements(original) WITH ORDINALITY LOOP
      IF item.ordinality <= jsonb_array_length(result) THEN
        result := jsonb_set(result, ARRAY[(item.ordinality - 1)::text], pg_temp.pi_restore_nulls(item.value, result->(item.ordinality - 1)::integer));
      END IF;
    END LOOP;
  END IF;
  RETURN result;
END $restore$;

WITH RECURSIVE path AS (
  SELECT s.id AS session_id, e.id, e.parent_id, e.type, e.data, 0 AS depth
  FROM agent_sessions s JOIN agent_session_entries e ON e.id = s.leaf_id
  UNION ALL
  SELECT p.session_id, e.id, e.parent_id, e.type, e.data, p.depth + 1
  FROM path p JOIN agent_session_entries e ON e.id = p.parent_id
), historical AS (
  SELECT session_id, type, data, depth FROM path
  UNION ALL
  SELECT s.id, e.type, e.data, -row_number() OVER (PARTITION BY s.id ORDER BY e.id)::integer
  FROM agent_sessions s JOIN agent_session_entries e ON e.session_id = s.id WHERE s.leaf_id IS NULL
), numbered AS (
  SELECT *, row_number() OVER (PARTITION BY session_id ORDER BY depth DESC) + 1 AS seq FROM historical
), payloads AS (
  SELECT session_id, seq, CASE
    WHEN data->>'customType' = 'shumai_message' THEN jsonb_build_object('data', jsonb_build_object('context', data->'details'))
    WHEN type = 'message' AND data->'message' IS NOT NULL THEN jsonb_build_object('model', jsonb_build_array(data->'message'))
    ELSE jsonb_build_object('data', data) END AS original
  FROM numbered
)
UPDATE agent_session_commits c SET data = jsonb_set(c.data, '{writes}', (
  SELECT jsonb_agg(CASE WHEN write->>'type' = 'entry'
    THEN jsonb_set(write, '{value}', pg_temp.pi_restore_nulls(p.original, write->'value'))
    ELSE write END ORDER BY ordinal)
  FROM jsonb_array_elements(c.data->'writes') WITH ORDINALITY AS writes(write, ordinal)
))
FROM payloads p WHERE c.session_id = p.session_id AND c.seq = p.seq;

DROP FUNCTION pg_temp.pi_restore_nulls(jsonb, jsonb);
COMMIT;
