import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, MONSTER_ATTRIBUTE_KEYS, MONSTER_ATTRIBUTE_LABELS, SYMBAROUM_ABILITIES, SYMBAROUM_ARCHETYPES, SYMBAROUM_CULTURES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RACES, SYMBAROUM_RITUALS, averageDiceFormula, applyExceptionalAttributeBonuses, getActorBurdenBonus, getActorChallengeFromXp, getActorSpentXp, isProfessionExclusiveBenefit, isExceptionalAttributeSelection, removeExceptionalAttributeBonuses, synchronizeExceptionalAttributes, validateCreationAttributes, validateExceptionalAttributeSelections } from "@umbra/shared";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ALL_ENTRIES, SYMBAROUM_BLESSINGS, SYMBAROUM_BURDENS, SYMBAROUM_CHARACTER_TRAITS } from "../models/compendiumEntries";
import { ITEM_CATALOG } from "../models/itemCatalog";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useConfirmationDialog } from "./ConfirmationDialogProvider";
function WizardShell(props) {
    useBodyScrollLock(true);
    const isLast = props.step === props.steps.length - 1;
    return (_jsxs("section", { className: "actor-wizard", role: "dialog", "aria-modal": "true", "aria-label": props.title, onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "actor-wizard__header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Creador por fases" }), _jsx("h2", { children: props.title })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: props.onCancel, children: "Cerrar" })] }), _jsx("nav", { className: "actor-wizard__steps", "aria-label": "Fases de creaci\u00F3n", children: props.steps.map((item, index) => (_jsxs("button", { type: "button", className: index === props.step ? "is-active" : index < props.step ? "is-complete" : "", "aria-current": index === props.step ? "step" : undefined, onClick: () => props.onStep(index), children: [_jsx("span", { children: index + 1 }), item.label] }, item.id))) }), _jsx("aside", { className: "actor-wizard__summary", children: props.summary }), props.error ? _jsx("p", { className: "error actor-wizard__error", children: props.error }) : null, _jsx("div", { className: "actor-wizard__body", children: props.children }), _jsxs("footer", { className: "actor-wizard__footer", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: props.onPrevious, disabled: props.step === 0, children: "Anterior" }), _jsxs("span", { className: "meta-text", children: ["Paso ", props.step + 1, " de ", props.steps.length] }), isLast ? (_jsx("button", { type: "button", onClick: props.onSave, disabled: props.busy, children: props.busy ? "Guardando..." : "Guardar" })) : (_jsx("button", { type: "button", onClick: props.onNext, children: "Siguiente" }))] })] }));
}
function normalize(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function parsePriceToOrtegs(value) {
    const match = String(value ?? "").toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(taler|chelin|orteg)/);
    if (!match)
        return null;
    const amount = Number(match[1].replace(",", "."));
    if (!Number.isFinite(amount))
        return null;
    if (match[2].startsWith("taler"))
        return Math.round(amount * 100);
    if (match[2].startsWith("chelin"))
        return Math.round(amount * 10);
    return Math.round(amount);
}
function formatOrtegs(value) {
    const normalized = Math.max(0, Math.floor(value));
    const taleros = Math.floor(normalized / 100);
    const chelines = Math.floor((normalized % 100) / 10);
    const ortegs = normalized % 10;
    return [taleros ? `${taleros} tálero${taleros === 1 ? "" : "s"}` : "", chelines ? `${chelines} chelín${chelines === 1 ? "" : "es"}` : "", ortegs ? `${ortegs} orteg${ortegs === 1 ? "" : "s"}` : ""]
        .filter(Boolean).join(", ") || "0 ortegs";
}
function makeInventoryItem(template, origin, index) {
    return {
        ...template,
        id: `creation-${origin}-${template.templateId}-${Date.now()}-${index}`,
        quantity: template.defaultQuantity ?? 1,
        equipped: template.slot !== "none",
        notes: [`Origen de creación: ${origin}.`, template.notes].filter(Boolean).join("\n")
    };
}
const RATED_TRAIT_NAMES = new Set(["robusto", "superviviente", "cambiaformas", "memoria racial"]);
const RACIAL_RECOMMENDATIONS = {
    humano: [{ name: "Contactos", kind: "bendicion" }, { name: "Privilegiado", kind: "bendicion" }, { name: "Montés", kind: "bendicion" }],
    trocalengo: [{ name: "Longevo", kind: "rasgo_personaje" }, { name: "Cambiaformas", kind: "rasgo_nivelado" }],
    ogro: [{ name: "Longevo", kind: "rasgo_personaje" }, { name: "Paria", kind: "carga" }, { name: "Robusto", kind: "rasgo_nivelado" }],
    trasgo: [{ name: "Poco longevo", kind: "rasgo_personaje" }, { name: "Paria", kind: "carga" }, { name: "Superviviente", kind: "rasgo_nivelado" }],
    elfo: [{ name: "Longevo", kind: "rasgo_personaje" }, { name: "Paria", kind: "carga" }, { name: "Memoria racial", kind: "rasgo_nivelado" }],
    enano: [{ name: "Vínculo terrenal", kind: "rasgo_personaje" }, { name: "Memoria absoluta", kind: "bendicion" }, { name: "Paria", kind: "carga" }],
    troll: [{ name: "Longevo", kind: "rasgo_personaje" }, { name: "Paria", kind: "carga" }]
};
function getRacialRecommendations(race) {
    return RACIAL_RECOMMENDATIONS[normalize(race)] ?? [];
}
function buildLegacySelections(sheet) {
    if (sheet.capabilitySelections.length > 0)
        return sheet.capabilitySelections;
    return [
        ...sheet.habilidades.map((entry) => ({ catalogId: `habilidad-${normalize(entry.nombre).replace(/\s+/g, "-")}`, name: entry.nombre, kind: (RATED_TRAIT_NAMES.has(normalize(entry.nombre)) ? "rasgo_nivelado" : "habilidad"), level: entry.nivel, origin: "legado", source: entry.fuente, page: entry.pagina })),
        ...sheet.poderesMisticos.map((entry) => ({ catalogId: `poder_mistico-${normalize(entry.nombre).replace(/\s+/g, "-")}`, name: entry.nombre, kind: "poder_mistico", level: entry.nivel, origin: "legado", source: entry.fuente, page: entry.pagina })),
        ...sheet.rituales.map((entry) => ({ catalogId: `ritual-${normalize(entry.nombre).replace(/\s+/g, "-")}`, name: entry.nombre, kind: "ritual", level: "principiante", origin: "legado", source: entry.fuente, page: entry.pagina })),
        ...sheet.bendiciones.map((name) => ({ catalogId: `bendicion-${normalize(name).replace(/\s+/g, "-")}`, name, kind: "bendicion", origin: "legado", source: "" })),
        ...sheet.cargas.map((name) => ({ catalogId: `carga-${normalize(name).replace(/\s+/g, "-")}`, name, kind: "carga", origin: "legado", source: "" })),
        ...sheet.rasgos.map((name) => ({ catalogId: `rasgo-personaje-${normalize(name).replace(/\s+/g, "-")}`, name, kind: "rasgo_personaje", origin: "legado", source: "" }))
    ];
}
function getCharacterCatalog(race, selections) {
    const hasDarkBlood = selections.some((entry) => normalize(entry.name) === "sangre oscura");
    const monsterAllowed = normalize(race) === "troll" || hasDarkBlood;
    const normalCapabilities = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS].filter((entry) => !isProfessionExclusiveBenefit(entry.nombre)).map((entry) => ({
        id: entry.id,
        name: entry.nombre,
        kind: RATED_TRAIT_NAMES.has(normalize(entry.nombre)) ? "rasgo_nivelado" : entry.tipo,
        source: entry.libro,
        page: entry.pagina,
        effect: entry.efectoResumen
    }));
    const simple = [
        ...SYMBAROUM_BLESSINGS.map((entry) => ({ id: entry.id, name: entry.nombre, kind: "bendicion", source: entry.fuente, page: entry.pagina, effect: entry.resumen })),
        ...SYMBAROUM_BURDENS.map((entry) => ({ id: entry.id, name: entry.nombre, kind: "carga", source: entry.fuente, page: entry.pagina, effect: entry.resumen })),
        ...SYMBAROUM_CHARACTER_TRAITS.map((entry) => ({ id: entry.id, name: entry.nombre, kind: "rasgo_personaje", source: entry.fuente, page: entry.pagina, effect: entry.resumen })),
        { id: "rasgo-nivelado-superviviente", name: "Superviviente", kind: "rasgo_nivelado", source: "Libro Básico", page: 111 },
        { id: "rasgo-nivelado-memoria-racial", name: "Memoria racial", kind: "rasgo_nivelado", source: "Guía Avanzada del Jugador", page: 49 }
    ];
    const monsterTraits = monsterAllowed
        ? ALL_ENTRIES.filter((entry) => entry.tipo === "rasgo" && ["arma natural", "duro", "robusto", "regeneracion", "alado", "armadura"].includes(normalize(entry.nombre)))
            .map((entry) => ({ id: entry.id, name: entry.nombre, kind: "rasgo_monstruoso", source: entry.fuente, page: entry.pagina, effect: entry.resumen }))
        : [];
    return [...normalCapabilities, ...simple, ...monsterTraits].filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index);
}
function updateLegacyCollections(sheet, selections) {
    const ratedByName = new Map([...sheet.habilidades, ...sheet.poderesMisticos, ...sheet.rituales].map((entry) => [normalize(entry.nombre), entry]));
    const toRated = (entry) => {
        const legacy = ratedByName.get(normalize(entry.name));
        const catalog = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS].find((item) => item.id === entry.catalogId);
        return {
            nombre: entry.name,
            tipo: entry.kind,
            efecto: legacy?.efecto ?? catalog?.efectoResumen ?? "",
            nivel: entry.level ?? "principiante",
            fuente: entry.source,
            pagina: entry.page,
            notas: legacy?.notas ?? catalog?.efectoResumen ?? "",
            acciones: legacy?.acciones ?? catalog?.acciones ?? []
        };
    };
    return {
        ...sheet,
        capabilitySelections: selections,
        habilidades: selections.filter((entry) => ["habilidad", "rasgo_nivelado", "rasgo_monstruoso"].includes(entry.kind)).map(toRated),
        poderesMisticos: selections.filter((entry) => entry.kind === "poder_mistico").map(toRated),
        rituales: selections.filter((entry) => entry.kind === "ritual").map(toRated),
        bendiciones: selections.filter((entry) => entry.kind === "bendicion").map((entry) => entry.name),
        cargas: selections.filter((entry) => entry.kind === "carga").map((entry) => entry.name),
        rasgos: selections.filter((entry) => entry.kind === "rasgo_personaje").map((entry) => entry.name)
    };
}
export function CharacterCreationWizard({ controller, onCancel }) {
    const confirm = useConfirmationDialog();
    const steps = [
        { id: "identity", label: "Identidad" }, { id: "attributes", label: "Atributos" }, { id: "capabilities", label: "Capacidades" }, { id: "equipment", label: "Equipo" }, { id: "background", label: "Trasfondo" }
    ];
    const [step, setStep] = useState(0);
    const [localError, setLocalError] = useState(null);
    const [query, setQuery] = useState("");
    const [kind, setKind] = useState("all");
    const [equipmentQuery, setEquipmentQuery] = useState("");
    const initialRef = useRef(JSON.stringify(controller.form));
    const sheet = controller.form.sheet;
    const selections = useMemo(() => buildLegacySelections(sheet), [sheet]);
    const baseAttributes = removeExceptionalAttributeBonuses(sheet.atributos, selections);
    const experience = getCharacterExperienceSummary({ ...sheet, capabilitySelections: selections }, { includeBurdenBonus: !controller.isEditing });
    const racial = getRacialRecommendations(sheet.identidad.raza);
    const catalog = useMemo(() => getCharacterCatalog(sheet.identidad.raza, selections), [sheet.identidad.raza, selections]);
    const filteredCatalog = catalog.filter((entry) => {
        if (kind !== "all" && entry.kind !== kind)
            return false;
        const needle = normalize(query);
        return !needle || normalize(`${entry.name} ${entry.source} ${entry.effect ?? ""}`).includes(needle);
    }).slice(0, 80);
    useEffect(() => {
        if (sheet.capabilitySelections.length === 0 && selections.length > 0) {
            controller.setForm((current) => ({ ...current, sheet: updateLegacyCollections(current.sheet, selections) }));
        }
    }, []);
    useEffect(() => {
        if (controller.isEditing || sheet.inventoryItems.length > 0)
            return;
        const baseIds = ["weapon-dagger", "armor-light", "gear-sack", "gear-bedroll", "gear-flint-steel", "gear-rations", "gear-waterskin"];
        const baseItems = baseIds.map((id, index) => ITEM_CATALOG.find((entry) => entry.templateId === id) ? makeInventoryItem(ITEM_CATALOG.find((entry) => entry.templateId === id), "inicial", index) : null).filter(Boolean);
        controller.setForm((current) => ({
            ...current,
            sheet: {
                ...current.sheet,
                equipo: Array.from(new Set([...current.sheet.equipo, ...baseItems.map((entry) => entry.name)])),
                inventoryItems: baseItems,
                recursos: { ...current.sheet.recursos, dinero: getStartingMoneyLabel(current.sheet.capabilitySelections) }
            }
        }));
    }, [controller.isEditing]);
    function getStartingWallet(list = selections) {
        if (list.some((entry) => normalize(entry.name) === "privilegiado"))
            return 5000;
        if (list.some((entry) => normalize(entry.name) === "paria"))
            return 50;
        return 500;
    }
    function getStartingMoneyLabel(list = selections) { return formatOrtegs(getStartingWallet(list)); }
    const spentMoney = sheet.inventoryItems.filter((entry) => entry.notes.includes("Origen de creación: comprado"))
        .reduce((total, entry) => total + (parsePriceToOrtegs(entry.value) ?? 0) * entry.quantity, 0);
    const moneyRemaining = getStartingWallet() - spentMoney;
    function setSheet(nextSheet) {
        controller.setForm((current) => ({ ...current, name: nextSheet.identidad.nombrePersonaje, sheet: nextSheet }));
    }
    function addCapability(choice) {
        const isExceptional = normalize(choice.name) === "atributo excepcional";
        const exceptionalAttributeKey = isExceptional
            ? ATTRIBUTE_KEYS.find((key) => !selections.some((entry) => isExceptionalAttributeSelection(entry) && entry.attributeKey === key))
            : undefined;
        if (isExceptional && !exceptionalAttributeKey) {
            setLocalError("Atributo excepcional ya está adquirido para los ocho atributos.");
            return;
        }
        if (!isExceptional && selections.some((entry) => entry.catalogId === choice.id || normalize(entry.name) === normalize(choice.name))) {
            setLocalError(`${choice.name} ya está añadido.`);
            return;
        }
        const racialMatch = racial.some((entry) => normalize(entry.name) === normalize(choice.name));
        const next = {
            catalogId: choice.id, name: choice.name, kind: choice.kind,
            level: ["bendicion", "carga", "rasgo_personaje"].includes(choice.kind) ? undefined : "principiante",
            origin: racialMatch ? "racial" : choice.kind === "rasgo_personaje" ? "trasfondo" : "comprada",
            source: choice.source, page: choice.page,
            repeatable: isExceptional || undefined,
            attributeKey: exceptionalAttributeKey
        };
        const nextSelections = [...selections, next];
        const nextSheet = updateLegacyCollections({ ...sheet, atributos: synchronizeExceptionalAttributes(sheet.atributos, selections, nextSelections) }, nextSelections);
        const nextExperience = getCharacterExperienceSummary(nextSheet, { includeBurdenBonus: !controller.isEditing });
        if (nextExperience.computedSpent > nextExperience.effectiveTotal) {
            setLocalError(`No hay PX suficientes para añadir ${choice.name}.`);
            return;
        }
        setSheet({ ...nextSheet, recursos: { ...nextSheet.recursos, dinero: formatOrtegs(getStartingWallet(nextSelections) - spentMoney) } });
        setLocalError(null);
    }
    function removeCapability(index) {
        const nextSelections = selections.filter((_, currentIndex) => currentIndex !== index);
        const atributos = synchronizeExceptionalAttributes(sheet.atributos, selections, nextSelections);
        setSheet({ ...updateLegacyCollections({ ...sheet, atributos }, nextSelections), recursos: { ...sheet.recursos, dinero: formatOrtegs(getStartingWallet(nextSelections) - spentMoney) } });
    }
    function updateCapabilityLevel(index, level) {
        const nextSelections = selections.map((entry, currentIndex) => currentIndex === index ? { ...entry, level } : entry);
        const nextSheet = updateLegacyCollections({ ...sheet, atributos: synchronizeExceptionalAttributes(sheet.atributos, selections, nextSelections) }, nextSelections);
        const nextExperience = getCharacterExperienceSummary(nextSheet, { includeBurdenBonus: !controller.isEditing });
        if (nextExperience.computedSpent > nextExperience.effectiveTotal) {
            setLocalError("La mejora supera los PX disponibles.");
            return;
        }
        setSheet(nextSheet);
        setLocalError(null);
    }
    function updateExceptionalAttribute(index, attributeKey) {
        if (selections.some((entry, currentIndex) => currentIndex !== index && isExceptionalAttributeSelection(entry) && entry.attributeKey === attributeKey)) {
            setLocalError("Atributo excepcional solo puede adquirirse una vez para cada atributo.");
            return;
        }
        const nextSelections = selections.map((entry, currentIndex) => currentIndex === index ? { ...entry, attributeKey } : entry);
        const nextSheet = updateLegacyCollections({ ...sheet, atributos: synchronizeExceptionalAttributes(sheet.atributos, selections, nextSelections) }, nextSelections);
        setSheet(nextSheet);
        setLocalError(null);
    }
    function addEquipment(template, origin, grantSource = "") {
        const cost = origin === "comprado" ? parsePriceToOrtegs(template.value) : 0;
        if (cost == null) {
            setLocalError("Este objeto no tiene un precio normalizado y no puede comprarse durante la creación.");
            return;
        }
        if (cost > moneyRemaining) {
            setLocalError("No hay dinero suficiente para esta compra.");
            return;
        }
        const baseItem = makeInventoryItem(template, origin === "reliquia" ? "concedido" : origin, sheet.inventoryItems.length);
        const item = {
            ...baseItem,
            notes: [
                baseItem.notes,
                grantSource ? `Concesión de capacidad: ${grantSource}.` : "",
                origin === "reliquia" ? "Reliquia familiar de creación." : ""
            ].filter(Boolean).join("\n")
        };
        const nextItems = [...sheet.inventoryItems, item];
        const nextSpent = spentMoney + cost;
        setSheet({ ...sheet, inventoryItems: nextItems, equipo: [...sheet.equipo, template.name], recursos: { ...sheet.recursos, dinero: formatOrtegs(getStartingWallet() - nextSpent) } });
        setLocalError(null);
    }
    function removeEquipment(index) {
        const nextItems = sheet.inventoryItems.filter((_, currentIndex) => currentIndex !== index);
        const nextSpent = nextItems.filter((entry) => entry.notes.includes("Origen de creación: comprado"))
            .reduce((total, entry) => total + (parsePriceToOrtegs(entry.value) ?? 0) * entry.quantity, 0);
        setSheet({ ...sheet, inventoryItems: nextItems, equipo: nextItems.map((entry) => entry.name), recursos: { ...sheet.recursos, dinero: formatOrtegs(getStartingWallet() - nextSpent) } });
    }
    function validateStep(index) {
        setLocalError(null);
        if (index === 0 && sheet.identidad.nombrePersonaje.trim().length < 2) {
            setLocalError("El personaje necesita un nombre de al menos dos caracteres.");
            return false;
        }
        if (index === 1) {
            const validation = validateCreationAttributes(baseAttributes);
            if (!validation.valid) {
                setLocalError(validation.errors.join(" "));
                return false;
            }
        }
        if (index === 2) {
            const exceptionalErrors = validateExceptionalAttributeSelections(selections, ATTRIBUTE_KEYS);
            if (exceptionalErrors.length > 0) {
                setLocalError(exceptionalErrors.join(" "));
                return false;
            }
            if (experience.computedSpent > experience.effectiveTotal) {
                setLocalError("Las capacidades superan los PX disponibles.");
                return false;
            }
        }
        if (index === 3) {
            const hasWeaponBeyondDagger = sheet.inventoryItems.some((entry) => entry.category === "weapon" && normalize(entry.name) !== "daga");
            if (!hasWeaponBeyondDagger) {
                setLocalError("Elige el arma inicial del personaje antes de continuar.");
                return false;
            }
            if (moneyRemaining < 0) {
                setLocalError("Las compras superan el dinero inicial.");
                return false;
            }
        }
        return true;
    }
    function validateThrough(index) {
        for (let current = 0; current <= index; current += 1) {
            if (!validateStep(current))
                return false;
        }
        return true;
    }
    async function close() {
        if (JSON.stringify(controller.form) !== initialRef.current && !await confirm({
            title: "Descartar cambios",
            message: "Hay cambios sin guardar. Si cierras el creador, se perderán.",
            confirmLabel: "Cerrar sin guardar",
            tone: "danger"
        }))
            return;
        onCancel();
    }
    async function save() {
        if (!validateThrough(steps.length - 1))
            return;
        const nextSheet = {
            ...sheet,
            progreso: {
                ...sheet.progreso,
                experienciaTotal: controller.isEditing ? sheet.progreso.experienciaTotal : experience.effectiveTotal,
                experienciaGastada: Math.max(sheet.progreso.experienciaGastada, experience.computedSpent)
            },
            recursos: { ...sheet.recursos, dinero: formatOrtegs(moneyRemaining) }
        };
        setSheet(nextSheet);
        const saved = await controller.submit({ ...controller.form, sheet: nextSheet });
        if (!saved)
            return;
    }
    const availableEquipment = ITEM_CATALOG.filter((entry) => normalize(`${entry.name} ${entry.category} ${entry.qualities}`).includes(normalize(equipmentQuery))).slice(0, 80);
    const abilityNames = new Set(selections.map((entry) => normalize(entry.name)));
    const grants = [];
    if (abilityNames.has("armas a dos manos"))
        grants.push({ label: "Arma pesada", templateId: "weapon-heavy", source: "Armas a dos manos" });
    if (abilityNames.has("armas de asta"))
        grants.push({ label: "Lanza", templateId: "weapon-long", source: "Armas de asta" });
    if (abilityNames.has("combate con escudo"))
        grants.push({ label: "Escudo", templateId: "weapon-shield", source: "Combate con escudo" });
    if (abilityNames.has("combate con armadura"))
        grants.push({ label: "Armadura media", templateId: "armor-medium", source: "Combate con armadura" });
    if (abilityNames.has("tirador"))
        grants.push({ label: "Arco", templateId: "weapon-bow", source: "Tirador" });
    if (abilityNames.has("viento de acero"))
        grants.push({ label: "Arma arrojadiza", templateId: "weapon-thrown", source: "Viento de acero" });
    if (abilityNames.has("martillo de monstruos"))
        grants.push({ label: "Arma de una mano", templateId: "weapon-single-handed", source: "Martillo de monstruos" });
    const weaponGrants = grants.filter((grant) => ITEM_CATALOG.find((entry) => entry.templateId === grant.templateId)?.category === "weapon");
    const hasFamilyRelic = abilityNames.has("reliquia familiar");
    const hasClaimedFamilyRelic = sheet.inventoryItems.some((entry) => entry.notes.includes("Reliquia familiar de creación"));
    useEffect(() => {
        const validSources = new Set(grants.map((grant) => normalize(grant.source)));
        const nextItems = sheet.inventoryItems.filter((entry) => {
            const source = entry.notes.match(/Concesión de capacidad:\s*([^\.]+)\./i)?.[1];
            if (source && !validSources.has(normalize(source)))
                return false;
            if (entry.notes.includes("Reliquia familiar de creación") && !hasFamilyRelic)
                return false;
            return true;
        });
        if (nextItems.length !== sheet.inventoryItems.length) {
            setSheet({ ...sheet, inventoryItems: nextItems, equipo: nextItems.map((entry) => entry.name) });
            setLocalError("Una concesión de equipo dejó de ser válida. Elige de nuevo el equipo inicial.");
        }
    }, [selections.map((entry) => `${entry.catalogId}:${entry.level}`).join("|")]);
    return (_jsxs(WizardShell, { title: controller.isEditing ? "Editar personaje" : "Crear personaje", steps: steps, step: step, onStep: (index) => { if (index <= step || validateThrough(index - 1))
            setStep(index); }, onPrevious: () => setStep((current) => Math.max(0, current - 1)), onNext: () => { if (validateStep(step))
            setStep((current) => Math.min(steps.length - 1, current + 1)); }, onCancel: close, onSave: () => void save(), busy: controller.isSaving, error: localError ?? controller.error, summary: _jsxs(_Fragment, { children: [_jsxs("span", { children: ["PX inicial ", _jsx("strong", { children: sheet.identidad.esFamiliar ? 20 : 50 })] }), _jsxs("span", { children: ["Cargas ", _jsxs("strong", { children: ["+", getActorBurdenBonus(selections)] })] }), _jsxs("span", { children: ["Gastada ", _jsx("strong", { children: experience.computedSpent })] }), _jsxs("span", { children: ["Disponible ", _jsx("strong", { children: experience.effectiveAvailable })] })] }), children: [step === 0 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsx("h3", { children: "Identidad" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del personaje" }), _jsx("input", { value: sheet.identidad.nombrePersonaje, onChange: (event) => controller.updateSheet("identidad.nombrePersonaje", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del jugador" }), _jsx("input", { value: sheet.identidad.nombreJugador, onChange: (event) => controller.updateSheet("identidad.nombreJugador", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Raza" }), _jsx("select", { value: sheet.identidad.raza, onChange: (event) => controller.updateSheet("identidad.raza", event.target.value), children: SYMBAROUM_RACES.map((entry) => _jsx("option", { children: entry }, entry)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cultura" }), _jsx("select", { value: sheet.identidad.cultura, onChange: (event) => controller.updateSheet("identidad.cultura", event.target.value), children: SYMBAROUM_CULTURES.map((entry) => _jsx("option", { children: entry }, entry)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arquetipo" }), _jsx("select", { value: sheet.identidad.arquetipo, onChange: (event) => controller.updateSheet("identidad.arquetipo", event.target.value), children: SYMBAROUM_ARCHETYPES.map((entry) => _jsx("option", { children: entry }, entry)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ocupaci\u00F3n descriptiva" }), _jsx("input", { value: sheet.identidad.profesion, onChange: (event) => controller.updateSheet("identidad.profesion", event.target.value) })] }), _jsxs("label", { className: "checkbox-row", children: [_jsx("input", { type: "checkbox", checked: sheet.identidad.esFamiliar, onChange: (event) => { const familiar = event.target.checked; controller.setForm((current) => ({ ...current, sheet: { ...current.sheet, identidad: { ...current.sheet.identidad, esFamiliar: familiar }, progreso: { ...current.sheet.progreso, experienciaTotal: familiar ? 20 : 50 } } })); } }), _jsx("span", { children: "Es familiar (20 PX iniciales)" })] })] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Opciones raciales recomendadas:" }), " ", racial.length ? racial.map((entry) => entry.name).join(", ") : "Sin concesiones automáticas. Revísalas en el compendio.", " El usuario las confirma en Capacidades."] })] }) : null, step === 1 ? _jsx(AttributeEditor, { values: baseAttributes, labels: ATTRIBUTE_LABELS, keys: ATTRIBUTE_KEYS, bonuses: sheet.atributos, onChange: (key, value) => {
                    const nextBase = { ...baseAttributes, [key]: value };
                    setSheet({ ...sheet, atributos: applyExceptionalAttributeBonuses(nextBase, selections) });
                } }) : null, step === 2 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsx("div", { className: "row-actions", children: _jsxs("div", { children: [_jsx("h3", { children: "Capacidades" }), _jsx("p", { className: "section-help", children: "Solo pueden a\u00F1adirse entradas del cat\u00E1logo oficial. Las entradas antiguas no reconocidas se conservan como legado." })] }) }), _jsxs("div", { className: "actor-wizard__catalog-tools", children: [_jsx("input", { type: "search", placeholder: "Buscar capacidad...", value: query, onChange: (event) => setQuery(event.target.value) }), _jsxs("select", { value: kind, onChange: (event) => setKind(event.target.value), children: [_jsx("option", { value: "all", children: "Todas" }), _jsx("option", { value: "habilidad", children: "Habilidades" }), _jsx("option", { value: "poder_mistico", children: "Poderes" }), _jsx("option", { value: "ritual", children: "Rituales" }), _jsx("option", { value: "rasgo_personaje", children: "Rasgos gratuitos" }), _jsx("option", { value: "rasgo_nivelado", children: "Rasgos con nivel" }), _jsx("option", { value: "rasgo_monstruoso", children: "Rasgos monstruosos" }), _jsx("option", { value: "bendicion", children: "Bendiciones" }), _jsx("option", { value: "carga", children: "Cargas" })] })] }), _jsx("div", { className: "actor-wizard__catalog-list", children: filteredCatalog.map((entry) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsxs("span", { children: [entry.source, entry.page ? ` · p.${entry.page}` : ""] }), _jsx("small", { children: entry.effect })] }), _jsx("button", { type: "button", onClick: () => addCapability(entry), children: "A\u00F1adir" })] }, entry.id)) }), _jsx("h4", { children: "Seleccionadas" }), _jsx("div", { className: "actor-wizard__selection-list", children: selections.map((entry, index) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsxs("span", { children: [entry.kind.replaceAll("_", " "), " \u00B7 ", entry.origin] })] }), isExceptionalAttributeSelection(entry) ? _jsxs("select", { "aria-label": `Atributo para ${entry.name}`, value: entry.attributeKey ?? "", onChange: (event) => updateExceptionalAttribute(index, event.target.value), children: [_jsx("option", { value: "", disabled: true, children: "Elige atributo" }), ATTRIBUTE_KEYS.map((key) => _jsx("option", { value: key, disabled: selections.some((other, otherIndex) => otherIndex !== index && isExceptionalAttributeSelection(other) && other.attributeKey === key), children: ATTRIBUTE_LABELS[key] }, key))] }) : null, !["bendicion", "carga", "rasgo_personaje", "ritual"].includes(entry.kind) ? _jsxs("select", { value: entry.level ?? "principiante", onChange: (event) => updateCapabilityLevel(index, event.target.value), children: [_jsx("option", { value: "principiante", children: "Principiante \u00B7 10 PX" }), _jsx("option", { value: "adepto", children: "Adepto \u00B7 30 PX" }), _jsx("option", { value: "maestro", children: "Maestro \u00B7 60 PX" })] }) : null, _jsx("button", { type: "button", className: "subtle-button", onClick: () => removeCapability(index), children: "Quitar" })] }, `${entry.catalogId}-${index}`)) })] }) : null, step === 3 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Equipo inicial" }), _jsx("p", { className: "section-help", children: "La daga, la armadura ligera y el equipo de aventurero ya est\u00E1n incluidos." })] }), _jsxs("strong", { children: ["Saldo: ", formatOrtegs(moneyRemaining)] })] }), grants.length ? _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Concesiones por capacidades" }), _jsx("div", { className: "toolbar", children: grants.map((grant) => { const template = ITEM_CATALOG.find((entry) => entry.templateId === grant.templateId); const alreadyAdded = sheet.inventoryItems.some((entry) => entry.notes.includes(`Concesión de capacidad: ${grant.source}.`)); return template ? _jsx("button", { type: "button", className: "subtle-button", disabled: alreadyAdded, onClick: () => addEquipment(template, "concedido", grant.source), children: alreadyAdded ? `${grant.label} elegida` : `Añadir ${grant.label}` }, grant.templateId) : null; }) })] }) : null, weaponGrants.length === 0 ? _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Elige una combinaci\u00F3n b\u00E1sica:" }), _jsx("div", { className: "toolbar", children: ["weapon-heavy", "weapon-long", "weapon-single-handed", "weapon-ranged"].map((id) => { const template = ITEM_CATALOG.find((entry) => entry.templateId === id); return template ? _jsxs("button", { type: "button", onClick: () => addEquipment(template, "concedido"), children: ["Daga + ", template.name] }, id) : null; }) })] }) : null, _jsx("input", { type: "search", placeholder: "Buscar compras adicionales...", value: equipmentQuery, onChange: (event) => setEquipmentQuery(event.target.value) }), _jsx("div", { className: "actor-wizard__catalog-list", children: availableEquipment.map((entry) => { const price = parsePriceToOrtegs(entry.value); const canBeRelic = hasFamilyRelic && !hasClaimedFamilyRelic && (entry.category === "weapon" || entry.category === "armor") && !normalize(`${entry.qualities} ${entry.description}`).includes("mist"); return _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsxs("span", { children: [entry.value, " \u00B7 ", entry.category] }), _jsx("small", { children: entry.description })] }), _jsxs("div", { className: "toolbar", children: [canBeRelic ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => addEquipment(entry, "reliquia"), children: "Reliquia gratis" }) : null, _jsx("button", { type: "button", disabled: price == null || price > moneyRemaining, onClick: () => addEquipment(entry, "comprado"), children: "Comprar" })] })] }, entry.templateId); }) }), _jsx("h4", { children: "Inventario inicial" }), _jsx("div", { className: "actor-wizard__selection-list", children: sheet.inventoryItems.map((entry, index) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsxs("span", { children: [entry.value, " \u00B7 ", entry.notes.split("\n")[0]] })] }), _jsx("button", { type: "button", className: "subtle-button", disabled: entry.notes.includes("Origen de creación: inicial"), onClick: () => removeEquipment(index), children: "Quitar" })] }, entry.id)) })] }) : null, step === 4 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsx("h3", { children: "Trasfondo" }), _jsxs("div", { className: "form-grid", children: [["sombra", "cita", "edad", "altura", "peso"].map((field) => _jsxs("label", { className: "field", children: [_jsx("span", { children: field[0].toUpperCase() + field.slice(1) }), _jsx("input", { value: sheet.identidad[field], onChange: (event) => controller.updateSheet(`identidad.${field}`, event.target.value) })] }, field)), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Apariencia" }), _jsx("textarea", { rows: 3, value: sheet.identidad.apariencia, onChange: (event) => controller.updateSheet("identidad.apariencia", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Objetivo personal" }), _jsx("textarea", { rows: 3, value: sheet.identidad.objetivoPersonal, onChange: (event) => controller.updateSheet("identidad.objetivoPersonal", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Historia (Markdown)" }), _jsx("textarea", { rows: 7, value: sheet.identidad.trasfondo, onChange: (event) => controller.updateSheet("identidad.trasfondo", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Notas" }), _jsx("textarea", { rows: 5, value: sheet.notas, onChange: (event) => controller.updateSheet("notas", event.target.value) })] })] })] }) : null] }));
}
function AttributeEditor({ values, labels, keys, bonuses, onChange }) {
    const validation = validateCreationAttributes(values);
    return _jsxs("section", { className: "actor-wizard__section", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Atributos base" }), _jsx("p", { className: "section-help", children: "Reparte exactamente 80 puntos. Cada valor base debe estar entre 5 y 15 y solo uno puede alcanzar 15. Atributo excepcional se aplica despu\u00E9s y puede elevar distintos atributos hasta 18." })] }), _jsxs("strong", { className: validation.valid ? "is-valid" : "error", children: [validation.total, " / 80"] })] }), _jsx("div", { className: "actor-wizard__attribute-grid", children: keys.map((key) => { const effective = bonuses?.[key] ?? values[key]; const bonus = effective - values[key]; return _jsxs("label", { className: "field", children: [_jsxs("span", { children: [labels[key], bonus > 0 ? ` · final ${effective} (+${bonus})` : ""] }), _jsx("input", { type: "number", min: 5, max: 15, value: values[key], onChange: (event) => onChange(key, Number(event.target.value)) })] }, key); }) }), !validation.valid ? _jsx("p", { className: "error", children: validation.errors.join(" ") }) : null] });
}
export function NpcCreationWizard({ controller, onCancel, onSaved }) {
    const confirm = useConfirmationDialog();
    const narrative = controller.draft.depth === "notes";
    const steps = narrative ? [{ id: "identity", label: "Identidad" }, { id: "background", label: "Trasfondo" }] : [{ id: "identity", label: "Identidad" }, { id: "attributes", label: "Atributos" }, { id: "capabilities", label: "Capacidades" }, { id: "equipment", label: "Equipo" }, { id: "background", label: "Trasfondo" }];
    const [step, setStep] = useState(0);
    const [localError, setLocalError] = useState(null);
    const initialRef = useRef(JSON.stringify(controller.draft));
    const draft = controller.draft;
    const sheet = draft.sheet;
    const selections = sheet?.capabilitySelections ?? [];
    const baseAttributes = sheet ? removeExceptionalAttributeBonuses(sheet.atributos, selections) : null;
    const spent = getActorSpentXp(selections);
    const challenge = getActorChallengeFromXp(spent);
    async function close() {
        if (JSON.stringify(draft) !== initialRef.current && !await confirm({
            title: "Descartar cambios",
            message: "Hay cambios sin guardar. Si cierras el creador, se perderán.",
            confirmLabel: "Cerrar sin guardar",
            tone: "danger"
        }))
            return;
        onCancel();
    }
    function validate(index) {
        setLocalError(null);
        if (index === 0 && draft.name.trim().length < 2) {
            setLocalError("El PNJ necesita un nombre.");
            return false;
        }
        if (!narrative && index === 1 && baseAttributes) {
            const result = validateCreationAttributes(baseAttributes);
            if (!result.valid) {
                setLocalError(result.errors.join(" "));
                return false;
            }
        }
        if (!narrative && index === 2) {
            const errors = validateExceptionalAttributeSelections(selections, ATTRIBUTE_KEYS);
            if (errors.length > 0) {
                setLocalError(errors.join(" "));
                return false;
            }
        }
        return true;
    }
    function validateThrough(index) { for (let current = 0; current <= index; current += 1)
        if (!validate(current))
            return false; return true; }
    async function save() {
        if (!validateThrough(steps.length - 1))
            return;
        const saved = await controller.saveDraft();
        if (saved)
            onSaved(saved);
    }
    function setCharacterSheet(next) { controller.setDraft((current) => ({ ...current, depth: "full_sheet", sheet: next, statBlock: current.statBlock })); }
    return _jsxs(WizardShell, { title: controller.selectedNpcId ? "Editar PNJ" : "Crear PNJ", steps: steps, step: step, summary: narrative ? _jsxs(_Fragment, { children: [_jsxs("span", { children: ["Modo ", _jsx("strong", { children: "Narrativo" })] }), _jsx("span", { children: "Sin estad\u00EDsticas" })] }) : _jsxs(_Fragment, { children: [_jsxs("span", { children: ["PX usada ", _jsx("strong", { children: spent })] }), _jsxs("span", { children: ["Desaf\u00EDo ", _jsx("strong", { children: challenge })] })] }), error: localError ?? controller.formError, busy: controller.isSaving, onStep: (index) => { if (index <= step || validateThrough(index - 1))
            setStep(index); }, onPrevious: () => setStep((current) => Math.max(0, current - 1)), onNext: () => { if (validate(step))
            setStep((current) => Math.min(steps.length - 1, current + 1)); }, onCancel: close, onSave: () => void save(), children: [step === 0 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsx("h3", { children: "Identidad" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo de PNJ" }), _jsxs("select", { value: narrative ? "notes" : "full_sheet", onChange: (event) => controller.updateDepth(event.target.value), children: [_jsx("option", { value: "notes", children: "Narrativo" }), _jsx("option", { value: "full_sheet", children: "Completo" })] })] }), ["name", "race", "archetype", "occupation", "faction"].map((field) => _jsxs("label", { className: "field", children: [_jsx("span", { children: { name: "Nombre", race: "Raza", archetype: "Arquetipo", occupation: "Ocupación", faction: "Facción" }[field] }), _jsx("input", { value: draft[field], onChange: (event) => controller.updateField(field, event.target.value) })] }, field)), !narrative && sheet ? _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cultura" }), _jsx("select", { value: sheet.identidad.cultura, onChange: (event) => setCharacterSheet({ ...sheet, identidad: { ...sheet.identidad, cultura: event.target.value } }), children: SYMBAROUM_CULTURES.map((entry) => _jsx("option", { children: entry }, entry)) })] }) : null, _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Etiquetas" }), _jsx("input", { value: draft.labels.join(", "), onChange: (event) => controller.updateLabels(event.target.value) })] })] })] }) : null, !narrative && step === 1 && sheet && baseAttributes ? _jsx(AttributeEditor, { values: baseAttributes, labels: ATTRIBUTE_LABELS, keys: ATTRIBUTE_KEYS, bonuses: sheet.atributos, onChange: (key, value) => setCharacterSheet({ ...sheet, atributos: applyExceptionalAttributeBonuses({ ...baseAttributes, [key]: value }, selections) }) }) : null, !narrative && step === 2 && sheet ? _jsx(SimpleGmCapabilities, { selections: selections, attributeKeys: ATTRIBUTE_KEYS, attributeLabels: ATTRIBUTE_LABELS, onChange: (next) => setCharacterSheet(updateLegacyCollections({ ...sheet, atributos: synchronizeExceptionalAttributes(sheet.atributos, selections, next) }, next)), includeMonsterTraits: true }) : null, !narrative && step === 3 && sheet ? _jsx(SimpleGmEquipment, { sheet: sheet, onChange: setCharacterSheet, fixed: true }) : null, step === steps.length - 1 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsx("h3", { children: "Trasfondo" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 4, value: draft.summary, onChange: (event) => controller.updateField("summary", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Historia, personalidad, conducta y ganchos" }), _jsx("textarea", { rows: 10, value: draft.notes, onChange: (event) => controller.updateField("notes", event.target.value) })] }), !narrative && sheet ? _jsx(_Fragment, { children: ["tactics", "weakness", "loot"].map((field) => _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: { tactics: "Tácticas", weakness: "Debilidad", loot: "Botín" }[field] }), _jsx("textarea", { rows: 4, value: sheet.gmBackground[field], onChange: (event) => setCharacterSheet({ ...sheet, gmBackground: { ...sheet.gmBackground, [field]: event.target.value } }) })] }, field)) }) : null] })] }) : null] });
}
export function MonsterCreationWizard({ controller, onCancel }) {
    const confirm = useConfirmationDialog();
    const steps = [{ id: "identity", label: "Identidad" }, { id: "attributes", label: "Atributos" }, { id: "capabilities", label: "Capacidades" }, { id: "equipment", label: "Equipo" }, { id: "background", label: "Trasfondo" }];
    const [step, setStep] = useState(0);
    const [localError, setLocalError] = useState(null);
    const initialRef = useRef(JSON.stringify(controller.draft));
    const draft = controller.draft;
    const sheet = draft.sheet;
    const baseAttributes = removeExceptionalAttributeBonuses(sheet.attributes, sheet.capabilities);
    function validate(index) { setLocalError(null); if (index === 0 && draft.name.trim().length < 2) {
        setLocalError("El monstruo necesita un nombre.");
        return false;
    } if (index === 1) {
        const result = validateCreationAttributes(baseAttributes);
        if (!result.valid) {
            setLocalError(result.errors.join(" "));
            return false;
        }
    } if (index === 2) {
        const errors = validateExceptionalAttributeSelections(sheet.capabilities, MONSTER_ATTRIBUTE_KEYS);
        if (errors.length > 0) {
            setLocalError(errors.join(" "));
            return false;
        }
    } return true; }
    function validateThrough(index) { for (let current = 0; current <= index; current += 1)
        if (!validate(current))
            return false; return true; }
    async function close() {
        if (JSON.stringify(draft) !== initialRef.current && !await confirm({
            title: "Descartar cambios",
            message: "Hay cambios sin guardar. Si cierras el creador, se perderán.",
            confirmLabel: "Cerrar sin guardar",
            tone: "danger"
        }))
            return;
        onCancel();
    }
    async function save() { if (!validateThrough(steps.length - 1))
        return; if (await controller.saveDraft())
        onCancel(); }
    return _jsxs(WizardShell, { title: controller.selectedCustomId ? "Editar monstruo" : "Crear monstruo", steps: steps, step: step, summary: _jsxs(_Fragment, { children: [_jsxs("span", { children: ["PX usada ", _jsx("strong", { children: controller.draftSpentXp })] }), _jsxs("span", { children: ["Desaf\u00EDo ", _jsx("strong", { children: controller.draftChallenge })] }), _jsxs("span", { children: ["Da\u00F1o medio ", _jsx("strong", { children: averageDiceFormula(sheet.damage) ?? "-" })] }), _jsxs("span", { children: ["Armadura media ", _jsx("strong", { children: averageDiceFormula(sheet.armor) ?? "-" })] })] }), error: localError ?? controller.formError, busy: controller.isSaving, onStep: (index) => { if (index <= step || validateThrough(index - 1))
            setStep(index); }, onPrevious: () => setStep((current) => Math.max(0, current - 1)), onNext: () => { if (validate(step))
            setStep((current) => Math.min(steps.length - 1, current + 1)); }, onCancel: close, onSave: () => void save(), children: [step === 0 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsx("h3", { children: "Identidad" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: draft.name, onChange: (event) => controller.updateField("name", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categor\u00EDa" }), _jsx("select", { value: draft.category, onChange: (event) => controller.updateField("category", event.target.value), children: ["Abominación", "Bestia", "Fenómeno", "Flora", "Muerto viviente", "Ser civilizado"].map((entry) => _jsx("option", { children: entry }, entry)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fuente" }), _jsx("input", { value: draft.source, onChange: (event) => controller.updateField("source", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Desaf\u00EDo calculado" }), _jsx("input", { readOnly: true, value: controller.draftChallenge })] })] })] }) : null, step === 1 ? _jsx(AttributeEditor, { values: baseAttributes, labels: MONSTER_ATTRIBUTE_LABELS, keys: MONSTER_ATTRIBUTE_KEYS, bonuses: sheet.attributes, onChange: (key, value) => controller.setDraft((current) => ({ ...current, sheet: { ...current.sheet, attributes: applyExceptionalAttributeBonuses({ ...baseAttributes, [key]: value }, sheet.capabilities) } })) }) : null, step === 2 ? _jsx(SimpleGmCapabilities, { selections: sheet.capabilities, attributeKeys: MONSTER_ATTRIBUTE_KEYS, attributeLabels: MONSTER_ATTRIBUTE_LABELS, onChange: (capabilities) => controller.setDraft((current) => ({ ...current, sheet: { ...current.sheet, attributes: synchronizeExceptionalAttributes(current.sheet.attributes, current.sheet.capabilities, capabilities), capabilities }, threat: getActorChallengeFromXp(getActorSpentXp(capabilities)) })), includeMonsterTraits: true }) : null, step === 3 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsx("h3", { children: "Equipo y valores de combate" }), _jsx("p", { className: "section-help", children: "Introduce las f\u00F3rmulas originales. La ficha del DJ mostrar\u00E1 sus valores medios y no lanzar\u00E1 estos dados." }), _jsx(SimpleMonsterEquipment, { sheet: sheet, onChange: (nextSheet) => controller.setDraft((current) => ({ ...current, sheet: nextSheet })) }), _jsx("div", { className: "form-grid", children: ["attack", "damage", "defense", "armor", "toughness", "painThreshold", "movement"].map((field) => _jsxs("label", { className: "field", children: [_jsx("span", { children: { attack: "Ataque", damage: "Daño", defense: "Defensa", armor: "Armadura", toughness: "Robustez", painThreshold: "Umbral de dolor", movement: "Movimiento" }[field] }), _jsx("input", { value: sheet[field], onChange: (event) => controller.updateSheetField(field, event.target.value) }), field === "damage" || field === "armor" ? _jsxs("small", { children: ["Valor medio: ", averageDiceFormula(sheet[field]) ?? "No calculable"] }) : null] }, field)) })] }) : null, step === 4 ? _jsxs("section", { className: "actor-wizard__section", children: [_jsx("h3", { children: "Trasfondo" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 4, value: draft.summary, onChange: (event) => controller.updateField("summary", event.target.value) })] }), ["tactics", "weakness", "loot"].map((field) => _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: { tactics: "Tácticas", weakness: "Debilidad", loot: "Botín" }[field] }), _jsx("textarea", { rows: 5, value: sheet[field], onChange: (event) => controller.updateSheetField(field, event.target.value) })] }, field))] })] }) : null] });
}
function SimpleGmCapabilities({ selections, onChange, includeMonsterTraits, attributeKeys, attributeLabels }) {
    const [query, setQuery] = useState("");
    const catalog = useMemo(() => {
        const normal = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS].map((entry) => ({ id: entry.id, name: entry.nombre, kind: entry.tipo, source: entry.libro, page: entry.pagina, effect: entry.efectoResumen }));
        const traits = includeMonsterTraits ? ALL_ENTRIES.filter((entry) => entry.tipo === "rasgo").map((entry) => ({ id: entry.id, name: entry.nombre, kind: "rasgo_monstruoso", source: entry.fuente, page: entry.pagina, effect: entry.resumen })) : [];
        return [...normal, ...traits];
    }, [includeMonsterTraits]);
    const shown = catalog.filter((entry) => normalize(`${entry.name} ${entry.effect}`).includes(normalize(query))).slice(0, 80);
    return _jsxs("section", { className: "actor-wizard__section", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Capacidades" }), _jsx("p", { className: "section-help", children: "El DJ no tiene l\u00EDmite de PX; el total determina el desaf\u00EDo." })] }), _jsxs("strong", { children: [getActorSpentXp(selections), " PX \u00B7 ", getActorChallengeFromXp(getActorSpentXp(selections))] })] }), _jsx("input", { type: "search", placeholder: "Buscar en el cat\u00E1logo...", value: query, onChange: (event) => setQuery(event.target.value) }), _jsx("div", { className: "actor-wizard__catalog-list", children: shown.map((entry) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.source }), _jsx("small", { children: entry.effect })] }), _jsx("button", { type: "button", onClick: () => { const exceptional = normalize(entry.name) === "atributo excepcional"; const attributeKey = exceptional ? attributeKeys.find((key) => !selections.some((current) => isExceptionalAttributeSelection(current) && current.attributeKey === key)) : undefined; if (exceptional && !attributeKey)
                                return; if (!exceptional && selections.some((current) => current.catalogId === entry.id))
                                return; onChange([...selections, { catalogId: entry.id, name: entry.name, kind: entry.kind, level: entry.kind === "ritual" ? undefined : "principiante", origin: "comprada", source: entry.source, page: entry.page, repeatable: exceptional || undefined, attributeKey }]); }, children: "A\u00F1adir" })] }, entry.id)) }), _jsx("h4", { children: "Seleccionadas" }), _jsx("div", { className: "actor-wizard__selection-list", children: selections.map((entry, index) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.kind.replaceAll("_", " ") })] }), isExceptionalAttributeSelection(entry) ? _jsxs("select", { "aria-label": `Atributo para ${entry.name}`, value: entry.attributeKey ?? "", onChange: (event) => onChange(selections.map((current, currentIndex) => currentIndex === index ? { ...current, attributeKey: event.target.value } : current)), children: [_jsx("option", { value: "", disabled: true, children: "Elige atributo" }), attributeKeys.map((key) => _jsx("option", { value: key, disabled: selections.some((other, otherIndex) => otherIndex !== index && isExceptionalAttributeSelection(other) && other.attributeKey === key), children: attributeLabels[key] ?? key }, key))] }) : null, entry.kind !== "ritual" ? _jsxs("select", { value: entry.level ?? "principiante", onChange: (event) => onChange(selections.map((current, currentIndex) => currentIndex === index ? { ...current, level: event.target.value } : current)), children: [_jsx("option", { value: "principiante", children: "Principiante \u00B7 10 PX" }), _jsx("option", { value: "adepto", children: "Adepto \u00B7 30 PX" }), _jsx("option", { value: "maestro", children: "Maestro \u00B7 60 PX" })] }) : null, _jsx("button", { type: "button", className: "subtle-button", onClick: () => onChange(selections.filter((_, currentIndex) => currentIndex !== index)), children: "Quitar" })] }, `${entry.catalogId}-${index}`)) })] });
}
function SimpleGmEquipment({ sheet, onChange, fixed }) {
    const [query, setQuery] = useState("");
    const shown = ITEM_CATALOG.filter((entry) => normalize(`${entry.name} ${entry.category}`).includes(normalize(query))).slice(0, 80);
    return _jsxs("section", { className: "actor-wizard__section", children: [_jsx("h3", { children: "Equipo" }), _jsx("p", { className: "section-help", children: "El DJ puede escoger libremente objetos. Los dados se conservan y se muestran como promedio fijo." }), _jsx("input", { type: "search", placeholder: "Buscar equipo...", value: query, onChange: (event) => setQuery(event.target.value) }), _jsx("div", { className: "actor-wizard__catalog-list", children: shown.map((entry) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.value }), _jsx("small", { children: fixed && (entry.damageFormula || entry.protectionFormula) ? `Promedio: ${averageDiceFormula(entry.damageFormula || entry.protectionFormula) ?? "-"}` : entry.description })] }), _jsx("button", { type: "button", onClick: () => onChange({ ...sheet, inventoryItems: [...sheet.inventoryItems, makeInventoryItem(entry, "concedido", sheet.inventoryItems.length)], equipo: [...sheet.equipo, entry.name] }), children: "A\u00F1adir" })] }, entry.templateId)) }), _jsx("div", { className: "actor-wizard__selection-list", children: sheet.inventoryItems.map((entry, index) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsxs("span", { children: [entry.damageFormula || entry.protectionFormula, fixed ? ` → ${averageDiceFormula(entry.damageFormula || entry.protectionFormula) ?? "-"}` : ""] })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => onChange({ ...sheet, inventoryItems: sheet.inventoryItems.filter((_, currentIndex) => currentIndex !== index), equipo: sheet.equipo.filter((name) => name !== entry.name) }), children: "Quitar" })] }, entry.id)) })] });
}
function SimpleMonsterEquipment({ sheet, onChange }) {
    const [query, setQuery] = useState("");
    const equipment = sheet.equipment ?? [];
    const shown = ITEM_CATALOG.filter((entry) => normalize(`${entry.name} ${entry.category} ${entry.qualities}`).includes(normalize(query))).slice(0, 80);
    return _jsxs("div", { className: "actor-wizard__monster-equipment", children: [_jsx("input", { type: "search", placeholder: "Buscar equipo del cat\u00E1logo...", value: query, onChange: (event) => setQuery(event.target.value) }), _jsx("div", { className: "actor-wizard__catalog-list", children: shown.map((entry) => { const formula = entry.damageFormula || entry.protectionFormula; return _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsxs("span", { children: [entry.value, " \u00B7 ", entry.category] }), _jsx("small", { children: formula ? `${formula} → valor fijo ${averageDiceFormula(formula) ?? "-"}` : entry.description })] }), _jsx("button", { type: "button", onClick: () => { const nextEquipment = [...equipment, { catalogId: entry.templateId, name: entry.name, category: entry.category, damageFormula: entry.damageFormula, protectionFormula: entry.protectionFormula, fixedValue: averageDiceFormula(formula), value: entry.value, qualities: entry.qualities, notes: entry.notes }]; onChange({ ...sheet, equipment: nextEquipment, damage: entry.category === "weapon" && entry.damageFormula ? entry.damageFormula : sheet.damage, armor: entry.category === "armor" && entry.protectionFormula ? entry.protectionFormula : sheet.armor }); }, children: "A\u00F1adir" })] }, entry.templateId); }) }), _jsx("div", { className: "actor-wizard__selection-list", children: equipment.map((entry, index) => _jsxs("article", { children: [_jsxs("div", { children: [_jsx("strong", { children: entry.name }), _jsxs("span", { children: [entry.damageFormula || entry.protectionFormula || entry.value, entry.fixedValue != null ? ` → ${entry.fixedValue}` : ""] })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => onChange({ ...sheet, equipment: equipment.filter((_, currentIndex) => currentIndex !== index) }), children: "Quitar" })] }, `${entry.catalogId}-${index}`)) })] });
}
