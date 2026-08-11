import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  MONSTER_ATTRIBUTE_KEYS,
  MONSTER_ATTRIBUTE_LABELS,
  SYMBAROUM_ABILITIES,
  SYMBAROUM_ARCHETYPES,
  SYMBAROUM_CULTURES,
  SYMBAROUM_MYSTIC_POWERS,
  SYMBAROUM_RACES,
  SYMBAROUM_RITUALS,
  averageDiceFormula,
  applyExceptionalAttributeBonuses,
  getActorBurdenBonus,
  getActorChallengeFromXp,
  getActorSpentXp,
  getMonsterCreationChallenge,
  getMonsterCreationXp,
  isProfessionExclusiveBenefit,
  isExceptionalAttributeSelection,
  removeExceptionalAttributeBonuses,
  synchronizeExceptionalAttributes,
  validateCreationAttributes,
  validateExceptionalAttributeSelections,
  type ActorCapabilityKind,
  type ActorCapabilitySelection,
  type CharacterSheet,
  type Npc,
  type MonsterSheet,
  type SkillLevel
} from "@umbra/shared";
import type { useCharacterController } from "../controllers/characterController";
import type { useMonsterController } from "../controllers/monsterController";
import type { useNpcController } from "../controllers/npcController";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ALL_ENTRIES, SYMBAROUM_BLESSINGS, SYMBAROUM_BURDENS } from "../models/compendiumEntries";
import { ITEM_CATALOG, type ItemTemplate } from "../models/itemCatalog";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

type WizardStep = { id: string; label: string };

type WizardShellProps = {
  title: string;
  steps: WizardStep[];
  step: number;
  summary: ReactNode;
  error?: string | null;
  busy?: boolean;
  onStep: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
};

function WizardShell(props: WizardShellProps) {
  useBodyScrollLock(true);
  const isLast = props.step === props.steps.length - 1;
  return (
    <section className="actor-wizard" role="dialog" aria-modal="true" aria-label={props.title} onClick={(event) => event.stopPropagation()}>
      <header className="actor-wizard__header">
        <div>
          <span className="eyebrow">Creador por fases</span>
          <h2>{props.title}</h2>
        </div>
        <button type="button" className="subtle-button" onClick={props.onCancel}>Cerrar</button>
      </header>
      <nav className="actor-wizard__steps" aria-label="Fases de creación">
        {props.steps.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={index === props.step ? "is-active" : index < props.step ? "is-complete" : ""}
            onClick={() => props.onStep(index)}
          >
            <span>{index + 1}</span>{item.label}
          </button>
        ))}
      </nav>
      <aside className="actor-wizard__summary">{props.summary}</aside>
      {props.error ? <p className="error actor-wizard__error">{props.error}</p> : null}
      <div className="actor-wizard__body">{props.children}</div>
      <footer className="actor-wizard__footer">
        <button type="button" className="subtle-button" onClick={props.onPrevious} disabled={props.step === 0}>Anterior</button>
        <span className="meta-text">Paso {props.step + 1} de {props.steps.length}</span>
        {isLast ? (
          <button type="button" onClick={props.onSave} disabled={props.busy}>{props.busy ? "Guardando..." : "Guardar"}</button>
        ) : (
          <button type="button" onClick={props.onNext}>Siguiente</button>
        )}
      </footer>
    </section>
  );
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parsePriceToOrtegs(value: string): number | null {
  const match = String(value ?? "").toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(taler|chelin|orteg)/);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  if (match[2].startsWith("taler")) return Math.round(amount * 100);
  if (match[2].startsWith("chelin")) return Math.round(amount * 10);
  return Math.round(amount);
}

function formatOrtegs(value: number): string {
  const normalized = Math.max(0, Math.floor(value));
  const taleros = Math.floor(normalized / 100);
  const chelines = Math.floor((normalized % 100) / 10);
  const ortegs = normalized % 10;
  return [taleros ? `${taleros} tálero${taleros === 1 ? "" : "s"}` : "", chelines ? `${chelines} chelín${chelines === 1 ? "" : "es"}` : "", ortegs ? `${ortegs} orteg${ortegs === 1 ? "" : "s"}` : ""]
    .filter(Boolean).join(", ") || "0 ortegs";
}

function makeInventoryItem(template: ItemTemplate, origin: "inicial" | "concedido" | "comprado", index: number): CharacterSheet["inventoryItems"][number] {
  return {
    ...template,
    id: `creation-${origin}-${template.templateId}-${Date.now()}-${index}`,
    quantity: template.defaultQuantity ?? 1,
    equipped: template.slot !== "none",
    notes: [`Origen de creación: ${origin}.`, template.notes].filter(Boolean).join("\n")
  };
}

const FREE_PLAYER_TRAITS = [
  { id: "rasgo-personaje-longevo", name: "Longevo", source: "Libro Básico", page: 107 },
  { id: "rasgo-personaje-poco-longevo", name: "Poco longevo", source: "Libro Básico", page: 107 },
  { id: "rasgo-personaje-vinculo-terrenal", name: "Vínculo terrenal", source: "Guía Avanzada del Jugador", page: 48 }
] as const;

const RATED_TRAIT_NAMES = new Set(["robusto", "superviviente", "cambiaformas", "memoria racial"]);
const MISCLASSIFIED_BLESSINGS = new Set(["robusto", "cambiaformas", "longevo"]);

const RACIAL_RECOMMENDATIONS: Record<string, Array<{ name: string; kind: ActorCapabilityKind }>> = {
  humano: [{ name: "Contactos", kind: "bendicion" }, { name: "Privilegiado", kind: "bendicion" }, { name: "Montés", kind: "bendicion" }],
  trocalengo: [{ name: "Longevo", kind: "rasgo_personaje" }, { name: "Cambiaformas", kind: "rasgo_nivelado" }],
  ogro: [{ name: "Longevo", kind: "rasgo_personaje" }, { name: "Paria", kind: "carga" }, { name: "Robusto", kind: "rasgo_nivelado" }],
  trasgo: [{ name: "Poco longevo", kind: "rasgo_personaje" }, { name: "Paria", kind: "carga" }, { name: "Superviviente", kind: "rasgo_nivelado" }],
  elfo: [{ name: "Longevo", kind: "rasgo_personaje" }, { name: "Paria", kind: "carga" }, { name: "Memoria racial", kind: "rasgo_nivelado" }],
  enano: [{ name: "Vínculo terrenal", kind: "rasgo_personaje" }, { name: "Memoria absoluta", kind: "bendicion" }, { name: "Paria", kind: "carga" }],
  troll: [{ name: "Longevo", kind: "rasgo_personaje" }, { name: "Paria", kind: "carga" }]
};

function getRacialRecommendations(race: string) {
  return RACIAL_RECOMMENDATIONS[normalize(race)] ?? [];
}

