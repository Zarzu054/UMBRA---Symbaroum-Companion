CREATE TYPE "CampaignItemKind" AS ENUM ('weapon', 'armor', 'item');

CREATE TABLE "campaign_item_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "kind" "CampaignItemKind" NOT NULL,
  "definition" JSONB NOT NULL,
  "is_unique" BOOLEAN NOT NULL DEFAULT false,
  "owner_character_id" UUID,
  "owner_npc_id" UUID,
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_item_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_item_owner_exclusive" CHECK (
    NOT ("owner_character_id" IS NOT NULL AND "owner_npc_id" IS NOT NULL)
    AND ("is_unique" OR ("owner_character_id" IS NULL AND "owner_npc_id" IS NULL))
  )
);

CREATE INDEX "campaign_item_templates_campaign_id_kind_archived_at_idx"
  ON "campaign_item_templates"("campaign_id", "kind", "archived_at");
CREATE INDEX "campaign_item_templates_owner_character_id_idx" ON "campaign_item_templates"("owner_character_id");
CREATE INDEX "campaign_item_templates_owner_npc_id_idx" ON "campaign_item_templates"("owner_npc_id");

ALTER TABLE "campaign_item_templates" ADD CONSTRAINT "campaign_item_templates_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_item_templates" ADD CONSTRAINT "campaign_item_templates_owner_character_id_fkey"
  FOREIGN KEY ("owner_character_id") REFERENCES "campaign_characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campaign_item_templates" ADD CONSTRAINT "campaign_item_templates_owner_npc_id_fkey"
  FOREIGN KEY ("owner_npc_id") REFERENCES "campaign_npcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
