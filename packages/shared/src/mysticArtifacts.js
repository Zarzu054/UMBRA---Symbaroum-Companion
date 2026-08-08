import { z } from "zod";
const attributeSchema = z.enum(["agil", "atento", "diestro", "discreto", "fuerte", "inteligente", "persuasivo", "tenaz"]);
const skillLevelSchema = z.enum(["novato", "adepto", "maestro"]);
const actionCostSchema = z.enum(["free", "movement", "combat", "reaction"]);
export const mysticArtifactKindSchema = z.enum(["weapon", "armor", "object"]);
export const mysticArtifactPaymentTypeSchema = z.enum(["xp", "permanent_corruption"]);
export const mysticArtifactBindingPaymentTypeSchema = z.enum(["xp", "permanent_corruption", "narrative"]);
export const mysticArtifactActivationSchema = z.enum(["active", "passive", "triggered"]);
export const mysticArtifactRollKindSchema = z.enum(["check", "attack", "damage", "armor", "healing", "custom"]);
export const mysticArtifactWeaponTagSchema = z.enum(["one_handed", "short", "long", "heavy", "ranged", "thrown"]);
export const mysticArtifactBindingCostInputSchema = z.object({
    paymentType: mysticArtifactPaymentTypeSchema,
    amount: z.number().int().min(0).max(1000)
});
export const mysticArtifactRollInputSchema = z.object({
    kind: mysticArtifactRollKindSchema,
    label: z.string().min(1).max(160),
    formula: z.string().max(80).default(""),
    actorAttribute: attributeSchema.optional(),
    opponentAttribute: attributeSchema.optional(),
    fixedTarget: z.number().int().min(1).max(99).optional()
});
export const mysticArtifactRequirementInputSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("capability"),
        capabilityName: z.string().min(1).max(160),
        minimumLevel: skillLevelSchema.optional(),
        description: z.string().max(400).default("")
    }),
    z.object({
        type: z.literal("narrative"),
        capabilityName: z.string().max(160).default(""),
        minimumLevel: skillLevelSchema.optional(),
        description: z.string().min(1).max(400)
    })
]);
export const mysticArtifactAbilityResourceCostInputSchema = z.object({
    resourceKey: z.string().min(1).max(120),
    amount: z.number().int().min(1).max(999)
});
export const mysticArtifactAbilityInputSchema = z.object({
    name: z.string().min(1).max(160),
    description: z.string().max(4000).default(""),
    activation: mysticArtifactActivationSchema.default("active"),
    actionCost: actionCostSchema.optional(),
    corruptionFormula: z.string().max(80).default(""),
    requiresBinding: z.boolean().default(true),
    perSceneLimit: z.number().int().min(1).max(999).optional(),
    perSceneNote: z.string().max(300).default(""),
    rolls: z.array(mysticArtifactRollInputSchema).max(12).default([]),
    requirements: z.array(mysticArtifactRequirementInputSchema).max(12).default([]),
    resourceCosts: z.array(mysticArtifactAbilityResourceCostInputSchema).max(12).default([])
});
export const mysticArtifactResourceInputSchema = z.object({
    key: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9_-]*$/),
    name: z.string().min(1).max(160),
    suggestedMaxFormula: z.string().max(80).default(""),
    maximum: z.number().int().min(0).max(9999).optional(),
    current: z.number().int().min(0).max(9999).optional()
}).superRefine((resource, ctx) => {
    if ((resource.maximum === undefined) !== (resource.current === undefined)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Maximo y actual deben indicarse juntos" });
    }
    if (resource.maximum !== undefined && resource.current !== undefined && resource.current > resource.maximum) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["current"], message: "El recurso actual no puede superar el maximo" });
    }
});
export const mysticArtifactDefinitionInputSchema = z.object({
    name: z.string().min(2).max(160),
    description: z.string().max(12000).default(""),
    kind: mysticArtifactKindSchema.default("object"),
    sourceTitle: z.string().max(200).default(""),
    sourcePage: z.number().int().min(1).max(5000).optional(),
    bindingCosts: z.array(mysticArtifactBindingCostInputSchema).min(1).max(2),
    weapon: z.object({
        attackAttribute: attributeSchema.default("diestro"),
        attackFormula: z.string().max(80).default("1d20"),
        damageFormula: z.string().max(80).default(""),
        tags: z.array(mysticArtifactWeaponTagSchema).max(12).default([]),
        qualities: z.array(z.string().min(1).max(120)).max(40).default([]),
        requiresBinding: z.boolean().default(true)
    }).optional(),
    armor: z.object({
        protectionFormula: z.string().max(80).default(""),
        qualities: z.array(z.string().min(1).max(120)).max(40).default([]),
        requiresBinding: z.boolean().default(true)
    }).optional(),
    abilities: z.array(mysticArtifactAbilityInputSchema).max(40).default([]),
    resources: z.array(mysticArtifactResourceInputSchema).max(20).default([])
}).superRefine((artifact, ctx) => {
    if (artifact.kind === "weapon" && !artifact.weapon) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weapon"], message: "Un artefacto arma necesita perfil de arma" });
    }
    if (artifact.kind === "armor" && !artifact.armor) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["armor"], message: "Un artefacto armadura necesita perfil de armadura" });
    }
    const paymentTypes = artifact.bindingCosts.map((entry) => entry.paymentType);
    if (new Set(paymentTypes).size !== paymentTypes.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bindingCosts"], message: "No se puede repetir un tipo de pago" });
    }
    const resourceKeys = new Set(artifact.resources.map((resource) => resource.key));
    for (const [abilityIndex, ability] of artifact.abilities.entries()) {
        for (const [costIndex, cost] of ability.resourceCosts.entries()) {
            if (!resourceKeys.has(cost.resourceKey)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["abilities", abilityIndex, "resourceCosts", costIndex, "resourceKey"],
                    message: "El recurso consumido no existe en el artefacto"
                });
            }
        }
    }
});
export const createCampaignMysticArtifactSchema = z.discriminatedUnion("mode", [
    z.object({
        mode: z.literal("preset"),
        presetId: z.string().uuid(),
        name: z.string().min(2).max(160).optional(),
        resources: z.array(z.object({
            key: z.string().min(1).max(120),
            maximum: z.number().int().min(0).max(9999),
            current: z.number().int().min(0).max(9999).optional()
        })).max(20).default([])
    }),
    z.object({ mode: z.literal("custom"), artifact: mysticArtifactDefinitionInputSchema })
]);
export const updateCampaignMysticArtifactSchema = mysticArtifactDefinitionInputSchema;
export const assignMysticArtifactOwnerSchema = z.discriminatedUnion("ownerType", [
    z.object({ ownerType: z.literal("none") }),
    z.object({ ownerType: z.literal("character"), ownerId: z.string().uuid() }),
    z.object({ ownerType: z.literal("npc"), ownerId: z.string().uuid() })
]);
export const bindMysticArtifactSchema = z.object({ paymentType: mysticArtifactPaymentTypeSchema });
export const updateMysticArtifactResourceSchema = z.object({
    maximum: z.number().int().min(0).max(9999),
    current: z.number().int().min(0).max(9999)
}).refine((value) => value.current <= value.maximum, { path: ["current"], message: "El recurso actual no puede superar el maximo" });
