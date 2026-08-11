CREATE TYPE "CharacterProfessionState" AS ENUM ('aspiration', 'pending', 'active', 'rejected');

CREATE TABLE "character_profession_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "character_id" UUID NOT NULL,
  "profession_id" VARCHAR(120) NOT NULL,
  "state" "CharacterProfessionState" NOT NULL DEFAULT 'aspiration',
  "campaign_id" UUID,
  "campaign_name" VARCHAR(160),
  "requested_by_id" UUID,
  "reviewed_by_id" UUID,
  "requested_at" TIMESTAMPTZ(6),
  "reviewed_at" TIMESTAMPTZ(6),
  "decision_note" VARCHAR(500) NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "character_profession_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "character_profession_memberships_character_id_profession_id_key"
  ON "character_profession_memberships"("character_id", "profession_id");
CREATE INDEX "character_profession_memberships_campaign_id_state_requested_at_idx"
  ON "character_profession_memberships"("campaign_id", "state", "requested_at");
CREATE INDEX "character_profession_memberships_character_id_state_idx"
  ON "character_profession_memberships"("character_id", "state");

ALTER TABLE "character_profession_memberships"
  ADD CONSTRAINT "character_profession_memberships_character_id_fkey"
  FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_profession_memberships"
  ADD CONSTRAINT "character_profession_memberships_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "character_profession_memberships"
  ADD CONSTRAINT "character_profession_memberships_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "character_profession_memberships"
  ADD CONSTRAINT "character_profession_memberships_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "character_profession_memberships" ("character_id", "profession_id", "state")
SELECT "id",
  CASE LOWER(TRIM("profession"))
    WHEN 'juramentado de hierro' THEN 'juramentado-de-hierro'
    WHEN 'templario' THEN 'templario'
    WHEN 'guardia de la furia' THEN 'guardia-de-la-furia'
    WHEN 'artesano de artefactos' THEN 'artesano-de-artefactos'
    WHEN 'mago del báculo' THEN 'mago-del-baculo'
    WHEN 'espía de la reina' THEN 'espia-de-la-reina'
    WHEN 'ladrón de guante blanco' THEN 'ladron-de-guante-blanco'
    WHEN 'espiritista' THEN 'espiritista'
    WHEN 'nómada de la sangre' THEN 'nomada-de-la-sangre'
    WHEN 'demonólogo' THEN 'demonologo'
    WHEN 'tejedora verde' THEN 'tejedora-verde'
    WHEN 'ilusionista' THEN 'ilusionista'
    WHEN 'inquisidor' THEN 'inquisidor'
    WHEN 'mentalista' THEN 'mentalista'
    WHEN 'nigromante' THEN 'nigromante'
    WHEN 'piromante' THEN 'piromante'
    WHEN 'confesor' THEN 'confesor'
  END,
  'aspiration'::"CharacterProfessionState"
FROM "characters"
WHERE LOWER(TRIM("profession")) IN (
  'juramentado de hierro','templario','guardia de la furia','artesano de artefactos','mago del báculo',
  'espía de la reina','ladrón de guante blanco','espiritista','nómada de la sangre','demonólogo',
  'tejedora verde','ilusionista','inquisidor','mentalista','nigromante','piromante','confesor'
)
ON CONFLICT ("character_id", "profession_id") DO NOTHING;

UPDATE "characters"
SET "profession" = ''
WHERE LOWER(TRIM("profession")) IN (
  'juramentado de hierro','templario','guardia de la furia','artesano de artefactos','mago del báculo',
  'espía de la reina','ladrón de guante blanco','espiritista','nómada de la sangre','demonólogo',
  'tejedora verde','ilusionista','inquisidor','mentalista','nigromante','piromante','confesor'
);
