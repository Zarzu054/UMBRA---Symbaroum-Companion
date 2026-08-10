CREATE TABLE "campaign_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "invited_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_invitations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "campaign_invitations_campaign_id_user_id_key" ON "campaign_invitations"("campaign_id", "user_id");
CREATE INDEX "campaign_invitations_user_id_created_at_idx" ON "campaign_invitations"("user_id", "created_at");
CREATE INDEX "campaign_invitations_invited_by_id_idx" ON "campaign_invitations"("invited_by_id");
