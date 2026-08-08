CREATE TYPE "MysticArtifactScope" AS ENUM ('preset', 'campaign');
CREATE TYPE "MysticArtifactKind" AS ENUM ('weapon', 'armor', 'object');
CREATE TYPE "MysticArtifactBindingPaymentType" AS ENUM ('xp', 'permanent_corruption', 'narrative');
CREATE TYPE "MysticArtifactActivation" AS ENUM ('active', 'passive', 'triggered');
CREATE TYPE "MysticArtifactRollKind" AS ENUM ('check', 'attack', 'damage', 'armor', 'healing', 'custom');
CREATE TYPE "MysticArtifactRequirementType" AS ENUM ('capability', 'narrative');

CREATE TABLE "mystic_artifacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" "MysticArtifactScope" NOT NULL,
  "campaign_id" UUID,
  "preset_source_id" UUID,
  "slug" VARCHAR(200),
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "kind" "MysticArtifactKind" NOT NULL DEFAULT 'object',
  "source_title" VARCHAR(200) NOT NULL DEFAULT '',
  "source_page" INTEGER,
  "weapon_attack_attribute" VARCHAR(40),
  "weapon_attack_formula" VARCHAR(80) NOT NULL DEFAULT '1d20',
  "weapon_damage_formula" VARCHAR(80) NOT NULL DEFAULT '',
  "weapon_tags" JSONB NOT NULL DEFAULT '[]',
  "weapon_qualities" JSONB NOT NULL DEFAULT '[]',
  "weapon_requires_binding" BOOLEAN NOT NULL DEFAULT true,
  "armor_protection_formula" VARCHAR(80) NOT NULL DEFAULT '',
  "armor_qualities" JSONB NOT NULL DEFAULT '[]',
  "armor_requires_binding" BOOLEAN NOT NULL DEFAULT true,
  "owner_character_id" UUID,
  "owner_npc_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mystic_artifacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mystic_artifacts_scope_check" CHECK (
    ("scope" = 'preset' AND "campaign_id" IS NULL AND "owner_character_id" IS NULL AND "owner_npc_id" IS NULL)
    OR ("scope" = 'campaign' AND "campaign_id" IS NOT NULL)
  ),
  CONSTRAINT "mystic_artifacts_single_owner_check" CHECK (NOT ("owner_character_id" IS NOT NULL AND "owner_npc_id" IS NOT NULL))
);

CREATE TABLE "mystic_artifact_binding_costs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "artifact_id" UUID NOT NULL,
  "payment_type" "MysticArtifactBindingPaymentType" NOT NULL,
  "amount" INTEGER NOT NULL,
  CONSTRAINT "mystic_artifact_binding_costs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mystic_artifact_binding_costs_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "mystic_artifact_binding_costs_player_payment_check" CHECK ("payment_type" <> 'narrative')
);

CREATE TABLE "mystic_artifact_abilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "artifact_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "activation" "MysticArtifactActivation" NOT NULL DEFAULT 'active',
  "action_cost" VARCHAR(40),
  "corruption_formula" VARCHAR(80) NOT NULL DEFAULT '',
  "requires_binding" BOOLEAN NOT NULL DEFAULT true,
  "per_scene_limit" INTEGER,
  "per_scene_note" VARCHAR(300) NOT NULL DEFAULT '',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "mystic_artifact_abilities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mystic_artifact_abilities_scene_limit_check" CHECK ("per_scene_limit" IS NULL OR "per_scene_limit" > 0)
);

CREATE TABLE "mystic_artifact_ability_rolls" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ability_id" UUID NOT NULL,
  "kind" "MysticArtifactRollKind" NOT NULL,
  "label" VARCHAR(160) NOT NULL,
  "formula" VARCHAR(80) NOT NULL DEFAULT '',
  "actor_attribute" VARCHAR(40),
  "opponent_attribute" VARCHAR(40),
  "fixed_target" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "mystic_artifact_ability_rolls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mystic_artifact_ability_requirements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ability_id" UUID NOT NULL,
  "type" "MysticArtifactRequirementType" NOT NULL,
  "capability_name" VARCHAR(160) NOT NULL DEFAULT '',
  "minimum_level" VARCHAR(40),
  "description" VARCHAR(400) NOT NULL DEFAULT '',
  CONSTRAINT "mystic_artifact_ability_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mystic_artifact_resources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "artifact_id" UUID NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "suggested_max_formula" VARCHAR(80) NOT NULL DEFAULT '',
  "maximum" INTEGER,
  "current" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "mystic_artifact_resources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mystic_artifact_resources_values_check" CHECK (
    ("maximum" IS NULL AND "current" IS NULL)
    OR ("maximum" IS NOT NULL AND "maximum" >= 0 AND "current" IS NOT NULL AND "current" >= 0 AND "current" <= "maximum")
  )
);

