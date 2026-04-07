import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  buildRollRequest,
  deriveCharacterActions,
  executeCharacterAction,
  synchronizeCharacterSheet,
  type ActionRollResult,
  type CharacterActionDefinition,
  type CharacterActionPhase,
  type CharacterSheet,
  type RollDestination,
  type RollRequest
} from "@umbra/shared";
import { computeDerivedStats } from "../models/rulesEngine";
import { useUnifiedCharacterSheet } from "../hooks/useUnifiedCharacterSheet";
import {
  dispatchRoll20Request,
  setRollDestination as persistRollDestination,
  type Roll20Visibility
} from "../services/rollTransport";

type TabId = "actions" | "inventory" | "abilities" | "background" | "notes";
type CapabilityTabId = "traits" | "abilities" | "powers" | "rituals";
type RatedEntry = CharacterSheet["habilidades"][number];

type Props = {
  title: string;
  subtitle: string;
  sheet: CharacterSheet;
  editable: boolean;
  busy?: boolean;
  onSave?: (sheet: CharacterSheet) => Promise<void>;
  onBack?: () => void;
  onOpenCompendiumCapability?: (tipo: "habilidad" | "poder_mistico" | "ritual", nombre: string) => void;
};

type PendingRollConfirmation = {
  request: RollRequest;
  title: string;
  visibility: Roll20Visibility;
};

