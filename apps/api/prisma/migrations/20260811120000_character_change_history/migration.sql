CREATE TEMP TABLE "_duplicate_campaign_character_links" AS
SELECT "id"
FROM (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "character_id" ORDER BY "created_at" ASC, "id" ASC) AS "position"
  FROM "campaign_characters"
) ranked
WHERE ranked."position" > 1;

UPDATE "mystic_artifacts"
SET "owner_character_id" = NULL
WHERE "owner_character_id" IN (SELECT "id" FROM "_duplicate_campaign_character_links");

DELETE FROM "mystic_artifact_bindings"
WHERE "character_owner_id" IN (SELECT "id" FROM "_duplicate_campaign_character_links");

DELETE FROM "campaign_characters"
WHERE "id" IN (SELECT "id" FROM "_duplicate_campaign_character_links");

DROP TABLE "_duplicate_campaign_character_links";

CREATE UNIQUE INDEX "campaign_characters_character_id_key" ON "campaign_characters"("character_id");

CREATE TABLE "character_change_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "character_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "actor_email" TEXT NOT NULL,
  "actor_role" "UserRole" NOT NULL,
  "campaign_id" UUID,
  "campaign_name" TEXT,
  "source" VARCHAR(80) NOT NULL,
  "summary" VARCHAR(300) NOT NULL,
  "changes" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "character_change_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "character_change_receipts" (
  "event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "read_at" TIMESTAMPTZ(6),
  CONSTRAINT "character_change_receipts_pkey" PRIMARY KEY ("event_id", "user_id")
);

CREATE INDEX "character_change_events_character_id_created_at_idx" ON "character_change_events"("character_id", "created_at");
CREATE INDEX "character_change_events_campaign_id_character_id_created_at_idx" ON "character_change_events"("campaign_id", "character_id", "created_at");
CREATE INDEX "character_change_events_actor_id_idx" ON "character_change_events"("actor_id");
CREATE INDEX "character_change_receipts_user_id_character_id_read_at_idx" ON "character_change_receipts"("user_id", "character_id", "read_at");

ALTER TABLE "character_change_events" ADD CONSTRAINT "character_change_events_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_change_events" ADD CONSTRAINT "character_change_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "character_change_events" ADD CONSTRAINT "character_change_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "character_change_receipts" ADD CONSTRAINT "character_change_receipts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "character_change_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_change_receipts" ADD CONSTRAINT "character_change_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_change_receipts" ADD CONSTRAINT "character_change_receipts_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
