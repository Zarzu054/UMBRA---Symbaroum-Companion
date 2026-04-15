DO $$
BEGIN
  CREATE TYPE "CampaignReferenceVisibility" AS ENUM ('gm_only', 'campaign', 'selected_players');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "campaign_references"
ADD COLUMN IF NOT EXISTS "author_id" UUID,
ADD COLUMN IF NOT EXISTS "visibility" "CampaignReferenceVisibility" NOT NULL DEFAULT 'gm_only';

UPDATE "campaign_references"
SET "visibility" = CASE
  WHEN COALESCE("is_public", FALSE) THEN 'campaign'::"CampaignReferenceVisibility"
  ELSE 'gm_only'::"CampaignReferenceVisibility"
END
WHERE "visibility" = 'gm_only';

UPDATE "campaign_references" AS refs
SET "author_id" = campaigns."gm_id"
FROM "campaigns" AS campaigns
WHERE refs."campaign_id" = campaigns."id"
  AND refs."author_id" IS NULL;

ALTER TABLE "campaign_references"
ALTER COLUMN "author_id" SET NOT NULL;

ALTER TABLE "campaign_references"
ADD CONSTRAINT "campaign_references_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "campaign_references_author_id_idx" ON "campaign_references"("author_id");

CREATE TABLE IF NOT EXISTS "campaign_reference_shares" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reference_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_reference_shares_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_reference_shares_reference_id_fkey"
    FOREIGN KEY ("reference_id") REFERENCES "campaign_references"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_reference_shares_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_reference_shares_reference_id_user_id_key"
  ON "campaign_reference_shares"("reference_id", "user_id");
CREATE INDEX IF NOT EXISTS "campaign_reference_shares_user_id_idx"
  ON "campaign_reference_shares"("user_id");

ALTER TABLE "campaign_references"
DROP COLUMN IF EXISTS "is_public";