function buildLegacySelections(sheet: CharacterSheet): ActorCapabilitySelection[] {
  if (sheet.capabilitySelections.length > 0) return sheet.capabilitySelections;
  return [
    ...sheet.habilidades.map((entry) => ({ catalogId: `habilidad-${normalize(entry.nombre).replace(/\s+/g, "-")}`, name: entry.nombre, kind: (RATED_TRAIT_NAMES.has(normalize(entry.nombre)) ? "rasgo_nivelado" : "habilidad") as ActorCapabilityKind, level: entry.nivel, origin: "legado" as const, source: entry.fuente, page: entry.pagina })),
    ...sheet.poderesMisticos.map((entry) => ({ catalogId: `poder_mistico-${normalize(entry.nombre).replace(/\s+/g, "-")}`, name: entry.nombre, kind: "poder_mistico" as const, level: entry.nivel, origin: "legado" as const, source: entry.fuente, page: entry.pagina })),
    ...sheet.rituales.map((entry) => ({ catalogId: `ritual-${normalize(entry.nombre).replace(/\s+/g, "-")}`, name: entry.nombre, kind: "ritual" as const, level: "novato" as const, origin: "legado" as const, source: entry.fuente, page: entry.pagina })),
    ...sheet.bendiciones.map((name) => ({ catalogId: `bendicion-${normalize(name).replace(/\s+/g, "-")}`, name, kind: "bendicion" as const, origin: "legado" as const, source: "" })),
    ...sheet.cargas.map((name) => ({ catalogId: `carga-${normalize(name).replace(/\s+/g, "-")}`, name, kind: "carga" as const, origin: "legado" as const, source: "" })),
    ...sheet.rasgos.map((name) => ({ catalogId: `rasgo-personaje-${normalize(name).replace(/\s+/g, "-")}`, name, kind: "rasgo_personaje" as const, origin: "legado" as const, source: "" }))
  ];
}

type CatalogChoice = { id: string; name: string; kind: ActorCapabilityKind; source: string; page?: number; effect?: string };

function getCharacterCatalog(race: string, selections: ActorCapabilitySelection[]): CatalogChoice[] {
  const hasDarkBlood = selections.some((entry) => normalize(entry.name) === "sangre oscura");
  const monsterAllowed = normalize(race) === "troll" || hasDarkBlood;
  const normalCapabilities: CatalogChoice[] = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS].filter((entry) => !isProfessionExclusiveBenefit(entry.nombre)).map((entry) => ({
    id: entry.id,
    name: entry.nombre,
    kind: RATED_TRAIT_NAMES.has(normalize(entry.nombre)) ? "rasgo_nivelado" : entry.tipo,
    source: entry.libro,
    page: entry.pagina,
    effect: entry.efectoResumen
  }));
  const simple: CatalogChoice[] = [
    ...SYMBAROUM_BLESSINGS.filter((entry) => !MISCLASSIFIED_BLESSINGS.has(normalize(entry.nombre))).map((entry) => ({ id: entry.id, name: entry.nombre, kind: "bendicion" as const, source: entry.fuente, page: entry.pagina, effect: entry.resumen })),
    ...SYMBAROUM_BURDENS.map((entry) => ({ id: entry.id, name: entry.nombre, kind: "carga" as const, source: entry.fuente, page: entry.pagina, effect: entry.resumen })),
    ...FREE_PLAYER_TRAITS.map((entry) => ({ id: entry.id, name: entry.name, kind: "rasgo_personaje" as const, source: entry.source, page: entry.page })),
    { id: "bendicion-montes", name: "Montés", kind: "bendicion", source: "Libro Básico", page: 108 },
    { id: "rasgo-nivelado-superviviente", name: "Superviviente", kind: "rasgo_nivelado", source: "Libro Básico", page: 111 },
    { id: "rasgo-nivelado-memoria-racial", name: "Memoria racial", kind: "rasgo_nivelado", source: "Guía Avanzada del Jugador", page: 49 }
  ];
  const monsterTraits = monsterAllowed
    ? ALL_ENTRIES.filter((entry) => entry.tipo === "rasgo" && ["arma natural", "duro", "robusto", "regeneracion", "alado", "armadura"].includes(normalize(entry.nombre)))
      .map((entry) => ({ id: entry.id, name: entry.nombre, kind: "rasgo_monstruoso" as const, source: entry.fuente, page: entry.pagina, effect: entry.resumen }))
    : [];
  return [...normalCapabilities, ...simple, ...monsterTraits].filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index);
}

