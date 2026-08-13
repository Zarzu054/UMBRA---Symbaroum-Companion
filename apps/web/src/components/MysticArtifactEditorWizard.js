import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { mysticArtifactDefinitionInputSchema } from "@umbra/shared";
const ATTRIBUTES = ["agil", "atento", "diestro", "discreto", "fuerte", "inteligente", "persuasivo", "tenaz"];
const ATTRIBUTE_LABELS = {
    agil: "Ágil", atento: "Atento", diestro: "Diestro", discreto: "Discreto",
    fuerte: "Fuerte", inteligente: "Inteligente", persuasivo: "Persuasivo", tenaz: "Tenaz"
};
const WEAPON_TAGS = [
    ["one_handed", "Una mano"], ["short", "Corta"], ["long", "Larga"],
    ["heavy", "Pesada"], ["ranged", "A distancia"], ["thrown", "Arrojadiza"]
];
const STEPS = ["Narrativa", "Funcionamiento", "Recursos", "Capacidades"];
function emptyAbility() {
    return {
        name: "Nueva capacidad",
        description: "",
        activation: "active",
        actionCost: "combat",
        corruptionFormula: "1D4",
        requiresBinding: true,
        perSceneNote: "",
        rolls: [],
        requirements: [],
        resourceCosts: []
    };
}
function emptyRoll() {
    return { kind: "check", label: "Tirada", formula: "1D20", actorAttribute: "tenaz" };
}
function emptyRequirement() {
    return { type: "capability", capabilityName: "", minimumLevel: "principiante", description: "" };
}
function emptyResource(index) {
    return { key: `recurso_${index + 1}`, name: "Nuevo recurso", suggestedMaxFormula: "", maximum: 1, current: 1 };
}
function resourceKeyFromName(name, fallbackIndex) {
    const normalized = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return normalized || `recurso_${fallbackIndex + 1}`;
}
function numberOrUndefined(value) {
    if (!value.trim())
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : undefined;
}
function splitQualities(value) {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}
function describeValidationError(error) {
    if (typeof error === "object" && error && "issues" in error) {
        const issue = error.issues?.[0];
        if (issue)
            return `${issue.path?.join(" → ") || "Artefacto"}: ${issue.message ?? "valor no válido"}`;
    }
    return error instanceof Error ? error.message : "Revisa los datos del artefacto.";
}
export function MysticArtifactEditorWizard({ initialValue, title, busy = false, externalError, onCancel, onSave }) {
    const [draft, setDraft] = useState(() => structuredClone(initialValue));
    const [step, setStep] = useState(0);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const isBusy = busy || saving;
    function updateDefinition(patch) {
        setDraft((current) => ({ ...current, ...patch }));
    }
    function changeKind(kind) {
        setDraft((current) => ({
            ...current,
            kind,
            weapon: kind === "weapon" ? current.weapon ?? {
                attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D8",
                tags: ["one_handed"], qualities: [], requiresBinding: true
            } : undefined,
            armor: kind === "armor" ? current.armor ?? {
                protectionFormula: "1D4", qualities: [], requiresBinding: true
            } : undefined
        }));
    }
    function togglePayment(paymentType, enabled) {
        setDraft((current) => ({
            ...current,
            bindingCosts: enabled
                ? current.bindingCosts.some((cost) => cost.paymentType === paymentType)
                    ? current.bindingCosts
                    : [...current.bindingCosts, { paymentType, amount: 1 }]
                : current.bindingCosts.filter((cost) => cost.paymentType !== paymentType)
        }));
    }
    function updatePayment(paymentType, amount) {
        setDraft((current) => ({
            ...current,
            bindingCosts: current.bindingCosts.map((cost) => cost.paymentType === paymentType ? { ...cost, amount: Math.max(0, Math.floor(amount || 0)) } : cost)
        }));
    }
    function updateResource(index, patch) {
        setDraft((current) => ({
            ...current,
            resources: current.resources.map((resource, resourceIndex) => resourceIndex === index ? { ...resource, ...patch } : resource)
        }));
    }
    function renameResource(index, name) {
        setDraft((current) => {
            const resource = current.resources[index];
            if (!resource)
                return current;
            const baseKey = resourceKeyFromName(name, index);
            const occupiedKeys = new Set(current.resources.filter((_, resourceIndex) => resourceIndex !== index).map((entry) => entry.key));
            let nextKey = baseKey;
            let suffix = 2;
            while (occupiedKeys.has(nextKey)) {
                nextKey = `${baseKey}_${suffix}`;
                suffix += 1;
            }
            return {
                ...current,
                resources: current.resources.map((entry, resourceIndex) => resourceIndex === index ? { ...entry, name, key: nextKey } : entry),
                abilities: current.abilities.map((ability) => ({
                    ...ability,
                    resourceCosts: ability.resourceCosts.map((cost) => cost.resourceKey === resource.key ? { ...cost, resourceKey: nextKey } : cost)
                }))
            };
        });
    }
    function updateAbility(index, patch) {
        setDraft((current) => ({
            ...current,
            abilities: current.abilities.map((ability, abilityIndex) => abilityIndex === index ? { ...ability, ...patch } : ability)
        }));
    }
    function updateRoll(abilityIndex, rollIndex, patch) {
        const ability = draft.abilities[abilityIndex];
        updateAbility(abilityIndex, { rolls: ability.rolls.map((roll, index) => index === rollIndex ? { ...roll, ...patch } : roll) });
    }
    function updateRequirement(abilityIndex, requirementIndex, requirement) {
        const ability = draft.abilities[abilityIndex];
        updateAbility(abilityIndex, { requirements: ability.requirements.map((entry, index) => index === requirementIndex ? requirement : entry) });
    }
    function validateStep(targetStep = step) {
        setError(null);
        if (targetStep === 0 && draft.name.trim().length < 2) {
            setError("El nombre debe tener al menos 2 caracteres.");
            return false;
        }
        if (targetStep === 1 && draft.bindingCosts.length === 0) {
            setError("Selecciona al menos una forma de pago para el vínculo.");
            return false;
        }
        if (targetStep === 2) {
            const keys = draft.resources.map((resource) => resource.key.trim());
            if (keys.some((key) => !/^[a-z0-9][a-z0-9_-]*$/.test(key)) || new Set(keys).size !== keys.length) {
                setError("Cada recurso necesita un identificador interno único, en minúsculas y sin espacios.");
                return false;
            }
            if (draft.resources.some((resource) => resource.maximum === undefined || resource.current === undefined || resource.current > resource.maximum)) {
                setError("Cada recurso necesita máximo y valor actual; el actual no puede superar el máximo.");
                return false;
            }
        }
        return true;
    }
    function goNext() {
        if (validateStep())
            setStep((current) => Math.min(STEPS.length - 1, current + 1));
    }
    async function submit() {
        try {
            setError(null);
            const parsed = mysticArtifactDefinitionInputSchema.parse(draft);
            setSaving(true);
            await onSave(parsed);
        }
        catch (submitError) {
            setError(describeValidationError(submitError));
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: "panel modal-panel mystic-artifact-wizard", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions mystic-artifact-wizard__header", children: [_jsxs("div", { children: [_jsx("h3", { children: title }), _jsxs("p", { className: "section-help", children: ["Paso ", step + 1, " de ", STEPS.length, ": ", STEPS[step]] })] }), _jsx("button", { type: "button", className: "subtle-button", disabled: isBusy, onClick: onCancel, children: "Cerrar" })] }), _jsx("nav", { className: "mystic-artifact-wizard__steps", "aria-label": "Pasos del creador de artefactos", children: STEPS.map((label, index) => (_jsxs("button", { type: "button", className: `${index === step ? "is-active" : ""}${index < step ? " is-complete" : ""}`, disabled: isBusy || index > step + 1, onClick: () => {
                        if (index < step || validateStep())
                            setStep(index);
                    }, children: [_jsx("span", { children: index + 1 }), label] }, label))) }), (error || externalError) ? _jsx("p", { className: "error-text", children: error || externalError }) : null, _jsxs("div", { className: "mystic-artifact-wizard__body", children: [step === 0 ? (_jsxs("section", { className: "mystic-artifact-wizard__section", children: [_jsxs("div", { className: "mystic-artifact-wizard__intro", children: [_jsx("h4", { children: "Identidad e historia" }), _jsx("p", { className: "section-help", children: "Define qu\u00E9 es el artefacto y c\u00F3mo se presenta en la ficci\u00F3n. Los jugadores no ver\u00E1n esta informaci\u00F3n completa hasta vincularse." })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre *" }), _jsx("input", { autoFocus: true, value: draft.name, onChange: (event) => updateDefinition({ name: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo *" }), _jsxs("select", { value: draft.kind, onChange: (event) => changeKind(event.target.value), children: [_jsx("option", { value: "object", children: "Objeto" }), _jsx("option", { value: "weapon", children: "Arma" }), _jsx("option", { value: "armor", children: "Armadura" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Libro o aventura" }), _jsx("input", { value: draft.sourceTitle, placeholder: "Creaci\u00F3n de campa\u00F1a", onChange: (event) => updateDefinition({ sourceTitle: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "P\u00E1gina" }), _jsx("input", { type: "number", min: 1, value: draft.sourcePage ?? "", onChange: (event) => updateDefinition({ sourcePage: numberOrUndefined(event.target.value) }) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Descripci\u00F3n narrativa" }), _jsx("textarea", { rows: 9, value: draft.description, placeholder: "Aspecto, origen, leyendas, anteriores propietarios...", onChange: (event) => updateDefinition({ description: event.target.value }) })] })] })) : null, step === 1 ? (_jsxs("section", { className: "mystic-artifact-wizard__section", children: [_jsxs("div", { className: "mystic-artifact-wizard__intro", children: [_jsx("h4", { children: "V\u00EDnculo y perfil principal" }), _jsx("p", { className: "section-help", children: "Configura el precio del v\u00EDnculo y, si corresponde, c\u00F3mo funciona como arma o armadura." })] }), _jsxs("div", { className: "mystic-artifact-wizard__subsection", children: [_jsx("h5", { children: "Opciones de pago" }), ["xp", "permanent_corruption"].map((paymentType) => {
                                        const cost = draft.bindingCosts.find((entry) => entry.paymentType === paymentType);
                                        return _jsxs("div", { className: "mystic-artifact-wizard__toggle-row", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: Boolean(cost), onChange: (event) => togglePayment(paymentType, event.target.checked) }), " ", paymentType === "xp" ? "Permitir pago con PX" : "Permitir pago con Corrupción permanente"] }), cost ? _jsxs("label", { className: "field compact", children: [_jsx("span", { children: "Cantidad" }), _jsx("input", { type: "number", min: 0, max: 1000, value: cost.amount, onChange: (event) => updatePayment(paymentType, Number(event.target.value)) })] }) : null] }, paymentType);
                                    })] }), draft.kind === "weapon" && draft.weapon ? (_jsxs("div", { className: "mystic-artifact-wizard__subsection", children: [_jsx("h5", { children: "Perfil de arma" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo de ataque" }), _jsx("select", { value: draft.weapon.attackAttribute, onChange: (event) => updateDefinition({ weapon: { ...draft.weapon, attackAttribute: event.target.value } }), children: ATTRIBUTES.map((attribute) => _jsx("option", { value: attribute, children: ATTRIBUTE_LABELS[attribute] }, attribute)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tirada de ataque" }), _jsx("input", { value: draft.weapon.attackFormula, onChange: (event) => updateDefinition({ weapon: { ...draft.weapon, attackFormula: event.target.value } }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o" }), _jsx("input", { value: draft.weapon.damageFormula, placeholder: "1D8", onChange: (event) => updateDefinition({ weapon: { ...draft.weapon, damageFormula: event.target.value } }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cualidades, separadas por comas" }), _jsx("input", { value: draft.weapon.qualities.join(", "), onChange: (event) => updateDefinition({ weapon: { ...draft.weapon, qualities: splitQualities(event.target.value) } }) })] })] }), _jsxs("div", { className: "mystic-artifact-wizard__checks", children: [_jsx("span", { children: "Categor\u00EDas" }), WEAPON_TAGS.map(([tag, label]) => _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: draft.weapon.tags.includes(tag), onChange: (event) => updateDefinition({ weapon: { ...draft.weapon, tags: event.target.checked ? [...draft.weapon.tags, tag] : draft.weapon.tags.filter((entry) => entry !== tag) } }) }), " ", label] }, tag))] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: draft.weapon.requiresBinding, onChange: (event) => updateDefinition({ weapon: { ...draft.weapon, requiresBinding: event.target.checked } }) }), " Solo puede usarse como arma despu\u00E9s del v\u00EDnculo"] })] })) : null, draft.kind === "armor" && draft.armor ? (_jsxs("div", { className: "mystic-artifact-wizard__subsection", children: [_jsx("h5", { children: "Perfil de armadura" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Protecci\u00F3n" }), _jsx("input", { value: draft.armor.protectionFormula, placeholder: "1D4", onChange: (event) => updateDefinition({ armor: { ...draft.armor, protectionFormula: event.target.value } }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cualidades, separadas por comas" }), _jsx("input", { value: draft.armor.qualities.join(", "), onChange: (event) => updateDefinition({ armor: { ...draft.armor, qualities: splitQualities(event.target.value) } }) })] })] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: draft.armor.requiresBinding, onChange: (event) => updateDefinition({ armor: { ...draft.armor, requiresBinding: event.target.checked } }) }), " Solo puede usarse como armadura despu\u00E9s del v\u00EDnculo"] })] })) : null] })) : null, step === 2 ? (_jsxs("section", { className: "mystic-artifact-wizard__section", children: [_jsxs("div", { className: "row-actions mystic-artifact-wizard__intro", children: [_jsxs("div", { children: [_jsx("h4", { children: "Recursos y medidores" }), _jsx("p", { className: "section-help", children: "A\u00F1ade cargas, gotas, energ\u00EDa u otros recursos consumidos por las capacidades. Este paso es opcional." })] }), _jsx("button", { type: "button", onClick: () => updateDefinition({ resources: [...draft.resources, emptyResource(draft.resources.length)] }), children: "A\u00F1adir recurso" })] }), _jsxs("div", { className: "mystic-artifact-wizard__stack", children: [draft.resources.map((resource, index) => _jsxs("article", { className: "mystic-artifact-wizard__item", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("h5", { children: ["Recurso ", index + 1] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => updateDefinition({ resources: draft.resources.filter((_, resourceIndex) => resourceIndex !== index), abilities: draft.abilities.map((ability) => ({ ...ability, resourceCosts: ability.resourceCosts.filter((cost) => cost.resourceKey !== resource.key) })) }), children: "Quitar" })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: resource.name, onChange: (event) => renameResource(index, event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Referencia variable" }), _jsx("input", { value: resource.suggestedMaxFormula, placeholder: "Ej. 1D10 gotas", onChange: (event) => updateResource(index, { suggestedMaxFormula: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "M\u00E1ximo num\u00E9rico" }), _jsx("input", { type: "number", min: 0, max: 9999, value: resource.maximum ?? "", onChange: (event) => updateResource(index, { maximum: numberOrUndefined(event.target.value) }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Valor actual" }), _jsx("input", { type: "number", min: 0, max: resource.maximum ?? 9999, value: resource.current ?? "", onChange: (event) => updateResource(index, { current: numberOrUndefined(event.target.value) }) })] })] })] }, `${resource.key}-${index}`)), draft.resources.length === 0 ? _jsx("p", { className: "section-help", children: "Este artefacto no utiliza medidores." }) : null] })] })) : null, step === 3 ? (_jsxs("section", { className: "mystic-artifact-wizard__section", children: [_jsxs("div", { className: "row-actions mystic-artifact-wizard__intro", children: [_jsxs("div", { children: [_jsx("h4", { children: "Capacidades" }), _jsx("p", { className: "section-help", children: "Define qu\u00E9 puede hacer el artefacto, qu\u00E9 cuesta activarlo y qu\u00E9 tiradas o requisitos utiliza." })] }), _jsx("button", { type: "button", onClick: () => updateDefinition({ abilities: [...draft.abilities, emptyAbility()] }), children: "A\u00F1adir capacidad" })] }), _jsxs("div", { className: "mystic-artifact-wizard__stack", children: [draft.abilities.map((ability, abilityIndex) => _jsxs("article", { className: "mystic-artifact-wizard__item is-ability", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h5", { children: ability.name || `Capacidad ${abilityIndex + 1}` }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => updateDefinition({ abilities: draft.abilities.filter((_, index) => index !== abilityIndex) }), children: "Quitar capacidad" })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre *" }), _jsx("input", { value: ability.name, onChange: (event) => updateAbility(abilityIndex, { name: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsxs("select", { value: ability.activation, onChange: (event) => updateAbility(abilityIndex, { activation: event.target.value }), children: [_jsx("option", { value: "active", children: "Activa" }), _jsx("option", { value: "passive", children: "Pasiva" }), _jsx("option", { value: "triggered", children: "Desencadenada" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Acci\u00F3n" }), _jsxs("select", { value: ability.actionCost ?? "", onChange: (event) => updateAbility(abilityIndex, { actionCost: (event.target.value || undefined) }), children: [_jsx("option", { value: "", children: "No aplicable" }), _jsx("option", { value: "free", children: "Gratuita" }), _jsx("option", { value: "movement", children: "Movimiento" }), _jsx("option", { value: "combat", children: "Combate" }), _jsx("option", { value: "reaction", children: "Reacci\u00F3n" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Corrupci\u00F3n por uso" }), _jsx("input", { value: ability.corruptionFormula, placeholder: "1D4 o Ninguna", onChange: (event) => updateAbility(abilityIndex, { corruptionFormula: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "L\u00EDmite por escena" }), _jsx("input", { type: "number", min: 1, value: ability.perSceneLimit ?? "", placeholder: "Sin l\u00EDmite", onChange: (event) => updateAbility(abilityIndex, { perSceneLimit: numberOrUndefined(event.target.value) }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nota del l\u00EDmite" }), _jsx("input", { value: ability.perSceneNote, onChange: (event) => updateAbility(abilityIndex, { perSceneNote: event.target.value }) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Descripci\u00F3n y efecto" }), _jsx("textarea", { rows: 4, value: ability.description, onChange: (event) => updateAbility(abilityIndex, { description: event.target.value }) })] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: ability.requiresBinding, onChange: (event) => updateAbility(abilityIndex, { requiresBinding: event.target.checked }) }), " Requiere v\u00EDnculo para utilizarse"] }), _jsxs("div", { className: "mystic-artifact-wizard__nested", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h6", { children: "Tiradas ordenadas" }), _jsx("button", { type: "button", onClick: () => updateAbility(abilityIndex, { rolls: [...ability.rolls, emptyRoll()] }), children: "A\u00F1adir tirada" })] }), ability.rolls.map((roll, rollIndex) => _jsxs("div", { className: "mystic-artifact-wizard__nested-item", children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Clase" }), _jsxs("select", { value: roll.kind, onChange: (event) => updateRoll(abilityIndex, rollIndex, { kind: event.target.value }), children: [_jsx("option", { value: "check", children: "Prueba" }), _jsx("option", { value: "attack", children: "Ataque" }), _jsx("option", { value: "damage", children: "Da\u00F1o" }), _jsx("option", { value: "armor", children: "Armadura" }), _jsx("option", { value: "healing", children: "Curaci\u00F3n" }), _jsx("option", { value: "custom", children: "Personalizada" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Etiqueta" }), _jsx("input", { value: roll.label, onChange: (event) => updateRoll(abilityIndex, rollIndex, { label: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "F\u00F3rmula" }), _jsx("input", { value: roll.formula, placeholder: "1D20, 1D8...", onChange: (event) => updateRoll(abilityIndex, rollIndex, { formula: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo propio" }), _jsxs("select", { value: roll.actorAttribute ?? "", onChange: (event) => updateRoll(abilityIndex, rollIndex, { actorAttribute: (event.target.value || undefined) }), children: [_jsx("option", { value: "", children: "Ninguno" }), ATTRIBUTES.map((attribute) => _jsx("option", { value: attribute, children: ATTRIBUTE_LABELS[attribute] }, attribute))] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo enfrentado" }), _jsxs("select", { value: roll.opponentAttribute ?? "", onChange: (event) => updateRoll(abilityIndex, rollIndex, { opponentAttribute: (event.target.value || undefined) }), children: [_jsx("option", { value: "", children: "Ninguno" }), ATTRIBUTES.map((attribute) => _jsx("option", { value: attribute, children: ATTRIBUTE_LABELS[attribute] }, attribute))] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Objetivo fijo" }), _jsx("input", { type: "number", min: 1, max: 99, value: roll.fixedTarget ?? "", onChange: (event) => updateRoll(abilityIndex, rollIndex, { fixedTarget: numberOrUndefined(event.target.value) }) })] })] }), _jsx("button", { type: "button", className: "text-button", onClick: () => updateAbility(abilityIndex, { rolls: ability.rolls.filter((_, index) => index !== rollIndex) }), children: "Quitar tirada" })] }, rollIndex))] }), _jsxs("div", { className: "mystic-artifact-wizard__nested", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h6", { children: "Requisitos" }), _jsx("button", { type: "button", onClick: () => updateAbility(abilityIndex, { requirements: [...ability.requirements, emptyRequirement()] }), children: "A\u00F1adir requisito" })] }), ability.requirements.map((requirement, requirementIndex) => _jsxs("div", { className: "mystic-artifact-wizard__nested-item", children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsxs("select", { value: requirement.type, onChange: (event) => updateRequirement(abilityIndex, requirementIndex, event.target.value === "capability" ? { type: "capability", capabilityName: "", minimumLevel: "principiante", description: "" } : { type: "narrative", capabilityName: "", description: "" }), children: [_jsx("option", { value: "capability", children: "Habilidad comprobable" }), _jsx("option", { value: "narrative", children: "Condici\u00F3n narrativa" })] })] }), requirement.type === "capability" ? _jsxs(_Fragment, { children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Habilidad necesaria" }), _jsx("input", { value: requirement.capabilityName, onChange: (event) => updateRequirement(abilityIndex, requirementIndex, { ...requirement, capabilityName: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nivel m\u00EDnimo" }), _jsxs("select", { value: requirement.minimumLevel ?? "", onChange: (event) => updateRequirement(abilityIndex, requirementIndex, { ...requirement, minimumLevel: (event.target.value || undefined) }), children: [_jsx("option", { value: "", children: "Cualquiera" }), _jsx("option", { value: "principiante", children: "Principiante" }), _jsx("option", { value: "adepto", children: "Adepto" }), _jsx("option", { value: "maestro", children: "Maestro" })] })] })] }) : null, _jsxs("label", { className: "field", children: [_jsx("span", { children: requirement.type === "narrative" ? "Condición" : "Explicación" }), _jsx("input", { value: requirement.description, onChange: (event) => updateRequirement(abilityIndex, requirementIndex, { ...requirement, description: event.target.value }) })] })] }), _jsx("button", { type: "button", className: "text-button", onClick: () => updateAbility(abilityIndex, { requirements: ability.requirements.filter((_, index) => index !== requirementIndex) }), children: "Quitar requisito" })] }, requirementIndex))] }), draft.resources.length > 0 ? _jsxs("div", { className: "mystic-artifact-wizard__nested", children: [_jsx("h6", { children: "Consumo de recursos" }), draft.resources.map((resource) => {
                                                        const cost = ability.resourceCosts.find((entry) => entry.resourceKey === resource.key);
                                                        return _jsxs("div", { className: "mystic-artifact-wizard__toggle-row", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: Boolean(cost), onChange: (event) => updateAbility(abilityIndex, { resourceCosts: event.target.checked ? [...ability.resourceCosts, { resourceKey: resource.key, amount: 1 }] : ability.resourceCosts.filter((entry) => entry.resourceKey !== resource.key) }) }), " Consume ", resource.name] }), cost ? _jsxs("label", { className: "field compact", children: [_jsx("span", { children: "Cantidad" }), _jsx("input", { type: "number", min: 1, max: 999, value: cost.amount, onChange: (event) => updateAbility(abilityIndex, { resourceCosts: ability.resourceCosts.map((entry) => entry.resourceKey === resource.key ? { ...entry, amount: Math.max(1, Number(event.target.value) || 1) } : entry) }) })] }) : null] }, resource.key);
                                                    })] }) : null] }, abilityIndex)), draft.abilities.length === 0 ? _jsx("p", { className: "section-help", children: "Este artefacto no tiene capacidades propias. A\u00FAn puede funcionar como arma o armadura." }) : null] })] })) : null] }), _jsxs("footer", { className: "mystic-artifact-wizard__footer", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: isBusy || step === 0, onClick: () => { setError(null); setStep((current) => Math.max(0, current - 1)); }, children: "Anterior" }), _jsx("span", { className: "meta-text", children: draft.name || "Artefacto sin nombre" }), step < STEPS.length - 1
                        ? _jsxs("button", { type: "button", disabled: isBusy, onClick: goNext, children: ["Siguiente: ", STEPS[step + 1]] })
                        : _jsx("button", { type: "button", disabled: isBusy, onClick: () => void submit(), children: isBusy ? "Guardando..." : "Guardar artefacto" })] })] }));
}
