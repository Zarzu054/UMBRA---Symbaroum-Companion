import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildRollRequest,
  deriveCharacterActions,
  executeCharacterAction,
  parseCharacterSheet,
  synchronizeCharacterSheet,
  type ActionRollResult,
  type AuthUser,
  type Character,
  type CharacterActionDefinition,
  type CharacterActionPhase,
  type CharacterSheet,
  type RollDestination,
  type RollRequest
} from "@umbra/shared";
import { useLayoutEffect, useRef } from "react";
import { CharacterCard } from "../components/CharacterCard";
import { CharacterChangeLogModal } from "../components/CharacterChangeLogModal";
import { AppTopNavigation, type AppNavigationItem } from "../components/AppTopNavigation";
import { AppIcon } from "../components/AppIcon";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
import { CharacterCreationWizard } from "../components/ActorCreationWizard";
import { getRoleLabel, useCharacterController } from "../controllers/characterController";
import {
  RULE_CATEGORY_LABELS,
  TYPE_LABELS,
  findCompendiumCapabilityEntryId,
  findCompendiumEntryByTypeAndName,
  type EntryType,
  type RuleCategory
} from "../models/compendiumEntries";
import { toCharacterCardViewModel } from "../models/characterModel";
import { computeDerivedStats } from "../models/rulesEngine";
import { exportCharacterSheetPdf } from "../services/characterPdfExport";
import { aspireProfession, leaveProfession, removeProfessionAspiration, requestProfessionMembership, updateCharacter } from "../services/characterService";
import { bindMysticArtifact, useMysticArtifactAbility } from "../services/mysticArtifactService";
import {
  dispatchRoll20Request,
  getRollDestination,
  pingRoll20Bridge,
  setRollDestination as persistRollDestination,
  type Roll20BridgeStatus,
  type Roll20Visibility
} from "../services/rollTransport";
import { CampaignDashboardView } from "./CampaignDashboardView";
import { CharacterBuilderView } from "./CharacterBuilderView";
import { CompendiumView, type CompendiumBrowseMode } from "./CompendiumView";
import { MonsterDashboardView } from "./MonsterDashboardView";
import { NpcDashboardView } from "./NpcDashboardView";


type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
  onLogout: () => Promise<void>;
};

type AppModule = "characters" | "compendium" | "campaigns" | "monsters" | "npcs";
type CharacterPageMode = "sheet" | "builder";

type CompendiumFocus = {
  entryId: string | null;
  query: string;
  source: string;
  type: "all" | EntryType;
  ruleCategory: "all" | RuleCategory;
  mode: CompendiumBrowseMode;
  token: number;
};

type PendingCharacterRollConfirmation = {
  request: RollRequest;
  visibility: Roll20Visibility;
  title: string;
};

function getModuleLabel(module: AppModule): string {
  switch (module) {
    case "campaigns": return "Campañas";
    case "monsters": return "Monstruos";
    case "npcs": return "PNJ";
    case "compendium": return "Compendio";
    case "characters":
    default:
      return "Personajes";
  }
}

function parseHash(): { module: AppModule; focus?: Omit<CompendiumFocus, "token">; sheetId?: string | null; characterPageMode?: CharacterPageMode } {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (rawHash.startsWith("monsters")) {
    return { module: "monsters" };
  }

  if (rawHash.startsWith("npcs")) {
    return { module: "npcs" };
  }

  if (rawHash.startsWith("campaigns")) {
    return { module: "campaigns" };
  }

  if (rawHash.startsWith("characters")) {
    const [, search = ""] = rawHash.split("?");
    const params = new URLSearchParams(search);
    const rawView = params.get("view");
    return {
      module: "characters",
      sheetId: params.get("sheetId"),
      characterPageMode: rawView === "builder" ? "builder" : "sheet"
    };
  }

  if (!rawHash.startsWith("compendium")) {
    return { module: "characters" };
  }

  const [, search = ""] = rawHash.split("?");
  const params = new URLSearchParams(search);
  const rawType = params.get("type");
  const rawRuleCategory = params.get("ruleCategory");
  const source = params.get("source") ?? "all";
  const mode = params.get("mode");
  return {
    module: "compendium",
    focus: {
      entryId: params.get("id"),
      query: params.get("q") ?? "",
      source,
      type: rawType && rawType !== "all" && rawType in TYPE_LABELS ? rawType as EntryType : "all",
      ruleCategory: rawRuleCategory && rawRuleCategory in RULE_CATEGORY_LABELS ? rawRuleCategory as RuleCategory : "all",
      mode: mode === "source" || (!mode && source !== "all") ? "source" : "type"
    }
  };
}

