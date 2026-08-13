-- Standardize the first capability tier as "principiante" in persisted data.
-- This migration is intentionally idempotent and also updates action IDs and
-- JSON object keys that used the former tier name.

CREATE OR REPLACE FUNCTION pg_temp.umbra_skill_level_principiante(value JSONB)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT regexp_replace(value::TEXT, 'novato', 'principiante', 'gi')::JSONB;
$$;

UPDATE "characters"
SET "sheet" = pg_temp.umbra_skill_level_principiante("sheet")
WHERE "sheet"::TEXT ~* 'novato';

UPDATE "monsters"
SET "sheet" = pg_temp.umbra_skill_level_principiante("sheet")
WHERE "sheet"::TEXT ~* 'novato';

UPDATE "npcs"
SET
  "labels" = CASE WHEN "labels"::TEXT ~* 'novato' THEN pg_temp.umbra_skill_level_principiante("labels") ELSE "labels" END,
  "statBlock" = CASE WHEN "statBlock"::TEXT ~* 'novato' THEN pg_temp.umbra_skill_level_principiante("statBlock") ELSE "statBlock" END,
  "sheet" = CASE WHEN "sheet"::TEXT ~* 'novato' THEN pg_temp.umbra_skill_level_principiante("sheet") ELSE "sheet" END
WHERE COALESCE("labels"::TEXT, '') ~* 'novato'
   OR COALESCE("statBlock"::TEXT, '') ~* 'novato'
   OR COALESCE("sheet"::TEXT, '') ~* 'novato';

UPDATE "campaign_npcs"
SET
  "stat_block" = regexp_replace("stat_block", 'novato', 'principiante', 'gi'),
  "sheet" = CASE WHEN "sheet"::TEXT ~* 'novato' THEN pg_temp.umbra_skill_level_principiante("sheet") ELSE "sheet" END
WHERE COALESCE("stat_block", '') ~* 'novato'
   OR COALESCE("sheet"::TEXT, '') ~* 'novato';

UPDATE "campaign_combats"
SET "participants" = pg_temp.umbra_skill_level_principiante("participants")
WHERE "participants"::TEXT ~* 'novato';

UPDATE "character_change_events"
SET "changes" = pg_temp.umbra_skill_level_principiante("changes")
WHERE "changes"::TEXT ~* 'novato';

UPDATE "campaign_chat_messages"
SET
  "action_id" = regexp_replace("action_id", 'novato', 'principiante', 'gi'),
  "action_label" = regexp_replace("action_label", 'novato', 'principiante', 'gi'),
  "action_summary" = regexp_replace("action_summary", 'novato', 'principiante', 'gi'),
  "rolls" = CASE WHEN "rolls"::TEXT ~* 'novato' THEN pg_temp.umbra_skill_level_principiante("rolls") ELSE "rolls" END
WHERE COALESCE("action_id", '') ~* 'novato'
   OR COALESCE("action_label", '') ~* 'novato'
   OR COALESCE("action_summary", '') ~* 'novato'
   OR "rolls"::TEXT ~* 'novato';

UPDATE "mystic_artifact_ability_requirements"
SET "minimum_level" = 'principiante'
WHERE LOWER("minimum_level") = 'novato';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "characters" WHERE "sheet"::TEXT ~* 'novato')
    OR EXISTS (SELECT 1 FROM "monsters" WHERE "sheet"::TEXT ~* 'novato')
    OR EXISTS (SELECT 1 FROM "npcs" WHERE COALESCE("labels"::TEXT, '') ~* 'novato' OR COALESCE("statBlock"::TEXT, '') ~* 'novato' OR COALESCE("sheet"::TEXT, '') ~* 'novato')
    OR EXISTS (SELECT 1 FROM "campaign_npcs" WHERE COALESCE("stat_block", '') ~* 'novato' OR COALESCE("sheet"::TEXT, '') ~* 'novato')
    OR EXISTS (SELECT 1 FROM "campaign_combats" WHERE "participants"::TEXT ~* 'novato')
    OR EXISTS (SELECT 1 FROM "character_change_events" WHERE "changes"::TEXT ~* 'novato')
    OR EXISTS (SELECT 1 FROM "campaign_chat_messages" WHERE COALESCE("action_id", '') ~* 'novato' OR COALESCE("action_label", '') ~* 'novato' OR COALESCE("action_summary", '') ~* 'novato' OR "rolls"::TEXT ~* 'novato')
    OR EXISTS (SELECT 1 FROM "mystic_artifact_ability_requirements" WHERE COALESCE("minimum_level", '') ~* 'novato')
  THEN
    RAISE EXCEPTION 'La migración de nivel principiante dejó valores heredados sin convertir';
  END IF;
END $$;
