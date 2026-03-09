-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CampaignSessionStatus" AS ENUM ('planned', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignSessionInviteStatus" AS ENUM ('invited', 'accepted', 'declined');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable campaign_sessions
CREATE TABLE IF NOT EXISTS "campaign_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
  "location" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL DEFAULT '',
  "public_notes" TEXT NOT NULL DEFAULT '',
  "dm_notes" TEXT NOT NULL DEFAULT '',
  "status" "CampaignSessionStatus" NOT NULL DEFAULT 'planned',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_sessions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "campaign_sessions_campaign_id_idx" ON "campaign_sessions"("campaign_id");
CREATE INDEX IF NOT EXISTS "campaign_sessions_scheduled_for_idx" ON "campaign_sessions"("scheduled_for");

-- CreateTable campaign_session_invites
CREATE TABLE IF NOT EXISTS "campaign_session_invites" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "CampaignSessionInviteStatus" NOT NULL DEFAULT 'invited',
  "responded_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_session_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_session_invites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_session_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_session_invites_session_id_user_id_key" ON "campaign_session_invites"("session_id", "user_id");
CREATE INDEX IF NOT EXISTS "campaign_session_invites_user_id_idx" ON "campaign_session_invites"("user_id");

-- CreateTable campaign_session_player_notes
CREATE TABLE IF NOT EXISTS "campaign_session_player_notes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_session_player_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_session_player_notes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_session_player_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_session_player_notes_session_id_author_id_key" ON "campaign_session_player_notes"("session_id", "author_id");
CREATE INDEX IF NOT EXISTS "campaign_session_player_notes_author_id_idx" ON "campaign_session_player_notes"("author_id");
