CREATE TABLE "campaign_combats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "active_participant_id" UUID,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_combats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_combats_campaign_id_key" ON "campaign_combats"("campaign_id");

ALTER TABLE "campaign_combats"
ADD CONSTRAINT "campaign_combats_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