export function UnifiedCharacterSheet({
  title,
  subtitle,
  sheet,
  editable,
  busy = false,
  onSave,
  onBack,
  onOpenCompendiumCapability
}: Props) {
  const { draft, editMode, isDirty, isSavingLocal, setDraft, setEditMode, updateField, save } = useUnifiedCharacterSheet({
    sheet,
    editable,
    onSave
  });
  const canEditNotes = editMode && editable;
  const [activeTab, setActiveTab] = useState<TabId>("actions");
  const [activeCapabilityTab, setActiveCapabilityTab] = useState<CapabilityTabId>("abilities");
  const [history, setHistory] = useState<Array<{ title: string; detail?: string; rolls: ActionRollResult[] }>>([]);
  const rollDestination: RollDestination = "roll20";
  const [pendingRollConfirmation, setPendingRollConfirmation] = useState<PendingRollConfirmation | null>(null);

  const normalizedSheet = useMemo(() => synchronizeCharacterSheet(draft), [draft]);
  const derived = useMemo(() => computeDerivedStats(normalizedSheet), [normalizedSheet]);
  const actions = useMemo(() => deriveCharacterActions(normalizedSheet), [normalizedSheet]);
  const displayName = normalizedSheet.identidad.nombrePersonaje || title;
  const equippedItems = useMemo(
    () => normalizedSheet.inventoryItems.filter((item) => item.equipped),
    [normalizedSheet.inventoryItems]
  );
  const equippedArmor = useMemo(
    () => equippedItems.find((item) => item.category === "armor") ?? null,
    [equippedItems]
  );

  useEffect(() => {
    persistRollDestination("roll20");
  }, []);

  function pushHistory(titleText: string, rolls: ActionRollResult[], detail?: string): void {
    setHistory((current) => [{ title: titleText, detail, rolls }, ...current].slice(0, 12));
  }

  function queueRoll20Request(request: RollRequest, requestTitle: string): void {
    setPendingRollConfirmation({ request, title: requestTitle, visibility: "public" });
  }

  function runAction(action: CharacterActionDefinition, phase: CharacterActionPhase): void {
    if (rollDestination !== "umbra") {
      queueRoll20Request(buildRollRequest(normalizedSheet, displayName, action.id, phase, rollDestination), `${action.label} · ${phase === "damage" ? "Danio" : "Tirada"}`);
      return;
    }

    const result = executeCharacterAction(normalizedSheet, action.id, phase);
    pushHistory(result.action.label, result.rolls, result.action.effectSummary);
  }

  function runAttributeRoll(attribute: keyof CharacterSheet["atributos"]): void {
    const label = `Prueba de ${ATTRIBUTE_LABELS[attribute]}`;
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        {
          kind: "check",
          phase: "attack",
          characterName: displayName,
          actionId: `attribute:${attribute}`,
          actionLabel: label,
          sourceName: ATTRIBUTE_LABELS[attribute],
          sourceType: "ability",
          formula: "1d20",
          target: normalizedSheet.atributos[attribute],
          rollAttribute: attribute,
          destination: rollDestination
        },
        label
      );
      return;
    }

    const total = Math.floor(Math.random() * 20) + 1;
    pushHistory(label, [{
      kind: "attribute_check",
      label,
      dice: [total],
      formula: "1d20",
      total,
      target: normalizedSheet.atributos[attribute],
      success: total <= normalizedSheet.atributos[attribute]
    }]);
  }

  function runDefenseRoll(): void {
    const label = "Defensa";
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        {
          kind: "check",
          phase: "attack",
          characterName: displayName,
          actionId: "derived:defense",
          actionLabel: label,
          sourceName: label,
          sourceType: "ability",
          formula: "1d20",
          target: derived.defensaTotal,
          destination: rollDestination
        },
        label
      );
      return;
    }

    const total = Math.floor(Math.random() * 20) + 1;
    pushHistory(label, [{
      kind: "attribute_check",
      label,
      dice: [total],
      formula: "1d20",
      total,
      target: derived.defensaTotal,
      success: total <= derived.defensaTotal
    }]);
  }

  function runArmorRoll(): void {
    const formula = equippedArmor?.protectionFormula || normalizedSheet.combate.armaduraProteccion;
    if (!formula) return;
    const label = equippedArmor?.name || normalizedSheet.combate.armadura || "Armadura";
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        {
          kind: "damage",
          phase: "damage",
          characterName: displayName,
          actionId: `armor:${equippedArmor?.id ?? "legacy"}`,
          actionLabel: label,
          sourceName: label,
          sourceType: "ability",
          formula,
          destination: rollDestination
        },
        `${label} · Proteccion`
      );
      return;
    }

    const match = formula.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) return;
    const diceCount = Number(match[1]);
    const diceSides = Number(match[2]);
    const modifier = Number(match[3] ?? "0");
    let total = modifier;
    const dice: number[] = [];
    for (let index = 0; index < diceCount; index += 1) {
      const die = Math.floor(Math.random() * diceSides) + 1;
      dice.push(die);
      total += die;
    }
    pushHistory(`${label} · Proteccion`, [{
      kind: "damage",
      label: "Proteccion",
      dice,
      formula,
      total
    }]);
  }

  async function handleConfirmRoll20Send(visibility: Roll20Visibility): Promise<void> {
    if (!pendingRollConfirmation) return;
    try {
      await dispatchRoll20Request(pendingRollConfirmation.request, visibility);
    } catch (error) {
      void error;
    } finally {
      setPendingRollConfirmation(null);
    }
  }

  function updateRatedEntry(section: "habilidades" | "poderesMisticos" | "rituales", index: number, field: "nombre" | "tipo" | "efecto" | "nivel" | "fuente" | "pagina" | "notas", value: string | number): void {
    setDraft({
      ...draft,
      [section]: draft[section].map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: value } : entry))
    });
  }

  function addRatedEntry(section: "habilidades" | "poderesMisticos" | "rituales"): void {
    setDraft({
      ...draft,
      [section]: [...draft[section], { nombre: "", tipo: "", efecto: "", nivel: "novato", fuente: "", pagina: undefined, notas: "", acciones: [] }]
    });
  }

  function removeRatedEntry(section: "habilidades" | "poderesMisticos" | "rituales", index: number): void {
    setDraft({ ...draft, [section]: draft[section].filter((_, entryIndex) => entryIndex !== index) });
  }

  function updateInventoryItem(index: number, field: keyof CharacterSheet["inventoryItems"][number], value: string | number | boolean): void {
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    });
  }

  function addInventoryItem(): void {
    setDraft({
      ...draft,
      inventoryItems: [...draft.inventoryItems, { id: `custom-item-${Date.now()}`, name: "", category: "gear", quantity: 1, description: "", weight: "", value: "", equipped: false, slot: "none", attackAttribute: undefined, damageFormula: "", protectionFormula: "", qualities: "", notes: "" }]
    });
  }

  function removeInventoryItem(index: number): void {
    const removedId = draft.inventoryItems[index]?.id;
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.filter((_, itemIndex) => itemIndex !== index),
      equipmentSlots: {
        mainHand: draft.equipmentSlots.mainHand === removedId ? "" : draft.equipmentSlots.mainHand,
        offHand: draft.equipmentSlots.offHand === removedId ? "" : draft.equipmentSlots.offHand,
        ranged: draft.equipmentSlots.ranged === removedId ? "" : draft.equipmentSlots.ranged,
        armor: draft.equipmentSlots.armor === removedId ? "" : draft.equipmentSlots.armor,
        artifact: draft.equipmentSlots.artifact === removedId ? "" : draft.equipmentSlots.artifact,
        worn: draft.equipmentSlots.worn === removedId ? "" : draft.equipmentSlots.worn
      }
    });
  }

  function updateCondition(index: number, field: keyof CharacterSheet["conditions"][number], value: string | boolean): void {
    setDraft({ ...draft, conditions: draft.conditions.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)) });
  }

  function addCondition(): void {
    setDraft({ ...draft, conditions: [...draft.conditions, { id: `condition-${Date.now()}`, name: "", category: "custom", active: true, severity: "minor", summary: "", notes: "" }] });
  }

  function removeCondition(index: number): void {
    setDraft({ ...draft, conditions: draft.conditions.filter((_, itemIndex) => itemIndex !== index) });
  }

  function adjustNumber(path: string, delta: number, min = 0): void {
    const parts = path.split(".");
    let cursor: Record<string, unknown> = normalizedSheet as unknown as Record<string, unknown>;
    for (let index = 0; index < parts.length - 1; index += 1) {
      cursor = cursor[parts[index]] as Record<string, unknown>;
    }
    const key = parts[parts.length - 1];
    const current = typeof cursor[key] === "number" ? Number(cursor[key]) : 0;
    updateField(path, Math.max(min, current + delta));
  }

  function renderTabStage(className = "unified-sheet-stage campaign-sheet-card"): ReactNode {
    return (
      <section className={className}>
        <nav className="unified-sheet-tabs">
          {([
            ["actions", "Acciones"],
            ["inventory", "Inventario"],
            ["abilities", "Capacidades"],
            ["background", "Trasfondo"],
            ["notes", "Notas"]
          ] as Array<[TabId, string]>).map(([tab, label]) => (
            <button key={tab} type="button" className={activeTab === tab ? "is-active" : ""} onClick={() => setActiveTab(tab)}>{label}</button>
          ))}
        </nav>

        <div className="unified-sheet-tab-content">
          {activeTab === "actions" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <div className="row-actions">
                  <h3>Acciones disponibles</h3>
                </div>
                <div className="campaign-sheet-actions">
                  {actions.map((action, index) => (
                    <div key={action.id} className="campaign-action-button">
                      <strong>{action.label}</strong>
                      <span>{action.sourceName}</span>
                      <span>{action.cost}{action.rollAttribute ? ` · ${ATTRIBUTE_LABELS[action.rollAttribute]}` : ""}{action.damageFormula ? ` · ${action.damageFormula}` : ""}</span>
                      <p>{action.effectSummary}</p>
                      <div className="campaign-action-controls">
                        {action.rollAttribute ? <button type="button" onClick={() => runAction(action, "attack")}>Tirar</button> : null}
                        {action.damageFormula ? <button type="button" onClick={() => runAction(action, "damage")}>Danio</button> : null}
                      </div>
                    </div>
                  ))}
                  {actions.length === 0 ? <p className="section-help">Sin acciones registradas.</p> : null}
                </div>
              </article>

              <article className="campaign-sheet-card">
                <h3>Historial</h3>
                {history.length > 0 ? (
                  <div className="roll-log">
                    {history.map((entry, index) => (
                      <div key={`${entry.title}-${index}`} className="character-action-history-entry">
                        <strong>{entry.title}</strong>
                        <div className="campaign-roll-group-lines">
                          {entry.rolls.map((roll, rollIndex) => (
                            <span key={`${entry.title}-${rollIndex}`}>{roll.label}: {roll.formula} = {roll.total}{typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "exito" : "fallo"}` : ""}</span>
                          ))}
                        </div>
                        {entry.detail ? <p>{entry.detail}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="section-help">Aun no has lanzado ninguna tirada desde esta hoja.</p>
                )}
              </article>
            </section>
          ) : null}

          {activeTab === "inventory" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <div className="row-actions">
                  <h3>Inventario y equipo</h3>
                </div>
                <div className="form-grid">
                  <Field label="Dinero"><input disabled value={normalizedSheet.recursos.dinero} onChange={(event) => updateField("recursos.dinero", event.target.value)} /></Field>
                  <Field label="Otros recursos"><input disabled value={normalizedSheet.recursos.otros} onChange={(event) => updateField("recursos.otros", event.target.value)} /></Field>
                </div>
                <div className="unified-sheet-list">
                  {normalizedSheet.inventoryItems.map((item, index) => (
                    <article key={item.id} className="campaign-structured-card">
                      <div className="form-grid">
                        <Field label="Nombre"><input disabled value={item.name} onChange={(event) => updateInventoryItem(index, "name", event.target.value)} /></Field>
                        <Field label="Categoria">
                          <select disabled value={item.category} onChange={(event) => updateInventoryItem(index, "category", event.target.value)}>
                            <option value="weapon">Arma</option>
                            <option value="armor">Armadura</option>
                            <option value="gear">Equipo</option>
                            <option value="consumable">Consumible</option>
                            <option value="artifact">Artefacto</option>
                            <option value="treasure">Tesoro</option>
                            <option value="other">Otro</option>
                          </select>
                        </Field>
                        <Field label="Cantidad"><input disabled type="number" min={0} value={item.quantity} onChange={(event) => updateInventoryItem(index, "quantity", Number(event.target.value || 0))} /></Field>
                        <Field label="Equipada">
                          <select disabled value={item.equipped ? "si" : "no"} onChange={(event) => updateInventoryItem(index, "equipped", event.target.value === "si")}>
                            <option value="si">Si</option>
                            <option value="no">No</option>
                          </select>
                        </Field>
                        <Field label="Ranura">
                          <select disabled value={item.slot} onChange={(event) => updateInventoryItem(index, "slot", event.target.value)}>
                            <option value="none">Ninguna</option>
                            <option value="mainHand">Mano principal</option>
                            <option value="offHand">Mano secundaria</option>
                            <option value="ranged">A distancia</option>
                            <option value="armor">Armadura</option>
                            <option value="artifact">Artefacto</option>
                            <option value="worn">Vestido</option>
                          </select>
                        </Field>
                        <Field label="Danio / proteccion"><input disabled value={item.category === "armor" ? item.protectionFormula : item.damageFormula} onChange={(event) => updateInventoryItem(index, item.category === "armor" ? "protectionFormula" : "damageFormula", event.target.value)} /></Field>
                      </div>
                      <textarea disabled rows={2} value={item.description} onChange={(event) => updateInventoryItem(index, "description", event.target.value)} />
                    </article>
                  ))}
                </div>
              </article>

              <article className="campaign-sheet-card">
                <h3>Ranuras equipadas</h3>
                <div className="form-grid">
                  {(["mainHand", "offHand", "ranged", "armor", "artifact", "worn"] as const).map((slot) => (
                    <Field key={slot} label={slotLabel(slot)}>
                      <select disabled value={normalizedSheet.equipmentSlots[slot]} onChange={(event) => updateField(`equipmentSlots.${slot}`, event.target.value)}>
                        <option value="">Sin asignar</option>
                        {normalizedSheet.inventoryItems.map((item) => (
                          <option key={`${slot}-${item.id}`} value={item.id}>{item.name || item.id}</option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
              </article>
            </section>
          ) : null}

          {activeTab === "abilities" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <nav className="unified-sheet-subtabs" aria-label="Tipos de capacidades">
                  {([
                    ["traits", "Rasgos"],
                    ["abilities", "Habilidades"],
                    ["powers", "Poderes"],
                    ["rituals", "Rituales"]
                  ] as Array<[CapabilityTabId, string]>).map(([tab, label]) => (
                    <button key={tab} type="button" className={activeCapabilityTab === tab ? "is-active" : ""} onClick={() => setActiveCapabilityTab(tab)}>
                      {label}
                    </button>
                  ))}
                </nav>

                {activeCapabilityTab === "traits" ? (
                  <div className="unified-sheet-capability-card">
                    <h3>Rasgos</h3>
                    <p className="unified-sheet-rich-text">
                      {normalizedSheet.noteSections.traits.trim() || "Sin rasgos registrados."}
                    </p>
                  </div>
                ) : null}

                {activeCapabilityTab === "abilities" ? (
                  <CapabilityTextList
                    title="Habilidades"
                    entries={normalizedSheet.habilidades}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined}
                  />
                ) : null}

                {activeCapabilityTab === "powers" ? (
                  <CapabilityTextList
                    title="Poderes misticos"
                    entries={normalizedSheet.poderesMisticos}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined}
                  />
                ) : null}

                {activeCapabilityTab === "rituals" ? (
                  <CapabilityTextList
                    title="Rituales"
                    entries={normalizedSheet.rituales}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined}
                  />
                ) : null}
              </article>
            </section>
          ) : null}

          {activeTab === "background" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <h3>Trasfondo</h3>
                <div className="form-grid">
                  <Field label="Sombra"><input disabled value={normalizedSheet.identidad.sombra} onChange={(event) => updateField("identidad.sombra", event.target.value)} /></Field>
                  <Field label="Cita"><input disabled value={normalizedSheet.identidad.cita} onChange={(event) => updateField("identidad.cita", event.target.value)} /></Field>
                  <Field label="Edad"><input disabled value={normalizedSheet.identidad.edad} onChange={(event) => updateField("identidad.edad", event.target.value)} /></Field>
                  <Field label="Altura"><input disabled value={normalizedSheet.identidad.altura} onChange={(event) => updateField("identidad.altura", event.target.value)} /></Field>
                  <Field label="Peso"><input disabled value={normalizedSheet.identidad.peso} onChange={(event) => updateField("identidad.peso", event.target.value)} /></Field>
                </div>
                <Field label="Apariencia"><textarea disabled rows={2} value={normalizedSheet.identidad.apariencia} onChange={(event) => updateField("identidad.apariencia", event.target.value)} /></Field>
                <Field label="Objetivo personal"><textarea disabled rows={2} value={normalizedSheet.identidad.objetivoPersonal} onChange={(event) => updateField("identidad.objetivoPersonal", event.target.value)} /></Field>
                <Field label="Historia"><textarea disabled rows={8} value={normalizedSheet.noteSections.background} onChange={(event) => updateField("noteSections.background", event.target.value)} /></Field>
              </article>
            </section>
          ) : null}

          {activeTab === "notes" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <h3>Notas y contexto</h3>
                <Field label="Notas generales"><textarea disabled={!canEditNotes} rows={6} value={normalizedSheet.noteSections.general} onChange={(event) => updateField("noteSections.general", event.target.value)} /></Field>
                <Field label="Notas de campana"><textarea disabled={!canEditNotes} rows={4} value={normalizedSheet.noteSections.campaign} onChange={(event) => updateField("noteSections.campaign", event.target.value)} /></Field>
                <div className="form-grid">
                  <Field label="Grupo"><input disabled value={normalizedSheet.grupo.nombre} onChange={(event) => updateField("grupo.nombre", event.target.value)} /></Field>
                  <Field label="Objetivo del grupo"><textarea disabled rows={2} value={normalizedSheet.grupo.objetivo} onChange={(event) => updateField("grupo.objetivo", event.target.value)} /></Field>
                </div>
              </article>

              <article className="campaign-sheet-card">
                <h3>Contactos</h3>
                <div className="unified-sheet-list">
                  {normalizedSheet.contactosHoja.map((contacto, index) => (
                    <article key={`contacto-${index}`} className="campaign-structured-card">
                      <div className="form-grid">
                        <Field label="Nombre"><input disabled value={contacto.nombre} onChange={(event) => updateField(`contactosHoja.${index}.nombre`, event.target.value)} /></Field>
                        <Field label="Raza"><input disabled value={contacto.raza} onChange={(event) => updateField(`contactosHoja.${index}.raza`, event.target.value)} /></Field>
                        <Field label="Ocupacion"><input disabled value={contacto.ocupacion} onChange={(event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value)} /></Field>
                        <Field label="Jugador"><input disabled value={contacto.jugador} onChange={(event) => updateField(`contactosHoja.${index}.jugador`, event.target.value)} /></Field>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </section>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className={`unified-sheet is-tab-${activeTab}`}>
      <section className="unified-sheet-persistent campaign-sheet-card">
        <div className="unified-sheet-header-band">
          <div className="unified-sheet-hero-main">
            <div className="unified-sheet-portrait">
              <div className="unified-sheet-portrait-ring" />
              <div className="unified-sheet-portrait-content">
                <span>{String(normalizedSheet.identidad.arquetipo).slice(0, 1)}</span>
              </div>
            </div>
            <div className="unified-sheet-identity">
              <h2 className="unified-sheet-title">{displayName}</h2>
              {subtitle ? <span className="unified-sheet-inline-subtitle">{subtitle}</span> : null}
            </div>
          </div>

          <section className="unified-sheet-header-stats">
            <div className="unified-sheet-vital-card is-health">
              <div className="unified-sheet-vital-header">
                <span>Robustez</span>
                <strong>{derived.robustezActualTotal} / {derived.robustezMaximaTotal}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.robustezMaximaTotal > 0 ? (derived.robustezActualTotal / derived.robustezMaximaTotal) * 100 : 0)}%` }} /></div>
              <div className="unified-sheet-vital-actions">
                <button type="button" className="vital-action gain" onClick={() => adjustNumber("combate.robustezActual", 1)}>+1 Vida</button>
                <button type="button" className="vital-action loss" onClick={() => adjustNumber("combate.robustezActual", -1)}>-1 Danio</button>
              </div>
            </div>

            <div className="unified-sheet-vital-card is-corruption">
              <div className="unified-sheet-vital-header">
                <span>Corrupcion temporal</span>
                <strong>{normalizedSheet.corrupcion.temporal}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.temporal / derived.umbralCorrupcionTotal) * 100 : 0)}%` }} /></div>
              <div className="unified-sheet-vital-actions">
                <button type="button" className="vital-action corruption" onClick={() => adjustNumber("corrupcion.temporal", 1)}>+1 Temp</button>
                <button type="button" className="vital-action subtle" onClick={() => adjustNumber("corrupcion.temporal", -1)}>-1 Temp</button>
              </div>
            </div>

            <div className="unified-sheet-vital-card is-corruption-deep">
              <div className="unified-sheet-vital-header">
                <span>Corrupcion permanente</span>
                <strong>{normalizedSheet.corrupcion.permanente}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.permanente / derived.umbralCorrupcionTotal) * 100 : 0)}%` }} /></div>
              <div className="unified-sheet-vital-actions">
                <button type="button" className="vital-action corruption-deep" onClick={() => adjustNumber("corrupcion.permanente", 1)}>+1 Perm</button>
                <button type="button" className="vital-action subtle-dark" onClick={() => adjustNumber("corrupcion.permanente", -1)}>-1 Perm</button>
              </div>
            </div>
          </section>
        </div>

        <div className="unified-sheet-body-grid">
          {renderTabStage("unified-sheet-stage unified-sheet-dynamic-column campaign-sheet-card")}
          <section className="unified-sheet-static-column">
            <div className="unified-sheet-attribute-rail">
              {ATTRIBUTE_KEYS.map((key) => (
                <div key={key} className="unified-sheet-attribute-chip">
                  <span>{ATTRIBUTE_LABELS[key]}</span>
                  <strong>{normalizedSheet.atributos[key]}</strong>
                  <button type="button" className="vital-action subtle" onClick={() => runAttributeRoll(key)}>Tirar</button>
                </div>
              ))}
            </div>
            <div className="unified-sheet-static-summary">
              <div className="unified-sheet-quick-row is-primary">
                <article className="unified-sheet-quick-card is-defense-card">
                  <div className="row-actions">
                    <h3>Defensa</h3>
                    <strong>{derived.defensaTotal}</strong>
                  </div>
                  <div className="unified-sheet-vital-actions">
                    <button type="button" className="vital-action subtle is-defense-roll" onClick={runDefenseRoll}>Tirar Defensa</button>
                  </div>
                </article>

                <article className="unified-sheet-quick-card">
                  <div className="row-actions">
                    <h3>Armadura</h3>
                    <strong>{equippedArmor?.protectionFormula || normalizedSheet.combate.armaduraProteccion || "-"}</strong>
                  </div>
                  <strong>{equippedArmor?.name || normalizedSheet.combate.armadura || "Sin armadura"}</strong>
                  <div className="unified-sheet-vital-actions">
                    <button type="button" className="vital-action subtle" onClick={runArmorRoll} disabled={!(equippedArmor?.protectionFormula || normalizedSheet.combate.armaduraProteccion)}>Tirar Armadura</button>
                  </div>
                </article>
              </div>

              <div className="unified-sheet-quick-row is-derived">
                <article className="unified-sheet-quick-card is-derived-card">
                  <h3>Iniciativa</h3>
                  <strong>{derived.iniciativaTotal}</strong>
                </article>

                <article className="unified-sheet-quick-card is-derived-card">
                  <h3>Umbral de corrupcion</h3>
                  <strong>{derived.umbralCorrupcionTotal}</strong>
                </article>

                <article className="unified-sheet-quick-card is-derived-card">
                  <h3>Umbral de dolor</h3>
                  <strong>{derived.umbralDolorTotal}</strong>
                </article>
              </div>

              <div className="unified-sheet-quick-row is-conditions">
                <article className="unified-sheet-quick-card is-wide">
                  <h3>Condiciones</h3>
                  <div className="unified-sheet-quick-tags">
                    {normalizedSheet.conditions.length > 0 ? normalizedSheet.conditions.slice(0, 4).map((condition) => (
                      <span key={condition.id} className={`unified-sheet-tag is-${condition.category}`}>{condition.name || "Condicion"}</span>
                    )) : <span className="unified-sheet-tag">Sin condiciones</span>}
                  </div>
                </article>
              </div>

            </div>
          </section>
        </div>
      </section>

      {activeTab === "actions" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <div className="row-actions">
              <h3>Acciones disponibles</h3>
            </div>
            <div className="campaign-sheet-actions">
              {actions.map((action, index) => (
                <div key={action.id} className="campaign-action-button">
                  <strong>{action.label}</strong>
                  <span>{action.sourceName}</span>
                  <span>{action.cost}{action.rollAttribute ? ` · ${ATTRIBUTE_LABELS[action.rollAttribute]}` : ""}{action.damageFormula ? ` · ${action.damageFormula}` : ""}</span>
                  <p>{action.effectSummary}</p>
                  <div className="campaign-action-controls">
                    {action.rollAttribute ? <button type="button" onClick={() => runAction(action, "attack")}>Tirar</button> : null}
                    {action.damageFormula ? <button type="button" onClick={() => runAction(action, "damage")}>Danio</button> : null}
                  </div>
                </div>
              ))}
              {actions.length === 0 ? <p className="section-help">Sin acciones registradas.</p> : null}
            </div>
          </article>

          <article className="campaign-sheet-card">
            <h3>Historial</h3>
            {history.length > 0 ? (
              <div className="roll-log">
                {history.map((entry, index) => (
                  <div key={`${entry.title}-${index}`} className="character-action-history-entry">
                    <strong>{entry.title}</strong>
                    <div className="campaign-roll-group-lines">
                      {entry.rolls.map((roll, rollIndex) => (
                        <span key={`${entry.title}-${rollIndex}`}>{roll.label}: {roll.formula} = {roll.total}{typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "exito" : "fallo"}` : ""}</span>
                      ))}
                    </div>
                    {entry.detail ? <p>{entry.detail}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="section-help">Aun no has lanzado ninguna tirada desde esta hoja.</p>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === "inventory" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <div className="row-actions">
              <h3>Inventario y equipo</h3>
              {editMode ? <button type="button" onClick={addInventoryItem}>Agregar objeto</button> : null}
            </div>
            <div className="form-grid">
              <Field label="Dinero"><input disabled={!editMode} value={normalizedSheet.recursos.dinero} onChange={(event) => updateField("recursos.dinero", event.target.value)} /></Field>
              <Field label="Otros recursos"><input disabled={!editMode} value={normalizedSheet.recursos.otros} onChange={(event) => updateField("recursos.otros", event.target.value)} /></Field>
            </div>
            <div className="unified-sheet-list">
              {normalizedSheet.inventoryItems.map((item, index) => (
                <article key={item.id} className="campaign-structured-card">
                  <div className="form-grid">
                    <Field label="Nombre"><input disabled={!editMode} value={item.name} onChange={(event) => updateInventoryItem(index, "name", event.target.value)} /></Field>
                    <Field label="Categoria">
                      <select disabled={!editMode} value={item.category} onChange={(event) => updateInventoryItem(index, "category", event.target.value)}>
                        <option value="weapon">Arma</option>
                        <option value="armor">Armadura</option>
                        <option value="gear">Equipo</option>
                        <option value="consumable">Consumible</option>
                        <option value="artifact">Artefacto</option>
                        <option value="treasure">Tesoro</option>
                        <option value="other">Otro</option>
                      </select>
                    </Field>
                    <Field label="Cantidad"><input disabled={!editMode} type="number" min={0} value={item.quantity} onChange={(event) => updateInventoryItem(index, "quantity", Number(event.target.value || 0))} /></Field>
                    <Field label="Equipada">
                      <select disabled={!editMode} value={item.equipped ? "si" : "no"} onChange={(event) => updateInventoryItem(index, "equipped", event.target.value === "si")}>
                        <option value="si">Si</option>
                        <option value="no">No</option>
                      </select>
                    </Field>
                    <Field label="Ranura">
                      <select disabled={!editMode} value={item.slot} onChange={(event) => updateInventoryItem(index, "slot", event.target.value)}>
                        <option value="none">Ninguna</option>
                        <option value="mainHand">Mano principal</option>
                        <option value="offHand">Mano secundaria</option>
                        <option value="ranged">A distancia</option>
                        <option value="armor">Armadura</option>
                        <option value="artifact">Artefacto</option>
                        <option value="worn">Vestido</option>
                      </select>
                    </Field>
                    <Field label="Danio / proteccion"><input disabled={!editMode} value={item.category === "armor" ? item.protectionFormula : item.damageFormula} onChange={(event) => updateInventoryItem(index, item.category === "armor" ? "protectionFormula" : "damageFormula", event.target.value)} /></Field>
                  </div>
                  <textarea disabled={!editMode} rows={2} value={item.description} onChange={(event) => updateInventoryItem(index, "description", event.target.value)} />
                  {editMode ? <button type="button" className="subtle-button" onClick={() => removeInventoryItem(index)}>Quitar</button> : null}
                </article>
              ))}
            </div>
          </article>

          <article className="campaign-sheet-card">
            <h3>Ranuras equipadas</h3>
            <div className="form-grid">
              {(["mainHand", "offHand", "ranged", "armor", "artifact", "worn"] as const).map((slot) => (
                <Field key={slot} label={slotLabel(slot)}>
                  <select disabled={!editMode} value={normalizedSheet.equipmentSlots[slot]} onChange={(event) => updateField(`equipmentSlots.${slot}`, event.target.value)}>
                    <option value="">Sin asignar</option>
                    {normalizedSheet.inventoryItems.map((item) => (
                      <option key={`${slot}-${item.id}`} value={item.id}>{item.name || item.id}</option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "abilities" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <Field label="Rasgos"><textarea disabled={!editMode} rows={2} value={normalizedSheet.noteSections.traits} onChange={(event) => updateField("noteSections.traits", event.target.value)} /></Field>
          </article>
          <CapabilityEditor title="Habilidades" entries={normalizedSheet.habilidades} editable={editMode} onAdd={() => addRatedEntry("habilidades")} onRemove={(index) => removeRatedEntry("habilidades", index)} onUpdate={(index, field, value) => updateRatedEntry("habilidades", index, field, value)} onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined} />
          <CapabilityEditor title="Poderes misticos" entries={normalizedSheet.poderesMisticos} editable={editMode} onAdd={() => addRatedEntry("poderesMisticos")} onRemove={(index) => removeRatedEntry("poderesMisticos", index)} onUpdate={(index, field, value) => updateRatedEntry("poderesMisticos", index, field, value)} onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined} />
          <CapabilityEditor title="Rituales" entries={normalizedSheet.rituales} editable={editMode} onAdd={() => addRatedEntry("rituales")} onRemove={(index) => removeRatedEntry("rituales", index)} onUpdate={(index, field, value) => updateRatedEntry("rituales", index, field, value)} onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined} />
        </section>
      ) : null}

      {activeTab === "background" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <h3>Trasfondo</h3>
            <div className="form-grid">
              <Field label="Sombra"><input disabled={!editMode} value={normalizedSheet.identidad.sombra} onChange={(event) => updateField("identidad.sombra", event.target.value)} /></Field>
              <Field label="Cita"><input disabled={!editMode} value={normalizedSheet.identidad.cita} onChange={(event) => updateField("identidad.cita", event.target.value)} /></Field>
              <Field label="Edad"><input disabled={!editMode} value={normalizedSheet.identidad.edad} onChange={(event) => updateField("identidad.edad", event.target.value)} /></Field>
              <Field label="Altura"><input disabled={!editMode} value={normalizedSheet.identidad.altura} onChange={(event) => updateField("identidad.altura", event.target.value)} /></Field>
              <Field label="Peso"><input disabled={!editMode} value={normalizedSheet.identidad.peso} onChange={(event) => updateField("identidad.peso", event.target.value)} /></Field>
            </div>
            <Field label="Apariencia"><textarea disabled={!editMode} rows={2} value={normalizedSheet.identidad.apariencia} onChange={(event) => updateField("identidad.apariencia", event.target.value)} /></Field>
            <Field label="Objetivo personal"><textarea disabled={!editMode} rows={2} value={normalizedSheet.identidad.objetivoPersonal} onChange={(event) => updateField("identidad.objetivoPersonal", event.target.value)} /></Field>
            <Field label="Historia"><textarea disabled={!editMode} rows={8} value={normalizedSheet.noteSections.background} onChange={(event) => updateField("noteSections.background", event.target.value)} /></Field>
          </article>
        </section>
      ) : null}

      {activeTab === "notes" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <h3>Notas y contexto</h3>
            <Field label="Notas generales"><textarea disabled={!editMode} rows={6} value={normalizedSheet.noteSections.general} onChange={(event) => updateField("noteSections.general", event.target.value)} /></Field>
            <Field label="Notas de campana"><textarea disabled={!editMode} rows={4} value={normalizedSheet.noteSections.campaign} onChange={(event) => updateField("noteSections.campaign", event.target.value)} /></Field>
            <div className="form-grid">
              <Field label="Grupo"><input disabled={!editMode} value={normalizedSheet.grupo.nombre} onChange={(event) => updateField("grupo.nombre", event.target.value)} /></Field>
              <Field label="Objetivo del grupo"><textarea disabled={!editMode} rows={2} value={normalizedSheet.grupo.objetivo} onChange={(event) => updateField("grupo.objetivo", event.target.value)} /></Field>
            </div>
          </article>

          <article className="campaign-sheet-card">
            <h3>Contactos</h3>
            <div className="unified-sheet-list">
              {normalizedSheet.contactosHoja.map((contacto, index) => (
                <article key={`contacto-${index}`} className="campaign-structured-card">
                  <div className="form-grid">
                    <Field label="Nombre"><input disabled={!editMode} value={contacto.nombre} onChange={(event) => updateField(`contactosHoja.${index}.nombre`, event.target.value)} /></Field>
                    <Field label="Raza"><input disabled={!editMode} value={contacto.raza} onChange={(event) => updateField(`contactosHoja.${index}.raza`, event.target.value)} /></Field>
                    <Field label="Ocupacion"><input disabled={!editMode} value={contacto.ocupacion} onChange={(event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value)} /></Field>
                    <Field label="Jugador"><input disabled={!editMode} value={contacto.jugador} onChange={(event) => updateField(`contactosHoja.${index}.jugador`, event.target.value)} /></Field>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}
      {pendingRollConfirmation ? (
        <div className="modal-backdrop">
          <div className="panel modal-panel character-roll-confirm-modal">
            <h3>Enviar tirada</h3>
            <p className="section-help">{pendingRollConfirmation.title}</p>
            <div className="row-actions character-roll-confirm-actions">
              <div className="character-roll-confirm-primary">
                <button type="button" onClick={() => void handleConfirmRoll20Send("public")}>Publico</button>
                <button type="button" onClick={() => void handleConfirmRoll20Send("gm")}>Solo DJ</button>
              </div>
              <button type="button" className="subtle-button" onClick={() => setPendingRollConfirmation(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function slotLabel(slot: "mainHand" | "offHand" | "ranged" | "armor" | "artifact" | "worn"): string {
  switch (slot) {
    case "mainHand": return "Mano principal";
    case "offHand": return "Mano secundaria";
    case "ranged": return "A distancia";
    case "armor": return "Armadura";
    case "artifact": return "Artefacto";
    case "worn": return "Vestido";
  }
}

function CapabilityTextList({
  title,
  entries,
  onOpenCompendium
}: {
  title: string;
  entries: RatedEntry[];
  onOpenCompendium?: (name: string) => void;
}) {
  return (
    <div className="unified-sheet-list">
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <article key={`${title}-${index}-${entry.nombre}`} className="unified-sheet-capability-card">
            <div className="row-actions">
              <h3>{entry.nombre || title}</h3>
              {onOpenCompendium && entry.nombre ? (
                <button type="button" className="subtle-button" onClick={() => onOpenCompendium(entry.nombre)}>
                  Ver en compendio
                </button>
              ) : null}
            </div>
            <div className="unified-sheet-capability-meta">
              {entry.tipo ? <span>{entry.tipo}</span> : null}
              {entry.nivel ? <span>{entry.nivel}</span> : null}
              {entry.fuente ? <span>{entry.fuente}{entry.pagina ? ` p. ${entry.pagina}` : ""}</span> : entry.pagina ? <span>p. {entry.pagina}</span> : null}
            </div>
            {entry.efecto ? <p className="unified-sheet-rich-text">{entry.efecto}</p> : null}
            {entry.notas ? <p className="unified-sheet-capability-notes">{entry.notas}</p> : null}
          </article>
        ))
      ) : (
        <p className="unified-sheet-capability-empty">Sin entradas.</p>
      )}
    </div>
  );
}

type CapabilityEditorProps = {
  title: string;
  entries: CharacterSheet["habilidades"];
  editable: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: "nombre" | "tipo" | "efecto" | "nivel" | "fuente" | "pagina" | "notas", value: string | number) => void;
  onOpenCompendium?: (name: string) => void;
};

function CapabilityEditor({ title, entries, editable, onAdd, onRemove, onUpdate, onOpenCompendium }: CapabilityEditorProps) {
  return (
    <article className="campaign-sheet-card">
      <div className="row-actions">
        <h3>{title}</h3>
        {editable ? <button type="button" onClick={onAdd}>Agregar</button> : null}
      </div>
      <div className="unified-sheet-list">
        {entries.map((entry, index) => (
          <article key={`${title}-${index}-${entry.nombre}`} className="campaign-structured-card">
            <div className="form-grid">
              <Field label="Nombre"><input disabled={!editable} value={entry.nombre} onChange={(event) => onUpdate(index, "nombre", event.target.value)} /></Field>
              <Field label="Tipo"><input disabled={!editable} value={entry.tipo} onChange={(event) => onUpdate(index, "tipo", event.target.value)} /></Field>
              <Field label="Nivel"><select disabled={!editable} value={entry.nivel} onChange={(event) => onUpdate(index, "nivel", event.target.value)}><option value="novato">Novato</option><option value="adepto">Adepto</option><option value="maestro">Maestro</option></select></Field>
              <Field label="Fuente"><input disabled={!editable} value={entry.fuente} onChange={(event) => onUpdate(index, "fuente", event.target.value)} /></Field>
              <Field label="Pagina"><input disabled={!editable} type="number" min={0} value={entry.pagina ?? ""} onChange={(event) => onUpdate(index, "pagina", Number(event.target.value || 0))} /></Field>
            </div>
            <textarea disabled={!editable} rows={3} value={entry.efecto} onChange={(event) => onUpdate(index, "efecto", event.target.value)} />
            <textarea disabled={!editable} rows={2} value={entry.notas} onChange={(event) => onUpdate(index, "notas", event.target.value)} />
            <div className="card-actions">
              {onOpenCompendium ? <button type="button" className="subtle-button" onClick={() => onOpenCompendium(entry.nombre)}>Ver en compendio</button> : null}
              {editable ? <button type="button" className="subtle-button" onClick={() => onRemove(index)}>Quitar</button> : null}
            </div>
          </article>
        ))}
        {entries.length === 0 ? <p className="section-help">Sin entradas.</p> : null}
      </div>
    </article>
  );
}