export function CharacterDashboardView({ user, ensureAccessToken, onLogout }: Props) {
  const controller = useCharacterController(ensureAccessToken);
  const dashboardRef = useRef<HTMLElement | null>(null);
  const isCampaignManagedLock = false;
  const isCapabilityLocked = controller.isEditing;
  const canAccessCharacters = user.role !== "gm";
  const canAccessMonsters = user.role === "gm" || user.role === "superadmin";
  const canAccessNpcs = user.role === "gm" || user.role === "superadmin";
  const [activeModule, setActiveModule] = useState<AppModule>(
    canAccessCharacters ? "characters" : canAccessNpcs ? "npcs" : canAccessMonsters ? "monsters" : "campaigns"
  );
  const [compendiumFocus, setCompendiumFocus] = useState<CompendiumFocus>({
    entryId: null,
    query: "",
    source: "all",
    type: "all",
    ruleCategory: "all",
    mode: "type",
    token: 0
  });
  const [selectedCharacterSheetId, setSelectedCharacterSheetId] = useState<string | null>(() => parseHash().sheetId ?? null);
  const [selectedCharacterPageMode, setSelectedCharacterPageMode] = useState<CharacterPageMode>(() => parseHash().characterPageMode ?? "sheet");
  const [changeLogCharacterId, setChangeLogCharacterId] = useState<string | null>(null);
  const selectedCharacterSheet = useMemo(
    () => controller.characters.find((entry) => entry.id === selectedCharacterSheetId) ?? null,
    [controller.characters, selectedCharacterSheetId]
  );
  const mobileHeaderTitle = selectedCharacterSheet?.name ?? getModuleLabel(activeModule);

  // Dashboard fields contain game data, never credentials. Excluding them
  // prevents Bitwarden's inline menu from retaining stale DOM anchors while
  // React refreshes the character directory or changes sheet sections.
  useLayoutEffect(() => {
    dashboardRef.current?.querySelectorAll("input, select, textarea").forEach((field) => {
      if (!field.hasAttribute("data-bwignore")) {
        field.setAttribute("data-bwignore", "true");
      }
    });
  });

  useEffect(() => {
    function syncWithHash(): void {
      const parsed = parseHash();
      if (!canAccessCharacters && parsed.module === "characters") {
        const fallbackModule = canAccessMonsters ? "monsters" : "campaigns";
        setActiveModule(fallbackModule);
        window.location.hash = fallbackModule;
        return;
      }

      if (!canAccessMonsters && parsed.module === "monsters") {
        const fallbackModule = canAccessCharacters ? "characters" : "campaigns";
        setActiveModule(fallbackModule);
        window.location.hash = fallbackModule;
        return;
      }

      if (!canAccessNpcs && parsed.module === "npcs") {
        const fallbackModule = canAccessCharacters ? "characters" : canAccessMonsters ? "monsters" : "campaigns";
        setActiveModule(fallbackModule);
        window.location.hash = fallbackModule;
        return;
      }

      switch (parsed.module) {
        case "compendium":
          setActiveModule("compendium");
          setCompendiumFocus((prev) => ({
            entryId: parsed.focus?.entryId ?? null,
            query: parsed.focus?.query ?? "",
            source: parsed.focus?.source ?? "all",
            type: parsed.focus?.type ?? "all",
            ruleCategory: parsed.focus?.ruleCategory ?? "all",
            mode: parsed.focus?.mode ?? "type",
            token: prev.token + 1
          }));
          return;
        case "campaigns":
          setActiveModule("campaigns");
          return;
        case "monsters":
          setActiveModule("monsters");
          return;
        case "npcs":
          setActiveModule("npcs");
          return;
        case "characters":
        default:
          setActiveModule("characters");
          setSelectedCharacterSheetId(parsed.sheetId ?? null);
          setSelectedCharacterPageMode(parsed.characterPageMode ?? "sheet");
          return;
      }
    }

    syncWithHash();
    window.addEventListener("hashchange", syncWithHash);
    return () => window.removeEventListener("hashchange", syncWithHash);
  }, [canAccessCharacters, canAccessMonsters, canAccessNpcs]);

  function openCompendiumCapability(tipo: "habilidad" | "poder_mistico" | "ritual" | "bendicion" | "carga", nombre: string): void {
    const entryId = tipo === "bendicion" || tipo === "carga"
      ? (findCompendiumEntryByTypeAndName(tipo, nombre)?.id ?? null)
      : findCompendiumCapabilityEntryId(tipo, nombre);
    const params = new URLSearchParams();
    params.set("q", nombre);
    params.set("source", "all");
    if (entryId) {
      params.set("id", entryId);
    }
    window.location.hash = `compendium?${params.toString()}`;
  }

  function openCharactersModule(): void {
    setActiveModule("characters");
    window.location.hash = "characters";
    setSelectedCharacterSheetId(null);
  }

  function openCharacterSheet(characterId: string): void {
    setActiveModule("characters");
    setSelectedCharacterSheetId(characterId);
    setSelectedCharacterPageMode("sheet");
    const params = new URLSearchParams();
    params.set("sheetId", characterId);
    params.set("view", "sheet");
    window.location.hash = `characters?${params.toString()}`;
  }

  function openCharacterBuilder(characterId: string): void {
    setActiveModule("characters");
    setSelectedCharacterSheetId(characterId);
    setSelectedCharacterPageMode("builder");
    const params = new URLSearchParams();
    params.set("sheetId", characterId);
    params.set("view", "builder");
    window.location.hash = `characters?${params.toString()}`;
  }

  function closeCharacterSheet(): void {
    setSelectedCharacterSheetId(null);
    setSelectedCharacterPageMode("sheet");
    window.location.hash = "characters";
  }

  function openCompendiumModule(): void {
    setActiveModule("compendium");
    if (!window.location.hash.startsWith("#compendium")) {
      window.location.hash = "compendium";
    }
  }

  function openCampaignsModule(): void {
    setActiveModule("campaigns");
    if (!window.location.hash.startsWith("#campaigns")) {
      window.location.hash = "campaigns";
    }
  }

  function openMonstersModule(): void {
    setActiveModule("monsters");
    if (!window.location.hash.startsWith("#monsters")) {
      window.location.hash = "monsters";
    }
  }

  function openNpcsModule(): void {
    setActiveModule("npcs");
    if (!window.location.hash.startsWith("#npcs")) {
      window.location.hash = "npcs";
    }
  }

  const navigationItems: AppNavigationItem[] = [
    ...(canAccessCharacters ? [{ id: "characters", label: "Personajes", active: activeModule === "characters", onSelect: openCharactersModule }] : []),
    { id: "campaigns", label: "Campañas", active: activeModule === "campaigns", onSelect: openCampaignsModule },
    ...(canAccessNpcs ? [{ id: "npcs", label: "PNJ", active: activeModule === "npcs", onSelect: openNpcsModule }] : []),
    ...(canAccessMonsters ? [{ id: "monsters", label: "Monstruos", active: activeModule === "monsters", onSelect: openMonstersModule }] : []),
    { id: "compendium", label: "Compendio", active: activeModule === "compendium", onSelect: openCompendiumModule }
  ];

  return (
    <main ref={dashboardRef} className="page app-page">
      <AppTopNavigation
        items={navigationItems}
        currentTitle={mobileHeaderTitle}
        userEmail={user.email}
        roleLabel={getRoleLabel(user.role)}
        onLogout={onLogout}
      />
      <section className={`app-content module-theme module-theme--${activeModule}`}>
          {selectedCharacterSheet && activeModule === "characters" && selectedCharacterPageMode === "sheet" ? (
            <div className="app-context-navigation">
              <button type="button" className="text-button" onClick={closeCharacterSheet}>
                <AppIcon name="arrow-left" />
                Volver
              </button>
              <span>Personajes / {selectedCharacterSheet.name}</span>
            </div>
          ) : null}

          {activeModule === "compendium" ? (
            <CompendiumView
              onBackToCharacters={openCharactersModule}
              ensureAccessToken={ensureAccessToken}
              initialEntryId={compendiumFocus.entryId}
              initialQuery={compendiumFocus.query}
              initialSourceFilter={compendiumFocus.source}
              initialTypeFilter={compendiumFocus.type}
              initialRuleCategory={compendiumFocus.ruleCategory}
              initialBrowseMode={compendiumFocus.mode}
              focusToken={compendiumFocus.token}
            />
          ) : activeModule === "monsters" ? (
            <MonsterDashboardView user={user} ensureAccessToken={ensureAccessToken} />
          ) : activeModule === "npcs" ? (
            <NpcDashboardView ensureAccessToken={ensureAccessToken} />
          ) : activeModule === "campaigns" ? (
            <CampaignDashboardView user={user} ensureAccessToken={ensureAccessToken} />
          ) : selectedCharacterSheet ? (
            <section className="character-actions-page">
              {selectedCharacterPageMode === "builder" ? (
                <CharacterBuilderView
                  character={selectedCharacterSheet}
                  onBackToCharacters={closeCharacterSheet}
                  onOpenSheet={() => openCharacterSheet(selectedCharacterSheet.id)}
                  onBindMysticArtifact={async (artifactId, paymentType) => {
                    const token = await ensureAccessToken();
                    await bindMysticArtifact(artifactId, { paymentType }, token);
                    await controller.refresh();
                  }}
                  onAspireProfession={async (professionId) => {
                    const token = await ensureAccessToken();
                    await aspireProfession(selectedCharacterSheet.id, professionId, token);
                    await controller.refresh();
                  }}
                  onRemoveProfessionAspiration={async (professionId) => {
                    const token = await ensureAccessToken();
                    await removeProfessionAspiration(selectedCharacterSheet.id, professionId, token);
                    await controller.refresh();
                  }}
                  onRequestProfession={async (professionId) => {
                    const token = await ensureAccessToken();
                    await requestProfessionMembership(selectedCharacterSheet.id, professionId, token);
                    await controller.refresh();
                  }}
                  onLeaveProfession={async (professionId) => {
                    const token = await ensureAccessToken();
                    await leaveProfession(selectedCharacterSheet.id, professionId, token);
                    await controller.refresh();
                  }}
                  onOpenCompendiumCapability={openCompendiumCapability}
                  onSave={async (nextSheet) => {
                    const token = await ensureAccessToken();
                    const updated = await updateCharacter(
                      selectedCharacterSheet.id,
                      {
                        name: nextSheet.identidad.nombrePersonaje.trim() || selectedCharacterSheet.name,
                        archetype: String(nextSheet.identidad.arquetipo),
                        race: String(nextSheet.identidad.raza),
                        culture: String(nextSheet.identidad.cultura),
                        profession: nextSheet.identidad.profesion,
                        level: 1,
                        sheet: synchronizeCharacterSheet(nextSheet)
                      },
                      token
                    );
                    controller.upsertCharacterRecord(updated);
                  }}
                />
              ) : (
                <UnifiedCharacterSheet
                  key={selectedCharacterSheet.id}
                  title={selectedCharacterSheet.name}
                  subtitle={`${selectedCharacterSheet.culture || "Sin cultura"} · ${selectedCharacterSheet.archetype || "Sin arquetipo"} · ${selectedCharacterSheet.race || "Sin raza"}`}
                  sheet={parseCharacterSheet(selectedCharacterSheet.sheet)}
                  professionMemberships={selectedCharacterSheet.professionMemberships}
                  enforceProfessionRestrictions
                  editable
                  backgroundPreferenceScope={user.id}
                  onBack={closeCharacterSheet}
                  onOpenBuilder={() => openCharacterBuilder(selectedCharacterSheet.id)}
                  onOpenCompendiumCapability={openCompendiumCapability}
                  onUseArtifactAbility={async (artifactId, abilityId) => {
                    const token = await ensureAccessToken();
                    await useMysticArtifactAbility(artifactId, abilityId, token);
                    await controller.refresh();
                  }}
                  onSave={async (nextSheet) => {
                    const token = await ensureAccessToken();
                    const updated = await updateCharacter(
                      selectedCharacterSheet.id,
                      {
                        name: nextSheet.identidad.nombrePersonaje.trim() || selectedCharacterSheet.name,
                        archetype: String(nextSheet.identidad.arquetipo),
                        race: String(nextSheet.identidad.raza),
                        culture: String(nextSheet.identidad.cultura),
                        profession: nextSheet.identidad.profesion,
                        level: 1,
                        sheet: synchronizeCharacterSheet(nextSheet)
                      },
                      token
                    );
                    controller.upsertCharacterRecord(updated);
                  }}
                />
              )}
            </section>
          ) : (
            <section className="character-directory-page unified-sheet">
              <header className="character-directory-header-band module-sticky-header module-sticky-header--single-row">
                  <div className="unified-sheet-portrait" aria-hidden="true">
                    <div className="unified-sheet-portrait-ring">
                      <div className="unified-sheet-portrait-content">PJ</div>
                    </div>
                  </div>
                  <div className="character-directory-identity">
                    <h2>Archivo de personajes</h2>
                    <p className="unified-sheet-inline-subtitle">
                      Gestiona hojas, constructor y progreso de PX con la misma presentacion que la ficha.
                    </p>
                  </div>
                  <div className="toolbar character-directory-header-actions">
                    <button onClick={controller.openCreateModal}>Nuevo personaje</button>
                    <label className={`file-trigger${controller.isSaving ? " is-disabled" : ""}`}>
                      Importar PDF
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={controller.isSaving}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void controller.importFromPdf(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button disabled={controller.isSaving} onClick={() => void controller.createRandomCharacter()}>
                      Generar aleatorio
                    </button>
                  </div>
              </header>

              <section className="character-directory-stage">
                  {controller.error && !controller.isFormModalOpen ? <p className="error">{controller.error}</p> : null}

                  {controller.isFormModalOpen ? (
                    <section className="modal-backdrop">
                      <CharacterCreationWizard controller={controller} onCancel={controller.closeFormModal} />
                    </section>
                  ) : null}

                  {false && controller.isFormModalOpen ? (
                    <section className="modal-backdrop" onClick={controller.closeFormModal}>
                      <div className="panel modal-panel character-directory-form-modal" onClick={(event) => event.stopPropagation()}>
        <div className="row-actions">
          <h2>{controller.isEditing ? "Editar personaje" : "Crear personaje"}</h2>
          <div className="toolbar">
            {controller.isEditing ? (
              <button
                onClick={() => {
                  const current = controller.characters.find((entry) => entry.id === controller.selectedCharacterId);
                  if (current) void exportCharacterSheetPdf(current);
                }}
              >
                Exportar PDF
              </button>
            ) : null}
            {controller.isEditing ? (
              <button disabled={controller.isSaving} onClick={() => void controller.duplicateSelected()}>
                Duplicar ficha
              </button>
            ) : null}
            {controller.isEditing ? (
              <button
                className="danger"
                disabled={controller.isSaving}
                onClick={() => {
                  if (window.confirm("Esta acción eliminará el personaje. ¿Deseas continuar?")) {
                    void controller.deleteSelected();
                  }
                }}
              >
                Eliminar ficha
              </button>
            ) : null}
            <button disabled={controller.isSaving} onClick={() => void controller.submit()}>
              {controller.isSaving ? "Guardando..." : controller.isEditing ? "Actualizar ficha" : "Crear ficha"}
            </button>
            <button onClick={controller.closeFormModal}>Cerrar</button>
          </div>
        </div>

        {controller.error ? <p className="error">{controller.error}</p> : null}
        {controller.validationErrors.length > 0 ? (
          <div className="error-list">
            {controller.validationErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}

        <details className="field-guide">
          <summary>Guía rápida de campos</summary>
          <div className="guide-grid">
            <p><strong>Nombre del personaje:</strong> Nombre en juego del PJ.</p>
            <p><strong>Nombre del jugador:</strong> Persona real que lo juega.</p>
            <p><strong>Raza / Cultura / Arquetipo:</strong> Base narrativa y mecánica del personaje.</p>
            <p><strong>Profesión:</strong> Rol específico (ej. Templario, Cazatesoros, Bruja).</p>
            <p><strong>Atributos:</strong> Valores principales de Symbaroum (5-15).</p>
            <p><strong>PX total / gastada:</strong> Experiencia acumulada y usada en mejoras.</p>
            <p><strong>Robustez:</strong> Salud/aguante actual y máximo.</p>
            <p><strong>Mod. defensa / iniciativa:</strong> Ajustes por equipo, poderes o efectos.</p>
            <p><strong>Corrupción temporal/permanente:</strong> Mancha acumulada por magia y oscuridad.</p>
            <p><strong>Umbral de corrupción:</strong> Límite personal antes de consecuencias graves.</p>
            <p><strong>Fuente/Página:</strong> Libro y página de la regla usada (trazabilidad).</p>
          </div>
        </details>

        <div className="section-title">Identidad</div>
        <p className="section-help">Datos básicos del personaje y su contexto narrativo dentro de la campaña.</p>
        <div className="form-grid">
          <label className="field">
            <span>Nombre del personaje</span>
            <input
              value={controller.form.name}
              onChange={(event) => controller.updateTopLevel("name", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Nombre del jugador</span>
            <input
              value={controller.form.sheet.identidad.nombreJugador}
              onChange={(event) => controller.updateSheet("identidad.nombreJugador", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Raza</span>
            <input
              value={controller.form.sheet.identidad.raza}
              onChange={(event) => {
                controller.updateSheet("identidad.raza", event.target.value);
                controller.updateTopLevel("race", event.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>Cultura</span>
            <select
              value={controller.form.sheet.identidad.cultura}
              onChange={(event) => {
                controller.updateSheet("identidad.cultura", event.target.value);
                controller.updateTopLevel("culture", event.target.value);
              }}
            >
              {controller.cultures.map((culture) => (
                <option key={culture} value={culture}>
                  {culture}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Arquetipo</span>
            <select
              value={controller.form.sheet.identidad.arquetipo}
              onChange={(event) => {
                controller.updateSheet("identidad.arquetipo", event.target.value);
                controller.updateTopLevel("archetype", event.target.value);
              }}
            >
              {controller.archetypes.map((archetype) => (
                <option key={archetype} value={archetype}>
                  {archetype}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Profesión</span>
            <input
              value={controller.form.sheet.identidad.profesion}
              onChange={(event) => {
                controller.updateSheet("identidad.profesion", event.target.value);
                controller.updateTopLevel("profession", event.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>Sombra</span>
            <input value={controller.form.sheet.identidad.sombra} onChange={(event) => controller.updateSheet("identidad.sombra", event.target.value)} />
          </label>
          <label className="field">
            <span>Cita</span>
            <input value={controller.form.sheet.identidad.cita} onChange={(event) => controller.updateSheet("identidad.cita", event.target.value)} />
          </label>
          <label className="field">
            <span>Edad</span>
            <input value={controller.form.sheet.identidad.edad} onChange={(event) => controller.updateSheet("identidad.edad", event.target.value)} />
          </label>
          <label className="field">
            <span>Altura</span>
            <input
              value={controller.form.sheet.identidad.altura}
              onChange={(event) => controller.updateSheet("identidad.altura", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Peso</span>
            <input
              value={controller.form.sheet.identidad.peso}
              onChange={(event) => controller.updateSheet("identidad.peso", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Apariencia</span>
            <input
              value={controller.form.sheet.identidad.apariencia}
              onChange={(event) => controller.updateSheet("identidad.apariencia", event.target.value)}
            />
          </label>
        </div>

        <div className="section-title">Atributos</div>
        <p className="section-help">Usa los valores oficiales de hoja (5 a 15). Se usarán para tiradas y automatizaciones.</p>
        <div className="attributes-grid">
          {controller.attributeKeys.map((attribute) => (
            <label key={attribute} className="attribute-box">
              <span>{controller.attributeLabels[attribute]}</span>
              <input
                type="number"
                min={5}
                max={15}
                value={controller.form.sheet.atributos[attribute]}
                onChange={(event) => controller.updateSheet(`atributos.${attribute}`, Number(event.target.value || 10))}
              />
            </label>
          ))}
        </div>

        <div className="section-title">Progreso y recursos</div>
        <p className="section-help">El director de juego concede la experiencia. Las compras se realizan desde el constructor sin superar el total disponible.</p>
        {isCampaignManagedLock ? <p className="section-help">Estos campos de progreso y estado de aventura se gestionan desde Campañas.</p> : null}
        <div className="form-grid">
          <div className="info-box">
            <span>PX total</span>
            <strong>{controller.form.sheet.progreso.experienciaTotal}</strong>
          </div>
          <div className="info-box">
            <span>PX gastada</span>
            <strong>{controller.form.sheet.progreso.experienciaGastada}</strong>
          </div>
          <div className="info-box">PX disponible: {controller.derived.xpDisponible}</div>
        </div>

        <div className="section-title">Cálculos automáticos (MVP)</div>
        <p className="section-help">
          Puedes añadir modificadores automáticos en efectos/notas usando tokens como: <code>DEF+1</code>, <code>INI+1</code>,
          <code>ROBMAX+2</code>, <code>UMBCORR+1</code>.
        </p>
        <div className="form-grid">
          <div className="info-box">Defensa total: {controller.derived.defensaTotal}</div>
          <div className="info-box">Robustez máx. total: {controller.derived.robustezMaximaTotal}</div>
          <div className="info-box">Robustez actual total: {controller.derived.robustezActualTotal}</div>
          <div className="info-box">Umbral de dolor total: {controller.derived.umbralDolorTotal}</div>
          <div className="info-box">Umbral de corrupción total: {controller.derived.umbralCorrupcionTotal}</div>
          <div className="info-box">Armadura activa: {controller.derived.armaduraActiva || "-"}</div>
        </div>
        <p className="section-help">
          Las bendiciones suman <code>5 PX</code> gastados cada una. El bono de las cargas se consolida en los PX totales al crear el personaje y no debe sumarse de nuevo.
        </p>
        {controller.derived.warnings.length > 0 ? (
          <div className="warning-block">
            {controller.derived.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        <div className="section-title">Combate y corrupción</div>
        <p className="section-help">Estado actual en combate y seguimiento de corrupción temporal/permanente.</p>
        {isCampaignManagedLock ? <p className="section-help">Robustez, corrupción, armas y armadura se actualizan dentro de la campaña.</p> : null}
        <fieldset disabled={isCampaignManagedLock} className="campaign-managed-fieldset">
        <div className="form-grid">
          <label className="field">
            <span>Robustez máxima</span>
            <input
              type="number"
              min={0}
              value={controller.form.sheet.combate.robustezMax}
              onChange={(event) => controller.updateSheet("combate.robustezMax", Number(event.target.value || 0))}
            />
          </label>
          <label className="field">
            <span>Robustez actual</span>
            <input
              type="number"
              min={0}
              value={controller.form.sheet.combate.robustezActual}
              onChange={(event) => controller.updateSheet("combate.robustezActual", Number(event.target.value || 0))}
            />
          </label>
          <label className="field">
            <span>Umbral de dolor</span>
            <input
              type="number"
              min={0}
              value={controller.form.sheet.combate.umbralDolor}
              onChange={(event) => controller.updateSheet("combate.umbralDolor", Number(event.target.value || 0))}
            />
          </label>
          <label className="field">
            <span>Modificador de defensa</span>
            <input
              type="number"
              value={controller.form.sheet.combate.defensaMod}
              onChange={(event) => controller.updateSheet("combate.defensaMod", Number(event.target.value || 0))}
            />
          </label>
          <label className="field">
            <span>Defensa (valor en hoja)</span>
            <input
              value={controller.form.sheet.combate.defensaBase}
              onChange={(event) => controller.updateSheet("combate.defensaBase", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Modificador de iniciativa</span>
            <input
              type="number"
              value={controller.form.sheet.combate.iniciativaMod}
              onChange={(event) => controller.updateSheet("combate.iniciativaMod", Number(event.target.value || 0))}
            />
          </label>
          <label className="field">
            <span>Armadura</span>
            <input value={controller.form.sheet.combate.armadura} onChange={(event) => controller.updateSheet("combate.armadura", event.target.value)} />
          </label>
          <label className="field">
            <span>Protección de armadura</span>
            <input
              value={controller.form.sheet.combate.armaduraProteccion}
              onChange={(event) => controller.updateSheet("combate.armaduraProteccion", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Cualidad de armadura</span>
            <input
              value={controller.form.sheet.combate.armaduraCualidad}
              onChange={(event) => controller.updateSheet("combate.armaduraCualidad", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Arma principal</span>
            <input
              value={controller.form.sheet.combate.armaPrincipal}
              onChange={(event) => controller.updateSheet("combate.armaPrincipal", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Cualidad de arma principal</span>
            <input
              value={controller.form.sheet.combate.armaPrincipalCualidad}
              onChange={(event) => controller.updateSheet("combate.armaPrincipalCualidad", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Atributo de arma principal</span>
            <input
              value={controller.form.sheet.combate.armaPrincipalAtributo}
              onChange={(event) => controller.updateSheet("combate.armaPrincipalAtributo", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Daño principal</span>
            <input
              value={controller.form.sheet.combate.danioPrincipal}
              onChange={(event) => controller.updateSheet("combate.danioPrincipal", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Arma secundaria</span>
            <input
              value={controller.form.sheet.combate.armaSecundaria}
              onChange={(event) => controller.updateSheet("combate.armaSecundaria", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Daño secundario</span>
            <input
              value={controller.form.sheet.combate.danioSecundaria}
              onChange={(event) => controller.updateSheet("combate.danioSecundaria", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Atributo de arma secundaria</span>
            <input
              value={controller.form.sheet.combate.armaSecundariaAtributo}
              onChange={(event) => controller.updateSheet("combate.armaSecundariaAtributo", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Arma terciaria</span>
            <input
              value={controller.form.sheet.combate.armaTerciaria}
              onChange={(event) => controller.updateSheet("combate.armaTerciaria", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Cualidad de arma terciaria</span>
            <input
              value={controller.form.sheet.combate.armaTerciariaCualidad}
              onChange={(event) => controller.updateSheet("combate.armaTerciariaCualidad", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Atributo de arma terciaria</span>
            <input
              value={controller.form.sheet.combate.armaTerciariaAtributo}
              onChange={(event) => controller.updateSheet("combate.armaTerciariaAtributo", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Daño terciario</span>
            <input
              value={controller.form.sheet.combate.danioTerciaria}
              onChange={(event) => controller.updateSheet("combate.danioTerciaria", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Arma cuaternaria</span>
            <input
              value={controller.form.sheet.combate.armaCuaternaria}
              onChange={(event) => controller.updateSheet("combate.armaCuaternaria", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Cualidad de arma cuaternaria</span>
            <input
              value={controller.form.sheet.combate.armaCuaternariaCualidad}
              onChange={(event) => controller.updateSheet("combate.armaCuaternariaCualidad", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Atributo de arma cuaternaria</span>
            <input
              value={controller.form.sheet.combate.armaCuaternariaAtributo}
              onChange={(event) => controller.updateSheet("combate.armaCuaternariaAtributo", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Daño cuaternario</span>
            <input
              value={controller.form.sheet.combate.danioCuaternaria}
              onChange={(event) => controller.updateSheet("combate.danioCuaternaria", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Armadura secundaria</span>
            <input
              value={controller.form.sheet.combate.armaduraSecundaria}
              onChange={(event) => controller.updateSheet("combate.armaduraSecundaria", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Proteccion secundaria</span>
            <input
              value={controller.form.sheet.combate.armaduraSecundariaProteccion}
              onChange={(event) => controller.updateSheet("combate.armaduraSecundariaProteccion", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Corrupción temporal</span>
            <input
              type="number"
              min={0}
              value={controller.form.sheet.corrupcion.temporal}
              onChange={(event) => controller.updateSheet("corrupcion.temporal", Number(event.target.value || 0))}
            />
          </label>
          <label className="field">
            <span>Corrupción permanente</span>
            <input
              type="number"
              min={0}
              value={controller.form.sheet.corrupcion.permanente}
              onChange={(event) => controller.updateSheet("corrupcion.permanente", Number(event.target.value || 0))}
            />
          </label>
          <label className="field">
            <span>Umbral de corrupción</span>
            <input
              type="number"
              min={0}
              value={controller.form.sheet.corrupcion.umbral}
              onChange={(event) => controller.updateSheet("corrupcion.umbral", Number(event.target.value || 0))}
            />
          </label>
          <div className="info-box">Corrupción total: {controller.derived.corrupcionTotal}</div>
        </div>
        </fieldset>

        <div className="section-title">Habilidades y capacidades</div>
        <p className="section-help">
          Las capacidades del personaje quedan fijadas fuera de la edición narrativa. Aquí se muestran para consulta y
          referencia de reglas.
        </p>
        {isCapabilityLocked ? <p className="section-help">Las habilidades, poderes y rituales no se editan desde esta ficha.</p> : null}
        <fieldset disabled={isCapabilityLocked} className="campaign-managed-fieldset">
        <div className="inline-row">
          <select
            value={controller.catalogSelection.habilidadId}
            onChange={(event) => controller.setCatalogSelection((prev) => ({ ...prev, habilidadId: event.target.value }))}
          >
            {controller.catalog.habilidades.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} ({item.libro} p.{item.pagina})
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              controller.addCatalogRatedItem(
                "habilidades",
                controller.catalog.habilidades.find((item) => item.id === controller.catalogSelection.habilidadId)
              )
            }
          >
            Agregar del compendio
          </button>
        </div>
        <div className="inline-row">
          <label className="field">
            <span>Nueva habilidad manual</span>
            <input
              value={controller.listInput.habilidades}
              onChange={(event) => controller.setListInput((prev) => ({ ...prev, habilidades: event.target.value }))}
            />
          </label>
          <button onClick={() => controller.addRatedItem("habilidades", "habilidades")}>Agregar</button>
        </div>
        <div className="list-grid">
          {controller.form.sheet.habilidades.map((item, index) => (
            <article key={`hab-${index}`} className="entry-row">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={item.nombre}
                  onChange={(event) => controller.updateRatedItem("habilidades", index, "nombre", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Tipo</span>
                <input
                  value={item.tipo}
                  onChange={(event) => controller.updateRatedItem("habilidades", index, "tipo", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Efecto</span>
                <textarea
                  rows={2}
                  value={item.efecto}
                  onChange={(event) => controller.updateRatedItem("habilidades", index, "efecto", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Nivel</span>
                <select
                  value={item.nivel}
                  onChange={(event) => controller.updateRatedItem("habilidades", index, "nivel", event.target.value)}
                >
                  <option value="principiante">Principiante</option>
                  <option value="adepto">Adepto</option>
                  <option value="maestro">Maestro</option>
                </select>
              </label>
              <label className="field">
                <span>Fuente</span>
                <input
                  value={item.fuente}
                  onChange={(event) => controller.updateRatedItem("habilidades", index, "fuente", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Página</span>
                <input
                  value={item.pagina ?? ""}
                  onChange={(event) =>
                    controller.updateRatedItem("habilidades", index, "pagina", Number(event.target.value || 0))
                  }
                />
              </label>
              <button className="subtle-button" onClick={() => openCompendiumCapability("habilidad", item.nombre)}>Ver en compendio</button>
              <button onClick={() => controller.removeRatedItem("habilidades", index)}>Quitar</button>
            </article>
          ))}
        </div>

        <div className="section-title">Poderes místicos y rituales</div>
        <p className="section-help">Registra poderes y rituales activos del personaje con su nivel de dominio.</p>
        <div className="inline-row">
          <select
            value={controller.catalogSelection.poderId}
            onChange={(event) => controller.setCatalogSelection((prev) => ({ ...prev, poderId: event.target.value }))}
          >
            {controller.catalog.poderes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} ({item.libro} p.{item.pagina})
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              controller.addCatalogRatedItem(
                "poderesMisticos",
                controller.catalog.poderes.find((item) => item.id === controller.catalogSelection.poderId)
              )
            }
          >
            Agregar del compendio
          </button>
        </div>
        <div className="inline-row">
          <label className="field">
            <span>Nuevo poder místico manual</span>
            <input
              value={controller.listInput.poderes}
              onChange={(event) => controller.setListInput((prev) => ({ ...prev, poderes: event.target.value }))}
            />
          </label>
          <button onClick={() => controller.addRatedItem("poderesMisticos", "poderes")}>Agregar poder</button>
        </div>
        <div className="list-grid">
          {controller.form.sheet.poderesMisticos.map((item, index) => (
            <article key={`pow-${index}`} className="entry-row">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={item.nombre}
                  onChange={(event) => controller.updateRatedItem("poderesMisticos", index, "nombre", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Tipo</span>
                <input
                  value={item.tipo}
                  onChange={(event) => controller.updateRatedItem("poderesMisticos", index, "tipo", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Efecto</span>
                <textarea
                  rows={2}
                  value={item.efecto}
                  onChange={(event) => controller.updateRatedItem("poderesMisticos", index, "efecto", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Nivel</span>
                <select
                  value={item.nivel}
                  onChange={(event) => controller.updateRatedItem("poderesMisticos", index, "nivel", event.target.value)}
                >
                  <option value="principiante">Principiante</option>
                  <option value="adepto">Adepto</option>
                  <option value="maestro">Maestro</option>
                </select>
              </label>
              <label className="field">
                <span>Fuente</span>
                <input
                  value={item.fuente}
                  onChange={(event) => controller.updateRatedItem("poderesMisticos", index, "fuente", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Página</span>
                <input
                  value={item.pagina ?? ""}
                  onChange={(event) =>
                    controller.updateRatedItem("poderesMisticos", index, "pagina", Number(event.target.value || 0))
                  }
                />
              </label>
              <button className="subtle-button" onClick={() => openCompendiumCapability("poder_mistico", item.nombre)}>Ver en compendio</button>
              <button onClick={() => controller.removeRatedItem("poderesMisticos", index)}>Quitar</button>
            </article>
          ))}
        </div>

        <div className="inline-row">
          <select
            value={controller.catalogSelection.ritualId}
            onChange={(event) => controller.setCatalogSelection((prev) => ({ ...prev, ritualId: event.target.value }))}
          >
            {controller.catalog.rituales.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} ({item.libro} p.{item.pagina})
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              controller.addCatalogRatedItem(
                "rituales",
                controller.catalog.rituales.find((item) => item.id === controller.catalogSelection.ritualId)
              )
            }
          >
            Agregar del compendio
          </button>
        </div>
        <div className="inline-row">
          <label className="field">
            <span>Nuevo ritual manual</span>
            <input
              value={controller.listInput.rituales}
              onChange={(event) => controller.setListInput((prev) => ({ ...prev, rituales: event.target.value }))}
            />
          </label>
          <button onClick={() => controller.addRatedItem("rituales", "rituales")}>Agregar ritual</button>
        </div>
        <div className="list-grid">
          {controller.form.sheet.rituales.map((item, index) => (
            <article key={`rit-${index}`} className="entry-row">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={item.nombre}
                  onChange={(event) => controller.updateRatedItem("rituales", index, "nombre", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Tipo</span>
                <input
                  value={item.tipo}
                  onChange={(event) => controller.updateRatedItem("rituales", index, "tipo", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Efecto</span>
                <textarea
                  rows={2}
                  value={item.efecto}
                  onChange={(event) => controller.updateRatedItem("rituales", index, "efecto", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Nivel</span>
                <select
                  value={item.nivel}
                  onChange={(event) => controller.updateRatedItem("rituales", index, "nivel", event.target.value)}
                >
                  <option value="principiante">Principiante</option>
                  <option value="adepto">Adepto</option>
                  <option value="maestro">Maestro</option>
                </select>
              </label>
              <label className="field">
                <span>Fuente</span>
                <input
                  value={item.fuente}
                  onChange={(event) => controller.updateRatedItem("rituales", index, "fuente", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Página</span>
                <input
                  value={item.pagina ?? ""}
                  onChange={(event) =>
                    controller.updateRatedItem("rituales", index, "pagina", Number(event.target.value || 0))
                  }
                />
              </label>
              <button className="subtle-button" onClick={() => openCompendiumCapability("ritual", item.nombre)}>Ver en compendio</button>
              <button onClick={() => controller.removeRatedItem("rituales", index)}>Quitar</button>
            </article>
          ))}
        </div>
        </fieldset>

        <div className="section-title">Bendiciones, cargas, rasgos, equipo y contactos</div>
        <p className="section-help">Elementos narrativos y de inventario que impactan la partida y la hoja.</p>
        {isCampaignManagedLock ? <p className="section-help">Inventario, contactos y recursos vivos se editan desde la hoja de campaña.</p> : null}
        <fieldset disabled={isCampaignManagedLock} className="campaign-managed-fieldset">
        <div className="triple-columns">
          <div>
            <div className="inline-row">
              <label className="field">
                <span>Nueva bendición</span>
                <input
                  value={controller.listInput.bendiciones}
                  onChange={(event) => controller.setListInput((prev) => ({ ...prev, bendiciones: event.target.value }))}
                />
              </label>
              <button onClick={() => controller.addSimpleItem("bendiciones")}>Agregar</button>
            </div>
            <ul className="tag-list">
              {controller.form.sheet.bendiciones.map((item, index) => (
                <li key={`ben-${index}`}>
                  {item}
                  <button onClick={() => controller.removeSimpleItem("bendiciones", index)}>x</button>
                </li>
              ))}
            </ul>
            <div className="inline-row">
              <label className="field">
                <span>Nueva carga</span>
                <input
                  value={controller.listInput.cargas}
                  onChange={(event) => controller.setListInput((prev) => ({ ...prev, cargas: event.target.value }))}
                />
              </label>
              <button onClick={() => controller.addSimpleItem("cargas")}>Agregar</button>
            </div>
            <ul className="tag-list">
              {controller.form.sheet.cargas.map((item, index) => (
                <li key={`car-${index}`}>
                  {item}
                  <button onClick={() => controller.removeSimpleItem("cargas", index)}>x</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="inline-row">
              <label className="field">
                <span>Nuevo rasgo</span>
                <input
                  value={controller.listInput.rasgos}
                  onChange={(event) => controller.setListInput((prev) => ({ ...prev, rasgos: event.target.value }))}
                />
              </label>
              <button onClick={() => controller.addSimpleItem("rasgos")}>Agregar</button>
            </div>
            <ul className="tag-list">
              {controller.form.sheet.rasgos.map((item, index) => (
                <li key={`ras-${index}`}>
                  {item}
                  <button onClick={() => controller.removeSimpleItem("rasgos", index)}>x</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="inline-row">
              <label className="field">
                <span>Nuevo equipo</span>
                <input
                  value={controller.listInput.equipo}
                  onChange={(event) => controller.setListInput((prev) => ({ ...prev, equipo: event.target.value }))}
                />
              </label>
              <button onClick={() => controller.addSimpleItem("equipo")}>Agregar</button>
            </div>
            <ul className="tag-list">
              {controller.form.sheet.equipo.map((item, index) => (
                <li key={`eq-${index}`}>
                  {item}
                  <button onClick={() => controller.removeSimpleItem("equipo", index)}>x</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="inline-row">
              <label className="field">
                <span>Nuevo contacto o PNJ relevante</span>
                <input
                  value={controller.listInput.contactos}
                  onChange={(event) => controller.setListInput((prev) => ({ ...prev, contactos: event.target.value }))}
                />
              </label>
              <button onClick={() => controller.addSimpleItem("contactos")}>Agregar</button>
            </div>
            <ul className="tag-list">
              {controller.form.sheet.contactos.map((item, index) => (
                <li key={`con-${index}`}>
                  {item}
                  <button onClick={() => controller.removeSimpleItem("contactos", index)}>x</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        </fieldset>

        <div className="section-title">Trasfondo y notas</div>
        <p className="section-help">Resumen de historia, objetivos y aclaraciones de reglas aplicadas a este PJ.</p>
        {isCampaignManagedLock ? <p className="section-help">Dinero, objetivo personal, grupo, trasfondo vivo y notas de aventura se gestionan desde Campañas.</p> : null}
        <fieldset disabled={isCampaignManagedLock} className="campaign-managed-fieldset">
        <div className="form-grid">
          <label className="field">
            <span>Objetivo personal</span>
            <textarea
              rows={2}
              value={controller.form.sheet.identidad.objetivoPersonal}
              onChange={(event) => controller.updateSheet("identidad.objetivoPersonal", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Dinero</span>
            <input
              value={controller.form.sheet.recursos.dinero}
              onChange={(event) => controller.updateSheet("recursos.dinero", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Otros recursos</span>
            <input
              value={controller.form.sheet.recursos.otros}
              onChange={(event) => controller.updateSheet("recursos.otros", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Nombre del grupo</span>
            <input
              value={controller.form.sheet.grupo.nombre}
              onChange={(event) => controller.updateSheet("grupo.nombre", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Objetivo del grupo</span>
            <textarea
              rows={2}
              value={controller.form.sheet.grupo.objetivo}
              onChange={(event) => controller.updateSheet("grupo.objetivo", event.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span>Trasfondo del personaje</span>
          <textarea
            rows={4}
            value={controller.form.sheet.identidad.trasfondo}
            onChange={(event) => controller.updateSheet("identidad.trasfondo", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Notas de reglas, erratas y referencias</span>
          <textarea
            rows={5}
            value={controller.form.sheet.notas}
            onChange={(event) => controller.updateSheet("notas", event.target.value)}
          />
        </label>

        <div className="section-title">Contactos de Hoja</div>
        <p className="section-help">Cinco contactos estructurados para la segunda pagina del PDF oficial.</p>
        <div className="list-grid">
          {controller.form.sheet.contactosHoja.map((item, index) => (
            <article key={`contacto-hoja-${index}`} className="entry-row">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={item.nombre}
                  onChange={(event) => controller.updateSheet(`contactosHoja.${index}.nombre`, event.target.value)}
                />
              </label>
              <label className="field">
                <span>Raza</span>
                <input
                  value={item.raza}
                  onChange={(event) => controller.updateSheet(`contactosHoja.${index}.raza`, event.target.value)}
                />
              </label>
              <label className="field">
                <span>Ocupación</span>
                <input
                  value={item.ocupacion}
                  onChange={(event) => controller.updateSheet(`contactosHoja.${index}.ocupacion`, event.target.value)}
                />
              </label>
              <label className="field">
                <span>Jugador</span>
                <input
                  value={item.jugador}
                  onChange={(event) => controller.updateSheet(`contactosHoja.${index}.jugador`, event.target.value)}
                />
              </label>
            </article>
          ))}
        </div>

        <div className="section-title">Artefactos</div>
        <p className="section-help">Cuatro ranuras de artefactos segun la hoja oficial.</p>
        <div className="list-grid">
          {controller.form.sheet.artefactos.map((item, index) => (
            <article key={`artefacto-${index}`} className="entry-row">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={item.nombre}
                  onChange={(event) => controller.updateSheet(`artefactos.${index}.nombre`, event.target.value)}
                />
              </label>
              <label className="field">
                <span>Poderes</span>
                <textarea
                  rows={2}
                  value={item.poderes}
                  onChange={(event) => controller.updateSheet(`artefactos.${index}.poderes`, event.target.value)}
                />
              </label>
              <label className="field">
                <span>Corrupción</span>
                <input
                  value={item.corrupcion}
                  onChange={(event) => controller.updateSheet(`artefactos.${index}.corrupcion`, event.target.value)}
                />
              </label>
            </article>
          ))}
        </div>
        </fieldset>
                      </div>
                    </section>
                  ) : null}

                  <section className="character-directory-panel campaign-sheet-card">
                    <div className="row-actions">
                      <div>
                        <h3>Personajes</h3>
                        <p className="section-help">Acceso directo a hoja, constructor, exportacion y duplicado.</p>
                      </div>
                      <span className="meta-text">
                        {controller.isLoading ? "Cargando..." : `${controller.characters.length} registrados`}
                      </span>
                    </div>
                    <div className="cards character-record-grid">
                      {controller.characters.map((character) => (
                        <CharacterCard
                          key={character.id}
                          item={toCharacterCardViewModel(character)}
                          selected={selectedCharacterSheetId === character.id}
                          onOpenSheet={() => openCharacterSheet(character.id)}
                          onOpenBuilder={() => openCharacterBuilder(character.id)}
                          onExportPdf={() => void exportCharacterSheetPdf(character)}
                          onDuplicate={() => void controller.duplicateSelected(character.id)}
                          onOpenHistory={() => setChangeLogCharacterId(character.id)}
                          onDelete={() => {
                            if (window.confirm("Esta acción eliminará el personaje. ¿Deseas continuar?")) {
                              void controller.deleteSelected(character.id);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </section>
                  {changeLogCharacterId ? (() => {
                    const character = controller.characters.find((entry) => entry.id === changeLogCharacterId);
                    return character ? (
                      <CharacterChangeLogModal
                        characterId={character.id}
                        characterName={character.name}
                        ensureAccessToken={ensureAccessToken}
                        onClose={() => setChangeLogCharacterId(null)}
                        onRead={controller.refresh}
                      />
                    ) : null;
                  })() : null}
              </section>
            </section>
          )}
      </section>
    </main>
  );
}






type CharacterActionSheetProps = {
  character: Character;
};

function rollCheck(label: string, target: number): ActionRollResult {
  const total = Math.floor(Math.random() * 20) + 1;
  return {
    kind: "attribute_check",
    label,
    dice: [total],
    formula: "1d20",
    total,
    target,
    success: total <= target
  };
}

function rollDamage(label: string, formula: string): ActionRollResult | null {
  const match = formula.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    return null;
  }

  const diceCount = Number(match[1]);
  const diceSides = Number(match[2]);
  const modifier = Number(match[3] ?? "0");
  if (!Number.isFinite(diceCount) || !Number.isFinite(diceSides) || diceCount <= 0 || diceSides <= 0) {
    return null;
  }

  let total = modifier;
  const dice: number[] = [];
  for (let index = 0; index < diceCount; index += 1) {
    const die = Math.floor(Math.random() * diceSides) + 1;
    dice.push(die);
    total += die;
  }

  return {
    kind: "damage",
    label,
    dice,
    formula,
    total
  };
}

function renderRollGroups(rolls: ActionRollResult[]) {
  const groups = [
    { title: "Prueba", items: rolls.filter((roll) => roll.kind === "attribute_check") },
    { title: "Ataque", items: rolls.filter((roll) => roll.kind === "attack_check") },
    { title: "Daño", items: rolls.filter((roll) => roll.kind === "damage") }
  ].filter((group) => group.items.length > 0);

  return groups.map((group) => (
    <div key={group.title} className="campaign-roll-group">
      <strong>{group.title}</strong>
      <div className="campaign-roll-group-lines">
        {group.items.map((roll, index) => (
          <span key={`${group.title}-${index}`}>
            {roll.label}: {roll.formula} = {roll.total}
            {typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "éxito" : "fallo"}` : ""}
          </span>
        ))}
      </div>
    </div>
  ));
}

function getActionButtonLabel(action: CharacterActionDefinition, phase: CharacterActionPhase): string {
  if (phase === "damage") {
    return "Tirar daño";
  }

  return action.sourceType === "weapon" ? "Tirar ataque" : "Tirar prueba";
}

function getActionPhaseTitle(action: CharacterActionDefinition, phase: CharacterActionPhase): string {
  if (phase === "damage") {
    return "Daño";
  }

  return action.sourceType === "weapon" ? "Ataque" : "Prueba";
}

function attributeLabel(attribute: string): string {
  switch (attribute) {
    case "agil":
      return "Ágil";
    case "atento":
      return "Atento";
    case "discreto":
      return "Discreto";
    case "diestro":
      return "Diestro";
    case "fuerte":
      return "Fuerte";
    case "inteligente":
      return "Inteligente";
    case "persuasivo":
      return "Persuasivo";
    case "tenaz":
      return "Tenaz";
    default:
      return attribute;
  }
}

function CharacterActionSheet({ character }: CharacterActionSheetProps) {
  const sheet = useMemo(() => parseCharacterSheet(character.sheet), [character.sheet]);
  const derived = useMemo(() => computeDerivedStats(sheet), [sheet]);
  const actions = useMemo(() => deriveCharacterActions(sheet), [sheet]);
  const [history, setHistory] = useState<Array<{ title: string; detail?: string; rolls: ActionRollResult[] }>>([]);
  const [rollDestination, setRollDestination] = useState<RollDestination>(() => {
    const destination = getRollDestination();
    return destination === "both" ? "roll20" : destination;
  });
  const [rollTransportStatus, setRollTransportStatus] = useState<string | null>(null);
  const [roll20BridgeStatus, setRoll20BridgeStatus] = useState<Roll20BridgeStatus | null>(null);
  const [pendingRollConfirmation, setPendingRollConfirmation] = useState<PendingCharacterRollConfirmation | null>(null);

  useEffect(() => {
    if (rollDestination === "umbra") {
      setRoll20BridgeStatus(null);
      return;
    }

    let cancelled = false;

    async function checkBridge(): Promise<void> {
      const status = await pingRoll20Bridge();
      if (!cancelled) {
        setRoll20BridgeStatus(status);
      }
    }

    void checkBridge();
    return () => {
      cancelled = true;
    };
  }, [rollDestination]);

  function pushHistory(title: string, rolls: ActionRollResult[], detail?: string): void {
    setHistory((current) => [{ title, detail, rolls }, ...current].slice(0, 12));
  }

  function handleRollDestinationChange(destination: RollDestination): void {
    setRollDestination(destination);
    persistRollDestination(destination);
    setRollTransportStatus(
      destination === "umbra"
        ? "Las tiradas se resolverán dentro de UMBRA."
        : "Las tiradas se prepararán para Roll20 por defecto."
    );
  }

  function queueRoll20Request(request: RollRequest, title: string): void {
    setPendingRollConfirmation({
      request,
      title,
      visibility: "public"
    });
  }

  function runAttributeRoll(attribute: keyof CharacterSheet["atributos"]): void {
    const title = `Prueba de ${attributeLabel(attribute)}`;
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        {
          kind: "check",
          phase: "attack",
          characterName: character.name,
          actionId: `attribute:${attribute}`,
          actionLabel: title,
          sourceName: attributeLabel(attribute),
          sourceType: "ability",
          formula: "1d20",
          target: sheet.atributos[attribute],
          rollAttribute: attribute,
          destination: rollDestination
        },
        title
      );
      return;
    }

    pushHistory(title, [rollCheck(`Prueba (${attributeLabel(attribute)})`, sheet.atributos[attribute])]);
  }

  function runDefenseRoll(): void {
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        {
          kind: "check",
          phase: "attack",
          characterName: character.name,
          actionId: "derived:defense",
          actionLabel: "Defensa",
          sourceName: "Defensa",
          sourceType: "ability",
          formula: "1d20",
          target: derived.defensaTotal,
          destination: rollDestination
        },
        "Defensa"
      );
      return;
    }

    pushHistory("Defensa", [rollCheck("Defensa", derived.defensaTotal)]);
  }

  function runArmorRoll(label: string, formula: string): void {
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        {
          kind: "damage",
          phase: "damage",
          characterName: character.name,
          actionId: `armor:${label}`,
          actionLabel: label,
          sourceName: label,
          sourceType: "ability",
          formula,
          destination: rollDestination
        },
        label
      );
      return;
    }

    const roll = rollDamage(label, formula);
    if (!roll) {
      return;
    }

    pushHistory(label, [roll]);
  }

  function renderActionControls(action: CharacterActionDefinition): ReactNode {
    return (
      <div className="character-action-roll-grid">
        {action.rollAttribute ? (
          <div className="character-action-roll-block">
            <span className="character-action-roll-title">{getActionPhaseTitle(action, "attack")}</span>
            <span className="character-action-roll-meta">1d20 · {attributeLabel(action.rollAttribute)}</span>
            <button type="button" onClick={() => runAction(action, "attack")}>
              {getActionButtonLabel(action, "attack")}
            </button>
          </div>
        ) : null}
        {action.damageFormula ? (
          <div className="character-action-roll-block">
            <span className="character-action-roll-title">Daño</span>
            <span className="character-action-roll-meta">{action.damageFormula}</span>
            <button type="button" onClick={() => runAction(action, "damage")}>
              {getActionButtonLabel(action, "damage")}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function runAction(action: CharacterActionDefinition, phase: CharacterActionPhase): void {
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        buildRollRequest(sheet, character.name, action.id, phase, rollDestination),
        `${action.label} · ${getActionButtonLabel(action, phase)}`
      );
      return;
    }

    const result = executeCharacterAction(sheet, action.id, phase);
    pushHistory(result.action.label, result.rolls, result.action.effectSummary);
  }

  async function handleConfirmRoll20Send(visibility: Roll20Visibility): Promise<void> {
    if (!pendingRollConfirmation) {
      return;
    }

    try {
      const result = await dispatchRoll20Request(pendingRollConfirmation.request, visibility);
      setRoll20BridgeStatus(result.status);
      setRollTransportStatus(result.status.message);
    } catch (error) {
      setRollTransportStatus(error instanceof Error ? error.message : "No se pudo preparar la tirada");
    } finally {
      setPendingRollConfirmation(null);
    }
  }

  const weaponActions = actions.filter((action) => action.sourceType === "weapon");
  const capabilityActions = actions.filter((action) => action.sourceType !== "weapon");

  return (
    <div className="character-action-sheet">
      <div className="row-actions">
        <div>
          <h3>{character.name}</h3>
        </div>
      </div>
      <div className="row-actions">
        <label className="field campaign-roll-destination-field">
          <span>Destino de tiradas</span>
          <select value={rollDestination} onChange={(event) => handleRollDestinationChange(event.target.value as RollDestination)}>
            <option value="roll20">Roll20</option>
            <option value="umbra">UMBRA</option>
          </select>
        </label>
        {rollTransportStatus ? <p className="meta-text campaign-roll-destination-feedback">{rollTransportStatus}</p> : null}
        {rollDestination !== "umbra" && roll20BridgeStatus ? (
          <p className="meta-text campaign-roll-destination-feedback">UMBRA20: {roll20BridgeStatus.message}</p>
        ) : null}
      </div>

      <div className="character-action-sections">
        <section className="campaign-sheet-card">
          <h4>Atributos</h4>
          <div className="campaign-sheet-actions">
            {(Object.entries(sheet.atributos) as Array<[keyof CharacterSheet["atributos"], number]>).map(([key, value]) => (
              <div key={key} className="campaign-action-button campaign-action-button--compact">
                <strong>{attributeLabel(key)}: {value}</strong>
                <div className="campaign-action-controls">
                  <button type="button" onClick={() => runAttributeRoll(key)}>
                    Tirar prueba
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="campaign-sheet-card">
          <h4>Defensa y armaduras</h4>
          <div className="campaign-sheet-actions">
            <div className="campaign-action-button campaign-action-button--compact">
              <strong>Defensa: {derived.defensaTotal}</strong>
              <div className="campaign-action-controls">
                <button type="button" onClick={runDefenseRoll}>Tirar prueba</button>
              </div>
            </div>
            {derived.armaduraActiva ? (
              <div className="campaign-action-button">
                <strong>{sheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Armadura principal")}</strong>
                <span>{derived.armaduraActiva}</span>
                <div className="character-action-roll-grid">
                  <div className="character-action-roll-block">
                    <span className="character-action-roll-title">Protección</span>
                    <span className="character-action-roll-meta">{derived.armaduraActiva}</span>
                    <button type="button" onClick={() => runArmorRoll("Protección principal", derived.armaduraActiva)}>
                      Tirar daño
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {sheet.combate.armaduraSecundariaProteccion ? (
              <div className="campaign-action-button">
                <strong>{sheet.combate.armaduraSecundaria || "Armadura secundaria"}</strong>
                <span>{sheet.combate.armaduraSecundariaProteccion}</span>
                <div className="character-action-roll-grid">
                  <div className="character-action-roll-block">
                    <span className="character-action-roll-title">Protección</span>
                    <span className="character-action-roll-meta">{sheet.combate.armaduraSecundariaProteccion}</span>
                    <button type="button" onClick={() => runArmorRoll("Protección secundaria", sheet.combate.armaduraSecundariaProteccion)}>
                      Tirar daño
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="campaign-sheet-card">
          <h4>Armas</h4>
          <div className="campaign-sheet-actions">
            {weaponActions.map((action) => (
              <div key={action.id} className="campaign-action-button">
                <strong>{action.label}</strong>
                <span>{action.sourceName}</span>
                <span>{action.rollAttribute ? `${action.rollAttribute}` : "Sin atributo"}{action.damageFormula ? ` · ${action.damageFormula}` : ""}</span>
                {renderActionControls(action)}
              </div>
            ))}
            {weaponActions.length === 0 ? <p className="section-help">Este personaje no tiene armas accionables registradas.</p> : null}
          </div>
        </section>

        <section className="campaign-sheet-card">
          <h4>Capacidades accionables</h4>
          <div className="campaign-sheet-actions">
            {capabilityActions.map((action) => (
              <div key={action.id} className="campaign-action-button">
                <strong>{action.label}</strong>
                <span>{action.sourceName}</span>
                <span>
                  {action.cost}
                  {action.rollAttribute ? ` · ${action.rollAttribute}` : ""}
                  {action.damageFormula ? ` · ${action.damageFormula}` : ""}
                </span>
                {renderActionControls(action)}
              </div>
            ))}
            {capabilityActions.length === 0 ? <p className="section-help">Este personaje no tiene capacidades accionables registradas.</p> : null}
          </div>
        </section>

        <section className="campaign-sheet-card">
          <h4>Historial de tiradas</h4>
          {history.length > 0 ? (
            <div className="roll-log">
              {history.map((entry, index) => (
                <div key={`${entry.title}-${index}`} className="character-action-history-entry">
                  <strong>{entry.title}</strong>
                  {renderRollGroups(entry.rolls)}
                  {entry.detail ? <p>{entry.detail}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="section-help">Aún no has lanzado ninguna tirada desde esta hoja.</p>
          )}
        </section>
      </div>
      {pendingRollConfirmation ? (
        <div className="modal-backdrop">
          <div className="panel modal-panel character-roll-confirm-modal">
            <h3>Enviar tirada</h3>
            <p className="section-help">{pendingRollConfirmation.title}</p>
            <div className="row-actions character-roll-confirm-actions">
              <div className="character-roll-confirm-primary">
              <button type="button" onClick={() => void handleConfirmRoll20Send("public")}>
                Público
              </button>
              <button type="button" onClick={() => void handleConfirmRoll20Send("gm")}>
                Solo DJ
              </button>
              </div>
              <button type="button" className="subtle-button" onClick={() => setPendingRollConfirmation(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}




