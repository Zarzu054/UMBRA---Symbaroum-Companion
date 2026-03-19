DO $$ BEGIN
  CREATE TYPE "CampaignChatVisibility" AS ENUM ('all', 'gm_only');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignChatMessageType" AS ENUM ('text', 'action');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "campaign_chat_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "character_id" UUID,
  "visibility" "CampaignChatVisibility" NOT NULL DEFAULT 'all',
  "message_type" "CampaignChatMessageType" NOT NULL DEFAULT 'text',
  "text" TEXT NOT NULL DEFAULT '',
  "action_id" TEXT,
  "action_label" TEXT,
  "action_cost" TEXT,
  "action_summary" TEXT,
  "rolls" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_chat_messages_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_chat_messages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_chat_messages_character_id_fkey"
    FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "campaign_chat_messages_campaign_id_created_at_idx"
  ON "campaign_chat_messages"("campaign_id", "created_at");
CREATE INDEX IF NOT EXISTS "campaign_chat_messages_user_id_idx"
  ON "campaign_chat_messages"("user_id");
CREATE INDEX IF NOT EXISTS "campaign_chat_messages_character_id_idx"
  ON "campaign_chat_messages"("character_id");
