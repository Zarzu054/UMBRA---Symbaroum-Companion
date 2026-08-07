CREATE TABLE "compendium_user_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "entry_id" VARCHAR(200) NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "last_viewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "compendium_user_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compendium_user_entries_user_id_entry_id_key"
ON "compendium_user_entries"("user_id", "entry_id");

CREATE INDEX "compendium_user_entries_user_id_is_favorite_idx"
ON "compendium_user_entries"("user_id", "is_favorite");

CREATE INDEX "compendium_user_entries_user_id_last_viewed_at_idx"
ON "compendium_user_entries"("user_id", "last_viewed_at");

ALTER TABLE "compendium_user_entries"
ADD CONSTRAINT "compendium_user_entries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