function updateLegacyCollections(sheet: CharacterSheet, selections: ActorCapabilitySelection[]): CharacterSheet {
  const ratedByName = new Map([...sheet.habilidades, ...sheet.poderesMisticos, ...sheet.rituales].map((entry) => [normalize(entry.nombre), entry]));
  const toRated = (entry: ActorCapabilitySelection) => {
    const legacy = ratedByName.get(normalize(entry.name));
    const catalog = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS].find((item) => item.id === entry.catalogId);
    return {
      nombre: entry.name,
      tipo: entry.kind,
      efecto: legacy?.efecto ?? catalog?.efectoResumen ?? "",
      nivel: entry.level ?? "novato" as SkillLevel,
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

type CharacterController = ReturnType<typeof useCharacterController>;

export function CharacterCreationWizard({ controller, onCancel }: { controller: CharacterController; onCancel: () => void }) {
  const steps: WizardStep[] = [
    { id: "identity", label: "Identidad" }, { id: "attributes", label: "Atributos" }, { id: "capabilities", label: "Capacidades" }, { id: "equipment", label: "Equipo" }, { id: "background", label: "Trasfondo" }
  ];
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | ActorCapabilityKind>("all");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const initialRef = useRef(JSON.stringify(controller.form));
  const sheet = controller.form.sheet;
  const selections = useMemo(() => buildLegacySelections(sheet), [sheet]);
  const baseAttributes = removeExceptionalAttributeBonuses(sheet.atributos, selections);
  const experience = getCharacterExperienceSummary({ ...sheet, capabilitySelections: selections });
  const racial = getRacialRecommendations(sheet.identidad.raza);
  const catalog = useMemo(() => getCharacterCatalog(sheet.identidad.raza, selections), [sheet.identidad.raza, selections]);
  const filteredCatalog = catalog.filter((entry) => {
    if (kind !== "all" && entry.kind !== kind) return false;
    const needle = normalize(query);
    return !needle || normalize(`${entry.name} ${entry.source} ${entry.effect ?? ""}`).includes(needle);
  }).slice(0, 80);

  useEffect(() => {
    if (sheet.capabilitySelections.length === 0 && selections.length > 0) {
      controller.setForm((current) => ({ ...current, sheet: updateLegacyCollections(current.sheet, selections) }));
    }
  }, []);

  useEffect(() => {
    if (controller.isEditing || sheet.inventoryItems.length > 0) return;
    const baseIds = ["weapon-dagger", "armor-light", "gear-sack", "gear-bedroll", "gear-flint-steel", "gear-rations", "gear-waterskin"];
    const baseItems = baseIds.map((id, index) => ITEM_CATALOG.find((entry) => entry.templateId === id) ? makeInventoryItem(ITEM_CATALOG.find((entry) => entry.templateId === id)!, "inicial", index) : null).filter(Boolean) as CharacterSheet["inventoryItems"];
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

  function getStartingWallet(list = selections): number {
    if (list.some((entry) => normalize(entry.name) === "privilegiado")) return 5000;
    if (list.some((entry) => normalize(entry.name) === "paria")) return 50;
    return 500;
  }
  function getStartingMoneyLabel(list = selections): string { return formatOrtegs(getStartingWallet(list)); }
  const spentMoney = sheet.inventoryItems.filter((entry) => entry.notes.includes("Origen de creación: comprado"))
    .reduce((total, entry) => total + (parsePriceToOrtegs(entry.value) ?? 0) * entry.quantity, 0);
  const moneyRemaining = getStartingWallet() - spentMoney;

  function setSheet(nextSheet: CharacterSheet) {
    controller.setForm((current) => ({ ...current, name: nextSheet.identidad.nombrePersonaje, sheet: nextSheet }));
  }

  function addCapability(choice: CatalogChoice) {
    const isExceptional = normalize(choice.name) === "atributo excepcional";
    const exceptionalAttributeKey = isExceptional
      ? ATTRIBUTE_KEYS.find((key) => !selections.some((entry) => isExceptionalAttributeSelection(entry) && entry.attributeKey === key))
      : undefined;
    if (isExceptional && !exceptionalAttributeKey) {
      setLocalError("Atributo excepcional ya está adquirido para los ocho atributos."); return;
    }
    if (!isExceptional && selections.some((entry) => entry.catalogId === choice.id || normalize(entry.name) === normalize(choice.name))) {
      setLocalError(`${choice.name} ya está añadido.`); return;
    }
    const racialMatch = racial.some((entry) => normalize(entry.name) === normalize(choice.name));
    const next: ActorCapabilitySelection = {
      catalogId: choice.id, name: choice.name, kind: choice.kind,
      level: ["bendicion", "carga", "rasgo_personaje"].includes(choice.kind) ? undefined : "novato",
      origin: racialMatch ? "racial" : choice.kind === "rasgo_personaje" ? "trasfondo" : "comprada",
      source: choice.source, page: choice.page,
      repeatable: isExceptional || undefined,
      attributeKey: exceptionalAttributeKey
    };
    const nextSelections = [...selections, next];
    const nextSheet = updateLegacyCollections({ ...sheet, atributos: synchronizeExceptionalAttributes(sheet.atributos, selections, nextSelections) }, nextSelections);
    const nextExperience = getCharacterExperienceSummary(nextSheet);
    if (nextExperience.computedSpent > nextExperience.effectiveTotal) {
      setLocalError(`No hay PX suficientes para añadir ${choice.name}.`); return;
    }
    setSheet({ ...nextSheet, recursos: { ...nextSheet.recursos, dinero: formatOrtegs(getStartingWallet(nextSelections) - spentMoney) } });
    setLocalError(null);
  }

  function removeCapability(index: number) {
    const nextSelections = selections.filter((_, currentIndex) => currentIndex !== index);
    const atributos = synchronizeExceptionalAttributes(sheet.atributos, selections, nextSelections);
    setSheet({ ...updateLegacyCollections({ ...sheet, atributos }, nextSelections), recursos: { ...sheet.recursos, dinero: formatOrtegs(getStartingWallet(nextSelections) - spentMoney) } });
  }

  function updateCapabilityLevel(index: number, level: SkillLevel) {
    const nextSelections = selections.map((entry, currentIndex) => currentIndex === index ? { ...entry, level } : entry);
    const nextSheet = updateLegacyCollections({ ...sheet, atributos: synchronizeExceptionalAttributes(sheet.atributos, selections, nextSelections) }, nextSelections);
    const nextExperience = getCharacterExperienceSummary(nextSheet);
    if (nextExperience.computedSpent > nextExperience.effectiveTotal) { setLocalError("La mejora supera los PX disponibles."); return; }
    setSheet(nextSheet); setLocalError(null);
  }

  function updateExceptionalAttribute(index: number, attributeKey: string) {
    if (selections.some((entry, currentIndex) => currentIndex !== index && isExceptionalAttributeSelection(entry) && entry.attributeKey === attributeKey)) {
      setLocalError("Atributo excepcional solo puede adquirirse una vez para cada atributo."); return;
    }
    const nextSelections = selections.map((entry, currentIndex) => currentIndex === index ? { ...entry, attributeKey } : entry);
    const nextSheet = updateLegacyCollections({ ...sheet, atributos: synchronizeExceptionalAttributes(sheet.atributos, selections, nextSelections) }, nextSelections);
    setSheet(nextSheet); setLocalError(null);
  }

  function addEquipment(template: ItemTemplate, origin: "concedido" | "comprado" | "reliquia", grantSource = "") {
    const cost = origin === "comprado" ? parsePriceToOrtegs(template.value) : 0;
    if (cost == null) { setLocalError("Este objeto no tiene un precio normalizado y no puede comprarse durante la creación."); return; }
    if (cost > moneyRemaining) { setLocalError("No hay dinero suficiente para esta compra."); return; }
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

  function removeEquipment(index: number) {
    const nextItems = sheet.inventoryItems.filter((_, currentIndex) => currentIndex !== index);
    const nextSpent = nextItems.filter((entry) => entry.notes.includes("Origen de creación: comprado"))
      .reduce((total, entry) => total + (parsePriceToOrtegs(entry.value) ?? 0) * entry.quantity, 0);
    setSheet({ ...sheet, inventoryItems: nextItems, equipo: nextItems.map((entry) => entry.name), recursos: { ...sheet.recursos, dinero: formatOrtegs(getStartingWallet() - nextSpent) } });
  }

  function validateStep(index: number): boolean {
    setLocalError(null);
    if (index === 0 && sheet.identidad.nombrePersonaje.trim().length < 2) { setLocalError("El personaje necesita un nombre de al menos dos caracteres."); return false; }
    if (index === 1) {
      const validation = validateCreationAttributes(baseAttributes);
      if (!validation.valid) { setLocalError(validation.errors.join(" ")); return false; }
    }
    if (index === 2) {
      const exceptionalErrors = validateExceptionalAttributeSelections(selections, ATTRIBUTE_KEYS);
      if (exceptionalErrors.length > 0) { setLocalError(exceptionalErrors.join(" ")); return false; }
      if (experience.computedSpent > experience.effectiveTotal) { setLocalError("Las capacidades superan los PX disponibles."); return false; }
    }
    if (index === 3) {
      const hasWeaponBeyondDagger = sheet.inventoryItems.some((entry) => entry.category === "weapon" && normalize(entry.name) !== "daga");
      if (!hasWeaponBeyondDagger) { setLocalError("Elige el arma inicial del personaje antes de continuar."); return false; }
      if (moneyRemaining < 0) { setLocalError("Las compras superan el dinero inicial."); return false; }
    }
    return true;
  }

  function validateThrough(index: number): boolean {
    for (let current = 0; current <= index; current += 1) {
      if (!validateStep(current)) return false;
    }
    return true;
  }

  function close() {
    if (JSON.stringify(controller.form) !== initialRef.current && !window.confirm("Hay cambios sin guardar. ¿Cerrar el creador?")) return;
    onCancel();
  }

  async function save() {
    if (!validateThrough(steps.length - 1)) return;
    const nextSheet = {
      ...sheet,
      progreso: { ...sheet.progreso, experienciaGastada: Math.max(sheet.progreso.experienciaGastada, experience.computedSpent) },
      recursos: { ...sheet.recursos, dinero: formatOrtegs(moneyRemaining) }
    };
    setSheet(nextSheet);
    const saved = await controller.submit({ ...controller.form, sheet: nextSheet });
    if (!saved) return;
  }

  const availableEquipment = ITEM_CATALOG.filter((entry) => normalize(`${entry.name} ${entry.category} ${entry.qualities}`).includes(normalize(equipmentQuery))).slice(0, 80);
  const abilityNames = new Set(selections.map((entry) => normalize(entry.name)));
  const grants: Array<{ label: string; templateId: string; source: string }> = [];
  if (abilityNames.has("armas a dos manos")) grants.push({ label: "Arma pesada", templateId: "weapon-heavy", source: "Armas a dos manos" });
  if (abilityNames.has("armas de asta")) grants.push({ label: "Lanza", templateId: "weapon-long", source: "Armas de asta" });
  if (abilityNames.has("combate con escudo")) grants.push({ label: "Escudo", templateId: "weapon-shield", source: "Combate con escudo" });
  if (abilityNames.has("combate con armadura")) grants.push({ label: "Armadura media", templateId: "armor-medium", source: "Combate con armadura" });
  if (abilityNames.has("tirador")) grants.push({ label: "Arco", templateId: "weapon-bow", source: "Tirador" });
  if (abilityNames.has("viento de acero")) grants.push({ label: "Arma arrojadiza", templateId: "weapon-thrown", source: "Viento de acero" });
  if (abilityNames.has("martillo de monstruos")) grants.push({ label: "Arma de una mano", templateId: "weapon-single-handed", source: "Martillo de monstruos" });
  const weaponGrants = grants.filter((grant) => ITEM_CATALOG.find((entry) => entry.templateId === grant.templateId)?.category === "weapon");
  const hasFamilyRelic = abilityNames.has("reliquia familiar");
  const hasClaimedFamilyRelic = sheet.inventoryItems.some((entry) => entry.notes.includes("Reliquia familiar de creación"));

  useEffect(() => {
    const validSources = new Set(grants.map((grant) => normalize(grant.source)));
    const nextItems = sheet.inventoryItems.filter((entry) => {
      const source = entry.notes.match(/Concesión de capacidad:\s*([^\.]+)\./i)?.[1];
      if (source && !validSources.has(normalize(source))) return false;
      if (entry.notes.includes("Reliquia familiar de creación") && !hasFamilyRelic) return false;
      return true;
    });
    if (nextItems.length !== sheet.inventoryItems.length) {
      setSheet({ ...sheet, inventoryItems: nextItems, equipo: nextItems.map((entry) => entry.name) });
      setLocalError("Una concesión de equipo dejó de ser válida. Elige de nuevo el equipo inicial.");
    }
  }, [selections.map((entry) => `${entry.catalogId}:${entry.level}`).join("|")]);

  return (
    <WizardShell
      title={controller.isEditing ? "Editar personaje" : "Crear personaje"}
      steps={steps} step={step} onStep={(index) => { if (index <= step || validateThrough(index - 1)) setStep(index); }}
      onPrevious={() => setStep((current) => Math.max(0, current - 1))}
      onNext={() => { if (validateStep(step)) setStep((current) => Math.min(steps.length - 1, current + 1)); }}
      onCancel={close} onSave={() => void save()} busy={controller.isSaving}
      error={localError ?? controller.error}
      summary={<><span>PX inicial <strong>{sheet.identidad.esFamiliar ? 20 : 50}</strong></span><span>Cargas <strong>+{getActorBurdenBonus(selections)}</strong></span><span>Gastada <strong>{experience.computedSpent}</strong></span><span>Disponible <strong>{experience.effectiveAvailable}</strong></span></>}
    >
      {step === 0 ? <section className="actor-wizard__section"><h3>Identidad</h3><div className="form-grid">
        <label className="field"><span>Nombre del personaje</span><input value={sheet.identidad.nombrePersonaje} onChange={(event) => controller.updateSheet("identidad.nombrePersonaje", event.target.value)} /></label>
        <label className="field"><span>Nombre del jugador</span><input value={sheet.identidad.nombreJugador} onChange={(event) => controller.updateSheet("identidad.nombreJugador", event.target.value)} /></label>
        <label className="field"><span>Raza</span><select value={sheet.identidad.raza} onChange={(event) => controller.updateSheet("identidad.raza", event.target.value)}>{SYMBAROUM_RACES.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label className="field"><span>Cultura</span><select value={sheet.identidad.cultura} onChange={(event) => controller.updateSheet("identidad.cultura", event.target.value)}>{SYMBAROUM_CULTURES.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label className="field"><span>Arquetipo</span><select value={sheet.identidad.arquetipo} onChange={(event) => controller.updateSheet("identidad.arquetipo", event.target.value)}>{SYMBAROUM_ARCHETYPES.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label className="field"><span>Ocupación descriptiva</span><input value={sheet.identidad.profesion} onChange={(event) => controller.updateSheet("identidad.profesion", event.target.value)} /></label>
        <label className="checkbox-row"><input type="checkbox" checked={sheet.identidad.esFamiliar} onChange={(event) => { const familiar = event.target.checked; controller.setForm((current) => ({ ...current, sheet: { ...current.sheet, identidad: { ...current.sheet.identidad, esFamiliar: familiar }, progreso: { ...current.sheet.progreso, experienciaTotal: familiar ? 20 : 50 } } })); }} /><span>Es familiar (20 PX iniciales)</span></label>
      </div><div className="info-box"><strong>Opciones raciales recomendadas:</strong> {racial.length ? racial.map((entry) => entry.name).join(", ") : "Sin concesiones automáticas. Revísalas en el compendio."} El usuario las confirma en Capacidades.</div></section> : null}

      {step === 1 ? <AttributeEditor values={baseAttributes} labels={ATTRIBUTE_LABELS} keys={ATTRIBUTE_KEYS} bonuses={sheet.atributos} onChange={(key, value) => {
        const nextBase = { ...baseAttributes, [key]: value };
        setSheet({ ...sheet, atributos: applyExceptionalAttributeBonuses(nextBase, selections) });
      }} /> : null}

      {step === 2 ? <section className="actor-wizard__section"><div className="row-actions"><div><h3>Capacidades</h3><p className="section-help">Solo pueden añadirse entradas del catálogo oficial. Las entradas antiguas no reconocidas se conservan como legado.</p></div></div>
        <div className="actor-wizard__catalog-tools"><input type="search" placeholder="Buscar capacidad..." value={query} onChange={(event) => setQuery(event.target.value)} /><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">Todas</option><option value="habilidad">Habilidades</option><option value="poder_mistico">Poderes</option><option value="ritual">Rituales</option><option value="rasgo_personaje">Rasgos gratuitos</option><option value="rasgo_nivelado">Rasgos con nivel</option><option value="rasgo_monstruoso">Rasgos monstruosos</option><option value="bendicion">Bendiciones</option><option value="carga">Cargas</option></select></div>
        <div className="actor-wizard__catalog-list">{filteredCatalog.map((entry) => <article key={entry.id}><div><strong>{entry.name}</strong><span>{entry.source}{entry.page ? ` · p.${entry.page}` : ""}</span><small>{entry.effect}</small></div><button type="button" onClick={() => addCapability(entry)}>Añadir</button></article>)}</div>
        <h4>Seleccionadas</h4><div className="actor-wizard__selection-list">{selections.map((entry, index) => <article key={`${entry.catalogId}-${index}`}><div><strong>{entry.name}</strong><span>{entry.kind.replaceAll("_", " ")} · {entry.origin}</span></div>{isExceptionalAttributeSelection(entry) ? <select aria-label={`Atributo para ${entry.name}`} value={entry.attributeKey ?? ""} onChange={(event) => updateExceptionalAttribute(index, event.target.value)}><option value="" disabled>Elige atributo</option>{ATTRIBUTE_KEYS.map((key) => <option key={key} value={key} disabled={selections.some((other, otherIndex) => otherIndex !== index && isExceptionalAttributeSelection(other) && other.attributeKey === key)}>{ATTRIBUTE_LABELS[key]}</option>)}</select> : null}{!["bendicion", "carga", "rasgo_personaje", "ritual"].includes(entry.kind) ? <select value={entry.level ?? "novato"} onChange={(event) => updateCapabilityLevel(index, event.target.value as SkillLevel)}><option value="novato">Novato · 10 PX</option><option value="adepto">Adepto · 30 PX</option><option value="maestro">Maestro · 60 PX</option></select> : null}<button type="button" className="subtle-button" onClick={() => removeCapability(index)}>Quitar</button></article>)}</div>
      </section> : null}

      {step === 3 ? <section className="actor-wizard__section"><div className="row-actions"><div><h3>Equipo inicial</h3><p className="section-help">La daga, la armadura ligera y el equipo de aventurero ya están incluidos.</p></div><strong>Saldo: {formatOrtegs(moneyRemaining)}</strong></div>
        {grants.length ? <div className="info-box"><strong>Concesiones por capacidades</strong><div className="toolbar">{grants.map((grant) => { const template = ITEM_CATALOG.find((entry) => entry.templateId === grant.templateId); const alreadyAdded = sheet.inventoryItems.some((entry) => entry.notes.includes(`Concesión de capacidad: ${grant.source}.`)); return template ? <button type="button" key={grant.templateId} className="subtle-button" disabled={alreadyAdded} onClick={() => addEquipment(template, "concedido", grant.source)}>{alreadyAdded ? `${grant.label} elegida` : `Añadir ${grant.label}`}</button> : null; })}</div></div> : null}
        {weaponGrants.length === 0 ? <div className="info-box"><strong>Elige una combinación básica:</strong><div className="toolbar">{["weapon-heavy", "weapon-long", "weapon-single-handed", "weapon-ranged"].map((id) => { const template = ITEM_CATALOG.find((entry) => entry.templateId === id); return template ? <button type="button" key={id} onClick={() => addEquipment(template, "concedido")}>Daga + {template.name}</button> : null; })}</div></div> : null}
        <input type="search" placeholder="Buscar compras adicionales..." value={equipmentQuery} onChange={(event) => setEquipmentQuery(event.target.value)} />
        <div className="actor-wizard__catalog-list">{availableEquipment.map((entry) => { const price = parsePriceToOrtegs(entry.value); const canBeRelic = hasFamilyRelic && !hasClaimedFamilyRelic && (entry.category === "weapon" || entry.category === "armor") && !normalize(`${entry.qualities} ${entry.description}`).includes("mist"); return <article key={entry.templateId}><div><strong>{entry.name}</strong><span>{entry.value} · {entry.category}</span><small>{entry.description}</small></div><div className="toolbar">{canBeRelic ? <button type="button" className="subtle-button" onClick={() => addEquipment(entry, "reliquia")}>Reliquia gratis</button> : null}<button type="button" disabled={price == null || price > moneyRemaining} onClick={() => addEquipment(entry, "comprado")}>Comprar</button></div></article>; })}</div>
        <h4>Inventario inicial</h4><div className="actor-wizard__selection-list">{sheet.inventoryItems.map((entry, index) => <article key={entry.id}><div><strong>{entry.name}</strong><span>{entry.value} · {entry.notes.split("\n")[0]}</span></div><button type="button" className="subtle-button" disabled={entry.notes.includes("Origen de creación: inicial")} onClick={() => removeEquipment(index)}>Quitar</button></article>)}</div>
      </section> : null}

      {step === 4 ? <section className="actor-wizard__section"><h3>Trasfondo</h3><div className="form-grid">
        {(["sombra", "cita", "edad", "altura", "peso"] as const).map((field) => <label className="field" key={field}><span>{field[0].toUpperCase() + field.slice(1)}</span><input value={sheet.identidad[field]} onChange={(event) => controller.updateSheet(`identidad.${field}`, event.target.value)} /></label>)}
        <label className="field field-span-2"><span>Apariencia</span><textarea rows={3} value={sheet.identidad.apariencia} onChange={(event) => controller.updateSheet("identidad.apariencia", event.target.value)} /></label>
        <label className="field field-span-2"><span>Objetivo personal</span><textarea rows={3} value={sheet.identidad.objetivoPersonal} onChange={(event) => controller.updateSheet("identidad.objetivoPersonal", event.target.value)} /></label>
        <label className="field field-span-2"><span>Historia (Markdown)</span><textarea rows={7} value={sheet.identidad.trasfondo} onChange={(event) => controller.updateSheet("identidad.trasfondo", event.target.value)} /></label>
        <label className="field field-span-2"><span>Notas</span><textarea rows={5} value={sheet.notas} onChange={(event) => controller.updateSheet("notas", event.target.value)} /></label>
      </div></section> : null}
    </WizardShell>
  );
}

function AttributeEditor<K extends string>({ values, labels, keys, bonuses, onChange }: { values: Record<K, number>; labels: Record<K, string>; keys: readonly K[]; bonuses?: Record<K, number>; onChange: (key: K, value: number) => void }) {
  const validation = validateCreationAttributes(values);
  return <section className="actor-wizard__section"><div className="row-actions"><div><h3>Atributos base</h3><p className="section-help">Reparte exactamente 80 puntos. Cada valor base debe estar entre 5 y 15 y solo uno puede alcanzar 15. Atributo excepcional se aplica después y puede elevar distintos atributos hasta 18.</p></div><strong className={validation.valid ? "is-valid" : "error"}>{validation.total} / 80</strong></div><div className="actor-wizard__attribute-grid">{keys.map((key) => { const effective = bonuses?.[key] ?? values[key]; const bonus = effective - values[key]; return <label className="field" key={key}><span>{labels[key]}{bonus > 0 ? ` · final ${effective} (+${bonus})` : ""}</span><input type="number" min={5} max={15} value={values[key]} onChange={(event) => onChange(key, Number(event.target.value))} /></label>; })}</div>{!validation.valid ? <p className="error">{validation.errors.join(" ")}</p> : null}</section>;
}

type NpcController = ReturnType<typeof useNpcController>;

export function NpcCreationWizard({ controller, onCancel, onSaved }: { controller: NpcController; onCancel: () => void; onSaved: (npc: Npc) => void }) {
  const narrative = controller.draft.depth === "notes";
  const steps = narrative ? [{ id: "identity", label: "Identidad" }, { id: "background", label: "Trasfondo" }] : [{ id: "identity", label: "Identidad" }, { id: "attributes", label: "Atributos" }, { id: "capabilities", label: "Capacidades" }, { id: "equipment", label: "Equipo" }, { id: "background", label: "Trasfondo" }];
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const initialRef = useRef(JSON.stringify(controller.draft));
  const draft = controller.draft;
  const sheet = draft.sheet;
  const selections = sheet?.capabilitySelections ?? [];
  const baseAttributes = sheet ? removeExceptionalAttributeBonuses(sheet.atributos, selections) : null;
  const spent = getActorSpentXp(selections);
  const challenge = getActorChallengeFromXp(spent);

  function close() { if (JSON.stringify(draft) !== initialRef.current && !window.confirm("Hay cambios sin guardar. ¿Cerrar el creador?")) return; onCancel(); }
  function validate(index: number): boolean {
    setLocalError(null);
    if (index === 0 && draft.name.trim().length < 2) { setLocalError("El PNJ necesita un nombre."); return false; }
    if (!narrative && index === 1 && baseAttributes) { const result = validateCreationAttributes(baseAttributes); if (!result.valid) { setLocalError(result.errors.join(" ")); return false; } }
    if (!narrative && index === 2) { const errors = validateExceptionalAttributeSelections(selections, ATTRIBUTE_KEYS); if (errors.length > 0) { setLocalError(errors.join(" ")); return false; } }
    return true;
  }
  function validateThrough(index: number): boolean { for (let current = 0; current <= index; current += 1) if (!validate(current)) return false; return true; }
  async function save() {
    if (!validateThrough(steps.length - 1)) return;
    const saved = await controller.saveDraft();
    if (saved) onSaved(saved);
  }
  function setCharacterSheet(next: CharacterSheet) { controller.setDraft((current) => ({ ...current, depth: "full_sheet", sheet: next, statBlock: current.statBlock })); }

  return <WizardShell title={controller.selectedNpcId ? "Editar PNJ" : "Crear PNJ"} steps={steps} step={step} summary={narrative ? <><span>Modo <strong>Narrativo</strong></span><span>Sin estadísticas</span></> : <><span>PX usada <strong>{spent}</strong></span><span>Desafío <strong>{challenge}</strong></span></>} error={localError ?? controller.formError} busy={controller.isSaving} onStep={(index) => { if (index <= step || validateThrough(index - 1)) setStep(index); }} onPrevious={() => setStep((current) => Math.max(0, current - 1))} onNext={() => { if (validate(step)) setStep((current) => Math.min(steps.length - 1, current + 1)); }} onCancel={close} onSave={() => void save()}>
    {step === 0 ? <section className="actor-wizard__section"><h3>Identidad</h3><div className="form-grid"><label className="field"><span>Tipo de PNJ</span><select value={narrative ? "notes" : "full_sheet"} onChange={(event) => controller.updateDepth(event.target.value as "notes" | "full_sheet")}><option value="notes">Narrativo</option><option value="full_sheet">Completo</option></select></label>{(["name", "race", "archetype", "occupation", "faction"] as const).map((field) => <label className="field" key={field}><span>{{ name: "Nombre", race: "Raza", archetype: "Arquetipo", occupation: "Ocupación", faction: "Facción" }[field]}</span><input value={draft[field]} onChange={(event) => controller.updateField(field, event.target.value)} /></label>)}{!narrative && sheet ? <label className="field"><span>Cultura</span><select value={sheet.identidad.cultura} onChange={(event) => setCharacterSheet({ ...sheet, identidad: { ...sheet.identidad, cultura: event.target.value } })}>{SYMBAROUM_CULTURES.map((entry) => <option key={entry}>{entry}</option>)}</select></label> : null}<label className="field field-span-2"><span>Etiquetas</span><input value={draft.labels.join(", ")} onChange={(event) => controller.updateLabels(event.target.value)} /></label></div></section> : null}
    {!narrative && step === 1 && sheet && baseAttributes ? <AttributeEditor values={baseAttributes} labels={ATTRIBUTE_LABELS} keys={ATTRIBUTE_KEYS} bonuses={sheet.atributos} onChange={(key, value) => setCharacterSheet({ ...sheet, atributos: applyExceptionalAttributeBonuses({ ...baseAttributes, [key]: value }, selections) })} /> : null}
    {!narrative && step === 2 && sheet ? <SimpleGmCapabilities selections={selections} attributeKeys={ATTRIBUTE_KEYS} attributeLabels={ATTRIBUTE_LABELS} onChange={(next) => setCharacterSheet(updateLegacyCollections({ ...sheet, atributos: synchronizeExceptionalAttributes(sheet.atributos, selections, next) }, next))} includeMonsterTraits /> : null}
    {!narrative && step === 3 && sheet ? <SimpleGmEquipment sheet={sheet} onChange={setCharacterSheet} fixed /> : null}
    {step === steps.length - 1 ? <section className="actor-wizard__section"><h3>Trasfondo</h3><div className="form-grid"><label className="field field-span-2"><span>Resumen</span><textarea rows={4} value={draft.summary} onChange={(event) => controller.updateField("summary", event.target.value)} /></label><label className="field field-span-2"><span>Historia, personalidad, conducta y ganchos</span><textarea rows={10} value={draft.notes} onChange={(event) => controller.updateField("notes", event.target.value)} /></label>{!narrative && sheet ? <>{(["tactics", "weakness", "loot"] as const).map((field) => <label className="field field-span-2" key={field}><span>{{ tactics: "Tácticas", weakness: "Debilidad", loot: "Botín" }[field]}</span><textarea rows={4} value={sheet.gmBackground[field]} onChange={(event) => setCharacterSheet({ ...sheet, gmBackground: { ...sheet.gmBackground, [field]: event.target.value } })} /></label>)}</> : null}</div></section> : null}
  </WizardShell>;
}

type MonsterController = ReturnType<typeof useMonsterController>;

export function MonsterCreationWizard({ controller, onCancel }: { controller: MonsterController; onCancel: () => void }) {
  const steps = [{ id: "identity", label: "Identidad" }, { id: "attributes", label: "Atributos" }, { id: "capabilities", label: "Capacidades" }, { id: "equipment", label: "Equipo" }, { id: "background", label: "Trasfondo" }];
  const [step, setStep] = useState(0); const [localError, setLocalError] = useState<string | null>(null); const initialRef = useRef(JSON.stringify(controller.draft));
  const draft = controller.draft; const sheet = draft.sheet;
  const baseAttributes = removeExceptionalAttributeBonuses(sheet.attributes, sheet.capabilities);
  function validate(index: number) { setLocalError(null); if (index === 0 && draft.name.trim().length < 2) { setLocalError("El monstruo necesita un nombre."); return false; } if (index === 1) { const result = validateCreationAttributes(baseAttributes); if (!result.valid) { setLocalError(result.errors.join(" ")); return false; } } if (index === 2) { const errors = validateExceptionalAttributeSelections(sheet.capabilities, MONSTER_ATTRIBUTE_KEYS); if (errors.length > 0) { setLocalError(errors.join(" ")); return false; } } return true; }
  function validateThrough(index: number) { for (let current = 0; current <= index; current += 1) if (!validate(current)) return false; return true; }
  function close() { if (JSON.stringify(draft) !== initialRef.current && !window.confirm("Hay cambios sin guardar. ¿Cerrar el creador?")) return; onCancel(); }
  async function save() { if (!validateThrough(steps.length - 1)) return; if (await controller.saveDraft()) onCancel(); }
  return <WizardShell title={controller.selectedCustomId ? "Editar monstruo" : "Crear monstruo"} steps={steps} step={step} summary={<><span>PX usada <strong>{controller.draftSpentXp}</strong></span><span>Desafío <strong>{controller.draftChallenge}</strong></span><span>Daño medio <strong>{averageDiceFormula(sheet.damage) ?? "-"}</strong></span><span>Armadura media <strong>{averageDiceFormula(sheet.armor) ?? "-"}</strong></span></>} error={localError ?? controller.formError} busy={controller.isSaving} onStep={(index) => { if (index <= step || validateThrough(index - 1)) setStep(index); }} onPrevious={() => setStep((current) => Math.max(0, current - 1))} onNext={() => { if (validate(step)) setStep((current) => Math.min(steps.length - 1, current + 1)); }} onCancel={close} onSave={() => void save()}>
    {step === 0 ? <section className="actor-wizard__section"><h3>Identidad</h3><div className="form-grid"><label className="field"><span>Nombre</span><input value={draft.name} onChange={(event) => controller.updateField("name", event.target.value)} /></label><label className="field"><span>Categoría</span><select value={draft.category} onChange={(event) => controller.updateField("category", event.target.value)}>{["Abominación", "Bestia", "Fenómeno", "Flora", "Muerto viviente", "Ser civilizado"].map((entry) => <option key={entry}>{entry}</option>)}</select></label><label className="field"><span>Fuente</span><input value={draft.source} onChange={(event) => controller.updateField("source", event.target.value)} /></label><label className="field"><span>Desafío calculado</span><input readOnly value={controller.draftChallenge} /></label></div></section> : null}
    {step === 1 ? <AttributeEditor values={baseAttributes} labels={MONSTER_ATTRIBUTE_LABELS} keys={MONSTER_ATTRIBUTE_KEYS} bonuses={sheet.attributes} onChange={(key, value) => controller.setDraft((current) => ({ ...current, sheet: { ...current.sheet, attributes: applyExceptionalAttributeBonuses({ ...baseAttributes, [key]: value }, sheet.capabilities) } }))} /> : null}
    {step === 2 ? <SimpleGmCapabilities selections={sheet.capabilities} attributeKeys={MONSTER_ATTRIBUTE_KEYS} attributeLabels={MONSTER_ATTRIBUTE_LABELS} onChange={(capabilities) => controller.setDraft((current) => ({ ...current, sheet: { ...current.sheet, attributes: synchronizeExceptionalAttributes(current.sheet.attributes, current.sheet.capabilities, capabilities), capabilities }, threat: getActorChallengeFromXp(getActorSpentXp(capabilities)) }))} includeMonsterTraits /> : null}
    {step === 3 ? <section className="actor-wizard__section"><h3>Equipo y valores de combate</h3><p className="section-help">Introduce las fórmulas originales. La ficha del DJ mostrará sus valores medios y no lanzará estos dados.</p><SimpleMonsterEquipment sheet={sheet} onChange={(nextSheet) => controller.setDraft((current) => ({ ...current, sheet: nextSheet }))} /><div className="form-grid">{(["attack", "damage", "defense", "armor", "toughness", "painThreshold", "movement"] as const).map((field) => <label className="field" key={field}><span>{{ attack: "Ataque", damage: "Daño", defense: "Defensa", armor: "Armadura", toughness: "Robustez", painThreshold: "Umbral de dolor", movement: "Movimiento" }[field]}</span><input value={sheet[field]} onChange={(event) => controller.updateSheetField(field, event.target.value)} />{field === "damage" || field === "armor" ? <small>Valor medio: {averageDiceFormula(sheet[field]) ?? "No calculable"}</small> : null}</label>)}</div></section> : null}
    {step === 4 ? <section className="actor-wizard__section"><h3>Trasfondo</h3><div className="form-grid"><label className="field field-span-2"><span>Resumen</span><textarea rows={4} value={draft.summary} onChange={(event) => controller.updateField("summary", event.target.value)} /></label>{(["tactics", "weakness", "loot"] as const).map((field) => <label className="field field-span-2" key={field}><span>{{ tactics: "Tácticas", weakness: "Debilidad", loot: "Botín" }[field]}</span><textarea rows={5} value={sheet[field]} onChange={(event) => controller.updateSheetField(field, event.target.value)} /></label>)}</div></section> : null}
  </WizardShell>;
}

function SimpleGmCapabilities({ selections, onChange, includeMonsterTraits, attributeKeys, attributeLabels }: { selections: ActorCapabilitySelection[]; onChange: (entries: ActorCapabilitySelection[]) => void; includeMonsterTraits?: boolean; attributeKeys: readonly string[]; attributeLabels: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const catalog: CatalogChoice[] = useMemo(() => {
    const normal = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS].map((entry) => ({ id: entry.id, name: entry.nombre, kind: entry.tipo as ActorCapabilityKind, source: entry.libro, page: entry.pagina, effect: entry.efectoResumen }));
    const traits = includeMonsterTraits ? ALL_ENTRIES.filter((entry) => entry.tipo === "rasgo").map((entry) => ({ id: entry.id, name: entry.nombre, kind: "rasgo_monstruoso" as const, source: entry.fuente, page: entry.pagina, effect: entry.resumen })) : [];
    return [...normal, ...traits];
  }, [includeMonsterTraits]);
  const shown = catalog.filter((entry) => normalize(`${entry.name} ${entry.effect}`).includes(normalize(query))).slice(0, 80);
  return <section className="actor-wizard__section"><div className="row-actions"><div><h3>Capacidades</h3><p className="section-help">El DJ no tiene límite de PX; el total determina el desafío.</p></div><strong>{getActorSpentXp(selections)} PX · {getActorChallengeFromXp(getActorSpentXp(selections))}</strong></div><input type="search" placeholder="Buscar en el catálogo..." value={query} onChange={(event) => setQuery(event.target.value)} /><div className="actor-wizard__catalog-list">{shown.map((entry) => <article key={entry.id}><div><strong>{entry.name}</strong><span>{entry.source}</span><small>{entry.effect}</small></div><button type="button" onClick={() => { const exceptional = normalize(entry.name) === "atributo excepcional"; const attributeKey = exceptional ? attributeKeys.find((key) => !selections.some((current) => isExceptionalAttributeSelection(current) && current.attributeKey === key)) : undefined; if (exceptional && !attributeKey) return; if (!exceptional && selections.some((current) => current.catalogId === entry.id)) return; onChange([...selections, { catalogId: entry.id, name: entry.name, kind: entry.kind, level: entry.kind === "ritual" ? undefined : "novato", origin: "comprada", source: entry.source, page: entry.page, repeatable: exceptional || undefined, attributeKey }]); }}>Añadir</button></article>)}</div><h4>Seleccionadas</h4><div className="actor-wizard__selection-list">{selections.map((entry, index) => <article key={`${entry.catalogId}-${index}`}><div><strong>{entry.name}</strong><span>{entry.kind.replaceAll("_", " ")}</span></div>{isExceptionalAttributeSelection(entry) ? <select aria-label={`Atributo para ${entry.name}`} value={entry.attributeKey ?? ""} onChange={(event) => onChange(selections.map((current, currentIndex) => currentIndex === index ? { ...current, attributeKey: event.target.value } : current))}><option value="" disabled>Elige atributo</option>{attributeKeys.map((key) => <option key={key} value={key} disabled={selections.some((other, otherIndex) => otherIndex !== index && isExceptionalAttributeSelection(other) && other.attributeKey === key)}>{attributeLabels[key] ?? key}</option>)}</select> : null}{entry.kind !== "ritual" ? <select value={entry.level ?? "novato"} onChange={(event) => onChange(selections.map((current, currentIndex) => currentIndex === index ? { ...current, level: event.target.value as SkillLevel } : current))}><option value="novato">Novato · 10 PX</option><option value="adepto">Adepto · 30 PX</option><option value="maestro">Maestro · 60 PX</option></select> : null}<button type="button" className="subtle-button" onClick={() => onChange(selections.filter((_, currentIndex) => currentIndex !== index))}>Quitar</button></article>)}</div></section>;
}

function SimpleGmEquipment({ sheet, onChange, fixed }: { sheet: CharacterSheet; onChange: (sheet: CharacterSheet) => void; fixed?: boolean }) {
  const [query, setQuery] = useState(""); const shown = ITEM_CATALOG.filter((entry) => normalize(`${entry.name} ${entry.category}`).includes(normalize(query))).slice(0, 80);
  return <section className="actor-wizard__section"><h3>Equipo</h3><p className="section-help">El DJ puede escoger libremente objetos. Los dados se conservan y se muestran como promedio fijo.</p><input type="search" placeholder="Buscar equipo..." value={query} onChange={(event) => setQuery(event.target.value)} /><div className="actor-wizard__catalog-list">{shown.map((entry) => <article key={entry.templateId}><div><strong>{entry.name}</strong><span>{entry.value}</span><small>{fixed && (entry.damageFormula || entry.protectionFormula) ? `Promedio: ${averageDiceFormula(entry.damageFormula || entry.protectionFormula) ?? "-"}` : entry.description}</small></div><button type="button" onClick={() => onChange({ ...sheet, inventoryItems: [...sheet.inventoryItems, makeInventoryItem(entry, "concedido", sheet.inventoryItems.length)], equipo: [...sheet.equipo, entry.name] })}>Añadir</button></article>)}</div><div className="actor-wizard__selection-list">{sheet.inventoryItems.map((entry, index) => <article key={entry.id}><div><strong>{entry.name}</strong><span>{entry.damageFormula || entry.protectionFormula}{fixed ? ` → ${averageDiceFormula(entry.damageFormula || entry.protectionFormula) ?? "-"}` : ""}</span></div><button type="button" className="subtle-button" onClick={() => onChange({ ...sheet, inventoryItems: sheet.inventoryItems.filter((_, currentIndex) => currentIndex !== index), equipo: sheet.equipo.filter((name) => name !== entry.name) })}>Quitar</button></article>)}</div></section>;
}

function SimpleMonsterEquipment({ sheet, onChange }: { sheet: MonsterSheet; onChange: (sheet: MonsterSheet) => void }) {
  const [query, setQuery] = useState("");
  const equipment = sheet.equipment ?? [];
  const shown = ITEM_CATALOG.filter((entry) => normalize(`${entry.name} ${entry.category} ${entry.qualities}`).includes(normalize(query))).slice(0, 80);
  return <div className="actor-wizard__monster-equipment"><input type="search" placeholder="Buscar equipo del catálogo..." value={query} onChange={(event) => setQuery(event.target.value)} /><div className="actor-wizard__catalog-list">{shown.map((entry) => { const formula = entry.damageFormula || entry.protectionFormula; return <article key={entry.templateId}><div><strong>{entry.name}</strong><span>{entry.value} · {entry.category}</span><small>{formula ? `${formula} → valor fijo ${averageDiceFormula(formula) ?? "-"}` : entry.description}</small></div><button type="button" onClick={() => { const nextEquipment = [...equipment, { catalogId: entry.templateId, name: entry.name, category: entry.category, damageFormula: entry.damageFormula, protectionFormula: entry.protectionFormula, fixedValue: averageDiceFormula(formula), value: entry.value, qualities: entry.qualities, notes: entry.notes }]; onChange({ ...sheet, equipment: nextEquipment, damage: entry.category === "weapon" && entry.damageFormula ? entry.damageFormula : sheet.damage, armor: entry.category === "armor" && entry.protectionFormula ? entry.protectionFormula : sheet.armor }); }}>Añadir</button></article>; })}</div><div className="actor-wizard__selection-list">{equipment.map((entry, index) => <article key={`${entry.catalogId}-${index}`}><div><strong>{entry.name}</strong><span>{entry.damageFormula || entry.protectionFormula || entry.value}{entry.fixedValue != null ? ` → ${entry.fixedValue}` : ""}</span></div><button type="button" className="subtle-button" onClick={() => onChange({ ...sheet, equipment: equipment.filter((_, currentIndex) => currentIndex !== index) })}>Quitar</button></article>)}</div></div>;
}
