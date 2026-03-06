-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CampaignMemberRole" AS ENUM ('gm', 'player');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable campaigns
CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "gm_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "setting" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaigns_gm_id_fkey" FOREIGN KEY ("gm_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "campaigns_gm_id_idx" ON "campaigns"("gm_id");

-- CreateTable campaign_members
CREATE TABLE IF NOT EXISTS "campaign_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "CampaignMemberRole" NOT NULL DEFAULT 'player',
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_members_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_members_campaign_id_user_id_key" ON "campaign_members"("campaign_id", "user_id");
CREATE INDEX IF NOT EXISTS "campaign_members_user_id_idx" ON "campaign_members"("user_id");

-- CreateTable campaign_characters
CREATE TABLE IF NOT EXISTS "campaign_characters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_characters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_characters_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_characters_campaign_id_character_id_key" ON "campaign_characters"("campaign_id", "character_id");
CREATE INDEX IF NOT EXISTS "campaign_characters_character_id_idx" ON "campaign_characters"("character_id");

-- CreateTable campaign_npcs
CREATE TABLE IF NOT EXISTS "campaign_npcs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "race" TEXT NOT NULL DEFAULT '',
  "archetype" TEXT NOT NULL DEFAULT '',
  "occupation" TEXT NOT NULL DEFAULT '',
  "threat" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "stat_block" TEXT NOT NULL DEFAULT '',
  "is_generated" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_npcs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_npcs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "campaign_npcs_campaign_id_idx" ON "campaign_npcs"("campaign_id");

-- CreateTable campaign_xp_log
CREATE TABLE IF NOT EXISTS "campaign_xp_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "granted_by_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_xp_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_xp_log_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_xp_log_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_xp_log_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "campaign_xp_log_campaign_id_idx" ON "campaign_xp_log"("campaign_id");
CREATE INDEX IF NOT EXISTS "campaign_xp_log_character_id_idx" ON "campaign_xp_log"("character_id");
CREATE INDEX IF NOT EXISTS "campaign_xp_log_granted_by_id_idx" ON "campaign_xp_log"("granted_by_id");
