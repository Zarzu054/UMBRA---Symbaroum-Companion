CREATE TABLE "npcs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "depth" TEXT NOT NULL,
    "race" TEXT NOT NULL DEFAULT '',
    "archetype" TEXT NOT NULL DEFAULT '',
    "occupation" TEXT NOT NULL DEFAULT '',
    "faction" TEXT NOT NULL DEFAULT '',
    "labels" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "statBlock" JSONB,
    "sheet" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "npcs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "npcs_owner_id_idx" ON "npcs"("owner_id");
CREATE INDEX "npcs_depth_idx" ON "npcs"("depth");

ALTER TABLE "npcs"
ADD CONSTRAINT "npcs_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