CREATE TABLE "mystic_artifact_ability_resource_costs" (
  "ability_id" UUID NOT NULL,
  "resource_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "mystic_artifact_ability_resource_costs_pkey" PRIMARY KEY ("ability_id", "resource_id"),
  CONSTRAINT "mystic_artifact_ability_resource_costs_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "mystic_artifact_bindings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "artifact_id" UUID NOT NULL,
  "character_owner_id" UUID,
  "npc_owner_id" UUID,
  "payment_type" "MysticArtifactBindingPaymentType" NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "bound_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  CONSTRAINT "mystic_artifact_bindings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mystic_artifact_bindings_single_subject_check" CHECK (
    ("character_owner_id" IS NOT NULL AND "npc_owner_id" IS NULL)
    OR ("character_owner_id" IS NULL AND "npc_owner_id" IS NOT NULL)
    OR ("ended_at" IS NOT NULL AND "character_owner_id" IS NULL AND "npc_owner_id" IS NULL)
  ),
  CONSTRAINT "mystic_artifact_bindings_amount_check" CHECK ("amount" >= 0)
);

CREATE UNIQUE INDEX "mystic_artifacts_slug_key" ON "mystic_artifacts"("slug");
CREATE INDEX "mystic_artifacts_scope_source_title_idx" ON "mystic_artifacts"("scope", "source_title");
CREATE INDEX "mystic_artifacts_campaign_id_idx" ON "mystic_artifacts"("campaign_id");
CREATE INDEX "mystic_artifacts_owner_character_id_idx" ON "mystic_artifacts"("owner_character_id");
CREATE INDEX "mystic_artifacts_owner_npc_id_idx" ON "mystic_artifacts"("owner_npc_id");
CREATE UNIQUE INDEX "mystic_artifact_binding_costs_artifact_id_payment_type_key" ON "mystic_artifact_binding_costs"("artifact_id", "payment_type");
CREATE INDEX "mystic_artifact_abilities_artifact_id_sort_order_idx" ON "mystic_artifact_abilities"("artifact_id", "sort_order");
CREATE INDEX "mystic_artifact_ability_rolls_ability_id_sort_order_idx" ON "mystic_artifact_ability_rolls"("ability_id", "sort_order");
CREATE INDEX "mystic_artifact_ability_requirements_ability_id_idx" ON "mystic_artifact_ability_requirements"("ability_id");
CREATE UNIQUE INDEX "mystic_artifact_resources_artifact_id_key_key" ON "mystic_artifact_resources"("artifact_id", "key");
CREATE INDEX "mystic_artifact_resources_artifact_id_sort_order_idx" ON "mystic_artifact_resources"("artifact_id", "sort_order");
CREATE INDEX "mystic_artifact_bindings_artifact_id_ended_at_idx" ON "mystic_artifact_bindings"("artifact_id", "ended_at");
CREATE INDEX "mystic_artifact_bindings_character_owner_id_idx" ON "mystic_artifact_bindings"("character_owner_id");
CREATE INDEX "mystic_artifact_bindings_npc_owner_id_idx" ON "mystic_artifact_bindings"("npc_owner_id");
CREATE UNIQUE INDEX "mystic_artifact_bindings_one_active_idx" ON "mystic_artifact_bindings"("artifact_id") WHERE "ended_at" IS NULL;

ALTER TABLE "mystic_artifacts" ADD CONSTRAINT "mystic_artifacts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifacts" ADD CONSTRAINT "mystic_artifacts_preset_source_id_fkey" FOREIGN KEY ("preset_source_id") REFERENCES "mystic_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mystic_artifacts" ADD CONSTRAINT "mystic_artifacts_owner_character_id_fkey" FOREIGN KEY ("owner_character_id") REFERENCES "campaign_characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mystic_artifacts" ADD CONSTRAINT "mystic_artifacts_owner_npc_id_fkey" FOREIGN KEY ("owner_npc_id") REFERENCES "campaign_npcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_binding_costs" ADD CONSTRAINT "mystic_artifact_binding_costs_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "mystic_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_abilities" ADD CONSTRAINT "mystic_artifact_abilities_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "mystic_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_ability_rolls" ADD CONSTRAINT "mystic_artifact_ability_rolls_ability_id_fkey" FOREIGN KEY ("ability_id") REFERENCES "mystic_artifact_abilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_ability_requirements" ADD CONSTRAINT "mystic_artifact_ability_requirements_ability_id_fkey" FOREIGN KEY ("ability_id") REFERENCES "mystic_artifact_abilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_resources" ADD CONSTRAINT "mystic_artifact_resources_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "mystic_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_ability_resource_costs" ADD CONSTRAINT "mystic_artifact_ability_resource_costs_ability_id_fkey" FOREIGN KEY ("ability_id") REFERENCES "mystic_artifact_abilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_ability_resource_costs" ADD CONSTRAINT "mystic_artifact_ability_resource_costs_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "mystic_artifact_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_bindings" ADD CONSTRAINT "mystic_artifact_bindings_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "mystic_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_bindings" ADD CONSTRAINT "mystic_artifact_bindings_character_owner_id_fkey" FOREIGN KEY ("character_owner_id") REFERENCES "campaign_characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mystic_artifact_bindings" ADD CONSTRAINT "mystic_artifact_bindings_npc_owner_id_fkey" FOREIGN KEY ("npc_owner_id") REFERENCES "campaign_npcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
