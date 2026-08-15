CREATE TABLE "campaign_character_link_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "requested_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_character_link_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_character_link_requests_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_character_link_requests_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_character_link_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "campaign_character_link_requests_campaign_id_character_id_key" ON "campaign_character_link_requests"("campaign_id", "character_id");
CREATE INDEX "campaign_character_link_requests_character_id_created_at_idx" ON "campaign_character_link_requests"("character_id", "created_at");
CREATE INDEX "campaign_character_link_requests_requested_by_id_idx" ON "campaign_character_link_requests"("requested_by_id");
