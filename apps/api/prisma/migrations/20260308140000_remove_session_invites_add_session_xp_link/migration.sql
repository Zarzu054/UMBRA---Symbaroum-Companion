ALTER TABLE "campaign_xp_log"
ADD COLUMN IF NOT EXISTS "session_id" UUID NULL;

DO $$ BEGIN
  ALTER TABLE "campaign_xp_log"
  ADD CONSTRAINT "campaign_xp_log_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "campaign_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "campaign_xp_log_session_id_idx" ON "campaign_xp_log"("session_id");

DROP TABLE IF EXISTS "campaign_session_player_notes";
DROP TABLE IF EXISTS "campaign_session_invites";

DO $$ BEGIN
  DROP TYPE "CampaignSessionInviteStatus";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;
