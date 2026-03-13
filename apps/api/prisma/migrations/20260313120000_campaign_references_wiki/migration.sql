-- CreateTable campaign_references
CREATE TABLE IF NOT EXISTS "campaign_references" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "aliases" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "summary" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_references_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_references_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "campaign_references_campaign_id_idx" ON "campaign_references"("campaign_id");
CREATE INDEX IF NOT EXISTS "campaign_references_name_idx" ON "campaign_references"("name");
