import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { buildRollRequest, deriveCharacterActions, executeCharacterAction, parseCharacterSheet, synchronizeCharacterSheet } from "@umbra/shared";
import { useLayoutEffect, useRef } from "react";
import { CharacterCard } from "../components/CharacterCard";
import { CharacterChangeLogModal } from "../components/CharacterChangeLogModal";
import { AppTopNavigation } from "../components/AppTopNavigation";
import { AppIcon } from "../components/AppIcon";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
import { CharacterCreationWizard } from "../components/ActorCreationWizard";
import { getRoleLabel, useCharacterController } from "../controllers/characterController";
import { RULE_CATEGORY_LABELS, TYPE_LABELS, findCompendiumCapabilityEntryId, findCompendiumEntryByTypeAndName } from "../models/compendiumEntries";
import { toCharacterCardViewModel } from "../models/characterModel";
import { computeDerivedStats } from "../models/rulesEngine";
import { exportCharacterSheetPdf } from "../services/characterPdfExport";
import { aspireProfession, leaveProfession, removeProfessionAspiration, requestProfessionMembership, updateCharacter } from "../services/characterService";
import { bindMysticArtifact, useMysticArtifactAbility } from "../services/mysticArtifactService";
import { dispatchRoll20Request, getRollDestination, pingRoll20Bridge, setRollDestination as persistRollDestination } from "../services/rollTransport";
import { CampaignDashboardView } from "./CampaignDashboardView";
import { CharacterBuilderView } from "./CharacterBuilderView";
import { CompendiumView } from "./CompendiumView";
import { MonsterDashboardView } from "./MonsterDashboardView";
import { NpcDashboardView } from "./NpcDashboardView";
function getModuleLabel(module) {
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
function parseHash() {
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
            type: rawType && rawType !== "all" && rawType in TYPE_LABELS ? rawType : "all",
            ruleCategory: rawRuleCategory && rawRuleCategory in RULE_CATEGORY_LABELS ? rawRuleCategory : "all",
            mode: mode === "source" || (!mode && source !== "all") ? "source" : "type"
        }
    };
}
export function CharacterDashboardView({ user, ensureAccessToken, onLogout }) {
    const controller = useCharacterController(ensureAccessToken);
    const dashboardRef = useRef(null);
    const isCampaignManagedLock = false;
    const isCapabilityLocked = controller.isEditing;
    const canAccessCharacters = user.role !== "gm";
    const canAccessMonsters = user.role === "gm" || user.role === "superadmin";
    const canAccessNpcs = user.role === "gm" || user.role === "superadmin";
    const [activeModule, setActiveModule] = useState(canAccessCharacters ? "characters" : canAccessNpcs ? "npcs" : canAccessMonsters ? "monsters" : "campaigns");
    const [compendiumFocus, setCompendiumFocus] = useState({
        entryId: null,
        query: "",
        source: "all",
        type: "all",
        ruleCategory: "all",
        mode: "type",
        token: 0
    });
    const [selectedCharacterSheetId, setSelectedCharacterSheetId] = useState(() => parseHash().sheetId ?? null);
    const [selectedCharacterPageMode, setSelectedCharacterPageMode] = useState(() => parseHash().characterPageMode ?? "sheet");
    const [changeLogCharacterId, setChangeLogCharacterId] = useState(null);
    const selectedCharacterSheet = useMemo(() => controller.characters.find((entry) => entry.id === selectedCharacterSheetId) ?? null, [controller.characters, selectedCharacterSheetId]);
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
        function syncWithHash() {
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
    function openCompendiumCapability(tipo, nombre) {
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
    function openCharactersModule() {
        setActiveModule("characters");
        window.location.hash = "characters";
        setSelectedCharacterSheetId(null);
    }
    function openCharacterSheet(characterId) {
        setActiveModule("characters");
        setSelectedCharacterSheetId(characterId);
        setSelectedCharacterPageMode("sheet");
        const params = new URLSearchParams();
        params.set("sheetId", characterId);
        params.set("view", "sheet");
        window.location.hash = `characters?${params.toString()}`;
    }
    function openCharacterBuilder(characterId) {
        setActiveModule("characters");
        setSelectedCharacterSheetId(characterId);
        setSelectedCharacterPageMode("builder");
        const params = new URLSearchParams();
        params.set("sheetId", characterId);
        params.set("view", "builder");
        window.location.hash = `characters?${params.toString()}`;
    }
    function closeCharacterSheet() {
        setSelectedCharacterSheetId(null);
        setSelectedCharacterPageMode("sheet");
        window.location.hash = "characters";
    }
    function openCompendiumModule() {
        setActiveModule("compendium");
        if (!window.location.hash.startsWith("#compendium")) {
            window.location.hash = "compendium";
        }
    }
    function openCampaignsModule() {
        setActiveModule("campaigns");
        if (!window.location.hash.startsWith("#campaigns")) {
            window.location.hash = "campaigns";
        }
    }
    function openMonstersModule() {
        setActiveModule("monsters");
        if (!window.location.hash.startsWith("#monsters")) {
            window.location.hash = "monsters";
        }
    }
    function openNpcsModule() {
        setActiveModule("npcs");
        if (!window.location.hash.startsWith("#npcs")) {
            window.location.hash = "npcs";
        }
    }
    const navigationItems = [
        ...(canAccessCharacters ? [{ id: "characters", label: "Personajes", active: activeModule === "characters", onSelect: openCharactersModule }] : []),
        { id: "campaigns", label: "Campañas", active: activeModule === "campaigns", onSelect: openCampaignsModule },
        ...(canAccessNpcs ? [{ id: "npcs", label: "PNJ", active: activeModule === "npcs", onSelect: openNpcsModule }] : []),
        ...(canAccessMonsters ? [{ id: "monsters", label: "Monstruos", active: activeModule === "monsters", onSelect: openMonstersModule }] : []),
        { id: "compendium", label: "Compendio", active: activeModule === "compendium", onSelect: openCompendiumModule }
    ];
    return (_jsxs("main", { ref: dashboardRef, className: "page app-page", children: [_jsx(AppTopNavigation, { items: navigationItems, currentTitle: mobileHeaderTitle, userEmail: user.email, roleLabel: getRoleLabel(user.role), onLogout: onLogout }), _jsxs("section", { className: `app-content module-theme module-theme--${activeModule}`, children: [selectedCharacterSheet && activeModule === "characters" && selectedCharacterPageMode === "sheet" ? (_jsxs("div", { className: "app-context-navigation", children: [_jsxs("button", { type: "button", className: "text-button character-sheet-back-button", onClick: closeCharacterSheet, children: [_jsx(AppIcon, { name: "arrow-left" }), "Volver"] }), _jsxs("span", { children: ["Personajes / ", selectedCharacterSheet.name] })] })) : null, activeModule === "compendium" ? (_jsx(CompendiumView, { onBackToCharacters: openCharactersModule, ensureAccessToken: ensureAccessToken, initialEntryId: compendiumFocus.entryId, initialQuery: compendiumFocus.query, initialSourceFilter: compendiumFocus.source, initialTypeFilter: compendiumFocus.type, initialRuleCategory: compendiumFocus.ruleCategory, initialBrowseMode: compendiumFocus.mode, focusToken: compendiumFocus.token })) : activeModule === "monsters" ? (_jsx(MonsterDashboardView, { user: user, ensureAccessToken: ensureAccessToken })) : activeModule === "npcs" ? (_jsx(NpcDashboardView, { ensureAccessToken: ensureAccessToken })) : activeModule === "campaigns" ? (_jsx(CampaignDashboardView, { user: user, ensureAccessToken: ensureAccessToken })) : selectedCharacterSheet ? (_jsx("section", { className: "character-actions-page", children: selectedCharacterPageMode === "builder" ? (_jsx(CharacterBuilderView, { character: selectedCharacterSheet, onBackToCharacters: closeCharacterSheet, onOpenSheet: () => openCharacterSheet(selectedCharacterSheet.id), onBindMysticArtifact: async (artifactId, paymentType) => {
                                const token = await ensureAccessToken();
                                await bindMysticArtifact(artifactId, { paymentType }, token);
                                await controller.refresh();
                            }, onAspireProfession: async (professionId) => {
                                const token = await ensureAccessToken();
                                await aspireProfession(selectedCharacterSheet.id, professionId, token);
                                await controller.refresh();
                            }, onRemoveProfessionAspiration: async (professionId) => {
                                const token = await ensureAccessToken();
                                await removeProfessionAspiration(selectedCharacterSheet.id, professionId, token);
                                await controller.refresh();
                            }, onRequestProfession: async (professionId) => {
                                const token = await ensureAccessToken();
                                await requestProfessionMembership(selectedCharacterSheet.id, professionId, token);
                                await controller.refresh();
                            }, onLeaveProfession: async (professionId) => {
                                const token = await ensureAccessToken();
                                await leaveProfession(selectedCharacterSheet.id, professionId, token);
                                await controller.refresh();
                            }, onOpenCompendiumCapability: openCompendiumCapability, onSave: async (nextSheet) => {
                                const token = await ensureAccessToken();
                                const updated = await updateCharacter(selectedCharacterSheet.id, {
                                    name: nextSheet.identidad.nombrePersonaje.trim() || selectedCharacterSheet.name,
                                    archetype: String(nextSheet.identidad.arquetipo),
                                    race: String(nextSheet.identidad.raza),
                                    culture: String(nextSheet.identidad.cultura),
                                    profession: nextSheet.identidad.profesion,
                                    level: 1,
                                    sheet: synchronizeCharacterSheet(nextSheet)
                                }, token);
                                controller.upsertCharacterRecord(updated);
                            } })) : (_jsx(UnifiedCharacterSheet, { title: selectedCharacterSheet.name, subtitle: `${selectedCharacterSheet.culture || "Sin cultura"} · ${selectedCharacterSheet.archetype || "Sin arquetipo"} · ${selectedCharacterSheet.race || "Sin raza"}`, sheet: parseCharacterSheet(selectedCharacterSheet.sheet), professionMemberships: selectedCharacterSheet.professionMemberships, enforceProfessionRestrictions: true, editable: true, backgroundPreferenceScope: user.id, onBack: closeCharacterSheet, onOpenBuilder: () => openCharacterBuilder(selectedCharacterSheet.id), onOpenCompendiumCapability: openCompendiumCapability, onUseArtifactAbility: async (artifactId, abilityId) => {
                                const token = await ensureAccessToken();
                                await useMysticArtifactAbility(artifactId, abilityId, token);
                                await controller.refresh();
                            }, onSave: async (nextSheet) => {
                                const token = await ensureAccessToken();
                                const updated = await updateCharacter(selectedCharacterSheet.id, {
                                    name: nextSheet.identidad.nombrePersonaje.trim() || selectedCharacterSheet.name,
                                    archetype: String(nextSheet.identidad.arquetipo),
                                    race: String(nextSheet.identidad.raza),
                                    culture: String(nextSheet.identidad.cultura),
                                    profession: nextSheet.identidad.profesion,
                                    level: 1,
                                    sheet: synchronizeCharacterSheet(nextSheet)
                                }, token);
                                controller.upsertCharacterRecord(updated);
                            } }, selectedCharacterSheet.id)) })) : (_jsxs("section", { className: "character-directory-page unified-sheet", children: [_jsxs("header", { className: "character-directory-header-band module-sticky-header module-sticky-header--single-row", children: [_jsx("div", { className: "unified-sheet-portrait", "aria-hidden": "true", children: _jsx("div", { className: "unified-sheet-portrait-ring", children: _jsx("div", { className: "unified-sheet-portrait-content", children: "PJ" }) }) }), _jsxs("div", { className: "character-directory-identity", children: [_jsx("h2", { children: "Archivo de personajes" }), _jsx("p", { className: "unified-sheet-inline-subtitle", children: "Gestiona hojas, constructor y progreso de PX con la misma presentacion que la ficha." })] }), _jsxs("div", { className: "toolbar character-directory-header-actions", children: [_jsx("button", { onClick: controller.openCreateModal, children: "Nuevo personaje" }), _jsxs("label", { className: `file-trigger${controller.isSaving ? " is-disabled" : ""}`, children: ["Importar PDF", _jsx("input", { type: "file", accept: "application/pdf,.pdf", disabled: controller.isSaving, onChange: (event) => {
                                                            const file = event.target.files?.[0];
                                                            if (file) {
                                                                void controller.importFromPdf(file);
                                                            }
                                                            event.currentTarget.value = "";
                                                        } })] }), _jsx("button", { disabled: controller.isSaving, onClick: () => void controller.createRandomCharacter(), children: "Generar aleatorio" })] })] }), _jsxs("section", { className: "character-directory-stage", children: [controller.error && !controller.isFormModalOpen ? _jsx("p", { className: "error", children: controller.error }) : null, controller.isFormModalOpen ? (_jsx("section", { className: "modal-backdrop", children: _jsx(CharacterCreationWizard, { controller: controller, onCancel: controller.closeFormModal }) })) : null, false && controller.isFormModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: controller.closeFormModal, children: _jsxs("div", { className: "panel modal-panel character-directory-form-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h2", { children: controller.isEditing ? "Editar personaje" : "Crear personaje" }), _jsxs("div", { className: "toolbar", children: [controller.isEditing ? (_jsx("button", { onClick: () => {
                                                                        const current = controller.characters.find((entry) => entry.id === controller.selectedCharacterId);
                                                                        if (current)
                                                                            void exportCharacterSheetPdf(current);
                                                                    }, children: "Exportar PDF" })) : null, controller.isEditing ? (_jsx("button", { disabled: controller.isSaving, onClick: () => void controller.duplicateSelected(), children: "Duplicar ficha" })) : null, controller.isEditing ? (_jsx("button", { className: "danger", disabled: controller.isSaving, onClick: () => {
                                                                        if (window.confirm("Esta acción eliminará el personaje. ¿Deseas continuar?")) {
                                                                            void controller.deleteSelected();
                                                                        }
                                                                    }, children: "Eliminar ficha" })) : null, _jsx("button", { disabled: controller.isSaving, onClick: () => void controller.submit(), children: controller.isSaving ? "Guardando..." : controller.isEditing ? "Actualizar ficha" : "Crear ficha" }), _jsx("button", { onClick: controller.closeFormModal, children: "Cerrar" })] })] }), controller.error ? _jsx("p", { className: "error", children: controller.error }) : null, controller.validationErrors.length > 0 ? (_jsx("div", { className: "error-list", children: controller.validationErrors.map((message) => (_jsx("p", { children: message }, message))) })) : null, _jsxs("details", { className: "field-guide", children: [_jsx("summary", { children: "Gu\u00EDa r\u00E1pida de campos" }), _jsxs("div", { className: "guide-grid", children: [_jsxs("p", { children: [_jsx("strong", { children: "Nombre del personaje:" }), " Nombre en juego del PJ."] }), _jsxs("p", { children: [_jsx("strong", { children: "Nombre del jugador:" }), " Persona real que lo juega."] }), _jsxs("p", { children: [_jsx("strong", { children: "Raza / Cultura / Arquetipo:" }), " Base narrativa y mec\u00E1nica del personaje."] }), _jsxs("p", { children: [_jsx("strong", { children: "Profesi\u00F3n:" }), " Rol espec\u00EDfico (ej. Templario, Cazatesoros, Bruja)."] }), _jsxs("p", { children: [_jsx("strong", { children: "Atributos:" }), " Valores principales de Symbaroum (5-15)."] }), _jsxs("p", { children: [_jsx("strong", { children: "PX total / gastada:" }), " Experiencia acumulada y usada en mejoras."] }), _jsxs("p", { children: [_jsx("strong", { children: "Robustez:" }), " Salud/aguante actual y m\u00E1ximo."] }), _jsxs("p", { children: [_jsx("strong", { children: "Mod. defensa / iniciativa:" }), " Ajustes por equipo, poderes o efectos."] }), _jsxs("p", { children: [_jsx("strong", { children: "Corrupci\u00F3n temporal/permanente:" }), " Mancha acumulada por magia y oscuridad."] }), _jsxs("p", { children: [_jsx("strong", { children: "Umbral de corrupci\u00F3n:" }), " L\u00EDmite personal antes de consecuencias graves."] }), _jsxs("p", { children: [_jsx("strong", { children: "Fuente/P\u00E1gina:" }), " Libro y p\u00E1gina de la regla usada (trazabilidad)."] })] })] }), _jsx("div", { className: "section-title", children: "Identidad" }), _jsx("p", { className: "section-help", children: "Datos b\u00E1sicos del personaje y su contexto narrativo dentro de la campa\u00F1a." }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del personaje" }), _jsx("input", { value: controller.form.name, onChange: (event) => controller.updateTopLevel("name", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del jugador" }), _jsx("input", { value: controller.form.sheet.identidad.nombreJugador, onChange: (event) => controller.updateSheet("identidad.nombreJugador", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Raza" }), _jsx("input", { value: controller.form.sheet.identidad.raza, onChange: (event) => {
                                                                        controller.updateSheet("identidad.raza", event.target.value);
                                                                        controller.updateTopLevel("race", event.target.value);
                                                                    } })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cultura" }), _jsx("select", { value: controller.form.sheet.identidad.cultura, onChange: (event) => {
                                                                        controller.updateSheet("identidad.cultura", event.target.value);
                                                                        controller.updateTopLevel("culture", event.target.value);
                                                                    }, children: controller.cultures.map((culture) => (_jsx("option", { value: culture, children: culture }, culture))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arquetipo" }), _jsx("select", { value: controller.form.sheet.identidad.arquetipo, onChange: (event) => {
                                                                        controller.updateSheet("identidad.arquetipo", event.target.value);
                                                                        controller.updateTopLevel("archetype", event.target.value);
                                                                    }, children: controller.archetypes.map((archetype) => (_jsx("option", { value: archetype, children: archetype }, archetype))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Profesi\u00F3n" }), _jsx("input", { value: controller.form.sheet.identidad.profesion, onChange: (event) => {
                                                                        controller.updateSheet("identidad.profesion", event.target.value);
                                                                        controller.updateTopLevel("profession", event.target.value);
                                                                    } })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Sombra" }), _jsx("input", { value: controller.form.sheet.identidad.sombra, onChange: (event) => controller.updateSheet("identidad.sombra", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cita" }), _jsx("input", { value: controller.form.sheet.identidad.cita, onChange: (event) => controller.updateSheet("identidad.cita", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Edad" }), _jsx("input", { value: controller.form.sheet.identidad.edad, onChange: (event) => controller.updateSheet("identidad.edad", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Altura" }), _jsx("input", { value: controller.form.sheet.identidad.altura, onChange: (event) => controller.updateSheet("identidad.altura", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Peso" }), _jsx("input", { value: controller.form.sheet.identidad.peso, onChange: (event) => controller.updateSheet("identidad.peso", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Apariencia" }), _jsx("input", { value: controller.form.sheet.identidad.apariencia, onChange: (event) => controller.updateSheet("identidad.apariencia", event.target.value) })] })] }), _jsx("div", { className: "section-title", children: "Atributos" }), _jsx("p", { className: "section-help", children: "Usa los valores oficiales de hoja (5 a 15). Se usar\u00E1n para tiradas y automatizaciones." }), _jsx("div", { className: "attributes-grid", children: controller.attributeKeys.map((attribute) => (_jsxs("label", { className: "attribute-box", children: [_jsx("span", { children: controller.attributeLabels[attribute] }), _jsx("input", { type: "number", min: 5, max: 15, value: controller.form.sheet.atributos[attribute], onChange: (event) => controller.updateSheet(`atributos.${attribute}`, Number(event.target.value || 10)) })] }, attribute))) }), _jsx("div", { className: "section-title", children: "Progreso y recursos" }), _jsx("p", { className: "section-help", children: "El director de juego concede la experiencia. Las compras se realizan desde el constructor sin superar el total disponible." }), isCampaignManagedLock ? _jsx("p", { className: "section-help", children: "Estos campos de progreso y estado de aventura se gestionan desde Campa\u00F1as." }) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "info-box", children: [_jsx("span", { children: "PX total" }), _jsx("strong", { children: controller.form.sheet.progreso.experienciaTotal })] }), _jsxs("div", { className: "info-box", children: [_jsx("span", { children: "PX gastada" }), _jsx("strong", { children: controller.form.sheet.progreso.experienciaGastada })] }), _jsxs("div", { className: "info-box", children: ["PX disponible: ", controller.derived.xpDisponible] })] }), _jsx("div", { className: "section-title", children: "C\u00E1lculos autom\u00E1ticos (MVP)" }), _jsxs("p", { className: "section-help", children: ["Puedes a\u00F1adir modificadores autom\u00E1ticos en efectos/notas usando tokens como: ", _jsx("code", { children: "DEF+1" }), ", ", _jsx("code", { children: "INI+1" }), ",", _jsx("code", { children: "ROBMAX+2" }), ", ", _jsx("code", { children: "UMBCORR+1" }), "."] }), _jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "info-box", children: ["Defensa total: ", controller.derived.defensaTotal] }), _jsxs("div", { className: "info-box", children: ["Robustez m\u00E1x. total: ", controller.derived.robustezMaximaTotal] }), _jsxs("div", { className: "info-box", children: ["Robustez actual total: ", controller.derived.robustezActualTotal] }), _jsxs("div", { className: "info-box", children: ["Umbral de dolor total: ", controller.derived.umbralDolorTotal] }), _jsxs("div", { className: "info-box", children: ["Umbral de corrupci\u00F3n total: ", controller.derived.umbralCorrupcionTotal] }), _jsxs("div", { className: "info-box", children: ["Armadura activa: ", controller.derived.armaduraActiva || "-"] })] }), _jsxs("p", { className: "section-help", children: ["Las bendiciones suman ", _jsx("code", { children: "5 PX" }), " gastados cada una. El bono de las cargas se consolida en los PX totales al crear el personaje y no debe sumarse de nuevo."] }), controller.derived.warnings.length > 0 ? (_jsx("div", { className: "warning-block", children: controller.derived.warnings.map((warning) => (_jsx("p", { children: warning }, warning))) })) : null, _jsx("div", { className: "section-title", children: "Combate y corrupci\u00F3n" }), _jsx("p", { className: "section-help", children: "Estado actual en combate y seguimiento de corrupci\u00F3n temporal/permanente." }), isCampaignManagedLock ? _jsx("p", { className: "section-help", children: "Robustez, corrupci\u00F3n, armas y armadura se actualizan dentro de la campa\u00F1a." }) : null, _jsx("fieldset", { disabled: isCampaignManagedLock, className: "campaign-managed-fieldset", children: _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Robustez m\u00E1xima" }), _jsx("input", { type: "number", min: 0, value: controller.form.sheet.combate.robustezMax, onChange: (event) => controller.updateSheet("combate.robustezMax", Number(event.target.value || 0)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Robustez actual" }), _jsx("input", { type: "number", min: 0, value: controller.form.sheet.combate.robustezActual, onChange: (event) => controller.updateSheet("combate.robustezActual", Number(event.target.value || 0)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Umbral de dolor" }), _jsx("input", { type: "number", min: 0, value: controller.form.sheet.combate.umbralDolor, onChange: (event) => controller.updateSheet("combate.umbralDolor", Number(event.target.value || 0)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Modificador de defensa" }), _jsx("input", { type: "number", value: controller.form.sheet.combate.defensaMod, onChange: (event) => controller.updateSheet("combate.defensaMod", Number(event.target.value || 0)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Defensa (valor en hoja)" }), _jsx("input", { value: controller.form.sheet.combate.defensaBase, onChange: (event) => controller.updateSheet("combate.defensaBase", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Modificador de iniciativa" }), _jsx("input", { type: "number", value: controller.form.sheet.combate.iniciativaMod, onChange: (event) => controller.updateSheet("combate.iniciativaMod", Number(event.target.value || 0)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Armadura" }), _jsx("input", { value: controller.form.sheet.combate.armadura, onChange: (event) => controller.updateSheet("combate.armadura", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Protecci\u00F3n de armadura" }), _jsx("input", { value: controller.form.sheet.combate.armaduraProteccion, onChange: (event) => controller.updateSheet("combate.armaduraProteccion", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cualidad de armadura" }), _jsx("input", { value: controller.form.sheet.combate.armaduraCualidad, onChange: (event) => controller.updateSheet("combate.armaduraCualidad", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arma principal" }), _jsx("input", { value: controller.form.sheet.combate.armaPrincipal, onChange: (event) => controller.updateSheet("combate.armaPrincipal", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cualidad de arma principal" }), _jsx("input", { value: controller.form.sheet.combate.armaPrincipalCualidad, onChange: (event) => controller.updateSheet("combate.armaPrincipalCualidad", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo de arma principal" }), _jsx("input", { value: controller.form.sheet.combate.armaPrincipalAtributo, onChange: (event) => controller.updateSheet("combate.armaPrincipalAtributo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o principal" }), _jsx("input", { value: controller.form.sheet.combate.danioPrincipal, onChange: (event) => controller.updateSheet("combate.danioPrincipal", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arma secundaria" }), _jsx("input", { value: controller.form.sheet.combate.armaSecundaria, onChange: (event) => controller.updateSheet("combate.armaSecundaria", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o secundario" }), _jsx("input", { value: controller.form.sheet.combate.danioSecundaria, onChange: (event) => controller.updateSheet("combate.danioSecundaria", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo de arma secundaria" }), _jsx("input", { value: controller.form.sheet.combate.armaSecundariaAtributo, onChange: (event) => controller.updateSheet("combate.armaSecundariaAtributo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arma terciaria" }), _jsx("input", { value: controller.form.sheet.combate.armaTerciaria, onChange: (event) => controller.updateSheet("combate.armaTerciaria", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cualidad de arma terciaria" }), _jsx("input", { value: controller.form.sheet.combate.armaTerciariaCualidad, onChange: (event) => controller.updateSheet("combate.armaTerciariaCualidad", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo de arma terciaria" }), _jsx("input", { value: controller.form.sheet.combate.armaTerciariaAtributo, onChange: (event) => controller.updateSheet("combate.armaTerciariaAtributo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o terciario" }), _jsx("input", { value: controller.form.sheet.combate.danioTerciaria, onChange: (event) => controller.updateSheet("combate.danioTerciaria", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arma cuaternaria" }), _jsx("input", { value: controller.form.sheet.combate.armaCuaternaria, onChange: (event) => controller.updateSheet("combate.armaCuaternaria", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cualidad de arma cuaternaria" }), _jsx("input", { value: controller.form.sheet.combate.armaCuaternariaCualidad, onChange: (event) => controller.updateSheet("combate.armaCuaternariaCualidad", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo de arma cuaternaria" }), _jsx("input", { value: controller.form.sheet.combate.armaCuaternariaAtributo, onChange: (event) => controller.updateSheet("combate.armaCuaternariaAtributo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o cuaternario" }), _jsx("input", { value: controller.form.sheet.combate.danioCuaternaria, onChange: (event) => controller.updateSheet("combate.danioCuaternaria", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Armadura secundaria" }), _jsx("input", { value: controller.form.sheet.combate.armaduraSecundaria, onChange: (event) => controller.updateSheet("combate.armaduraSecundaria", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Proteccion secundaria" }), _jsx("input", { value: controller.form.sheet.combate.armaduraSecundariaProteccion, onChange: (event) => controller.updateSheet("combate.armaduraSecundariaProteccion", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Corrupci\u00F3n temporal" }), _jsx("input", { type: "number", min: 0, value: controller.form.sheet.corrupcion.temporal, onChange: (event) => controller.updateSheet("corrupcion.temporal", Number(event.target.value || 0)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Corrupci\u00F3n permanente" }), _jsx("input", { type: "number", min: 0, value: controller.form.sheet.corrupcion.permanente, onChange: (event) => controller.updateSheet("corrupcion.permanente", Number(event.target.value || 0)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Umbral de corrupci\u00F3n" }), _jsx("input", { type: "number", min: 0, value: controller.form.sheet.corrupcion.umbral, onChange: (event) => controller.updateSheet("corrupcion.umbral", Number(event.target.value || 0)) })] }), _jsxs("div", { className: "info-box", children: ["Corrupci\u00F3n total: ", controller.derived.corrupcionTotal] })] }) }), _jsx("div", { className: "section-title", children: "Habilidades y capacidades" }), _jsx("p", { className: "section-help", children: "Las capacidades del personaje quedan fijadas fuera de la edici\u00F3n narrativa. Aqu\u00ED se muestran para consulta y referencia de reglas." }), isCapabilityLocked ? _jsx("p", { className: "section-help", children: "Las habilidades, poderes y rituales no se editan desde esta ficha." }) : null, _jsxs("fieldset", { disabled: isCapabilityLocked, className: "campaign-managed-fieldset", children: [_jsxs("div", { className: "inline-row", children: [_jsx("select", { value: controller.catalogSelection.habilidadId, onChange: (event) => controller.setCatalogSelection((prev) => ({ ...prev, habilidadId: event.target.value })), children: controller.catalog.habilidades.map((item) => (_jsxs("option", { value: item.id, children: [item.nombre, " (", item.libro, " p.", item.pagina, ")"] }, item.id))) }), _jsx("button", { onClick: () => controller.addCatalogRatedItem("habilidades", controller.catalog.habilidades.find((item) => item.id === controller.catalogSelection.habilidadId)), children: "Agregar del compendio" })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nueva habilidad manual" }), _jsx("input", { value: controller.listInput.habilidades, onChange: (event) => controller.setListInput((prev) => ({ ...prev, habilidades: event.target.value })) })] }), _jsx("button", { onClick: () => controller.addRatedItem("habilidades", "habilidades"), children: "Agregar" })] }), _jsx("div", { className: "list-grid", children: controller.form.sheet.habilidades.map((item, index) => (_jsxs("article", { className: "entry-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: item.nombre, onChange: (event) => controller.updateRatedItem("habilidades", index, "nombre", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("input", { value: item.tipo, onChange: (event) => controller.updateRatedItem("habilidades", index, "tipo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Efecto" }), _jsx("textarea", { rows: 2, value: item.efecto, onChange: (event) => controller.updateRatedItem("habilidades", index, "efecto", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nivel" }), _jsxs("select", { value: item.nivel, onChange: (event) => controller.updateRatedItem("habilidades", index, "nivel", event.target.value), children: [_jsx("option", { value: "principiante", children: "Principiante" }), _jsx("option", { value: "adepto", children: "Adepto" }), _jsx("option", { value: "maestro", children: "Maestro" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fuente" }), _jsx("input", { value: item.fuente, onChange: (event) => controller.updateRatedItem("habilidades", index, "fuente", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "P\u00E1gina" }), _jsx("input", { value: item.pagina ?? "", onChange: (event) => controller.updateRatedItem("habilidades", index, "pagina", Number(event.target.value || 0)) })] }), _jsx("button", { className: "subtle-button", onClick: () => openCompendiumCapability("habilidad", item.nombre), children: "Ver en compendio" }), _jsx("button", { onClick: () => controller.removeRatedItem("habilidades", index), children: "Quitar" })] }, `hab-${index}`))) }), _jsx("div", { className: "section-title", children: "Poderes m\u00EDsticos y rituales" }), _jsx("p", { className: "section-help", children: "Registra poderes y rituales activos del personaje con su nivel de dominio." }), _jsxs("div", { className: "inline-row", children: [_jsx("select", { value: controller.catalogSelection.poderId, onChange: (event) => controller.setCatalogSelection((prev) => ({ ...prev, poderId: event.target.value })), children: controller.catalog.poderes.map((item) => (_jsxs("option", { value: item.id, children: [item.nombre, " (", item.libro, " p.", item.pagina, ")"] }, item.id))) }), _jsx("button", { onClick: () => controller.addCatalogRatedItem("poderesMisticos", controller.catalog.poderes.find((item) => item.id === controller.catalogSelection.poderId)), children: "Agregar del compendio" })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nuevo poder m\u00EDstico manual" }), _jsx("input", { value: controller.listInput.poderes, onChange: (event) => controller.setListInput((prev) => ({ ...prev, poderes: event.target.value })) })] }), _jsx("button", { onClick: () => controller.addRatedItem("poderesMisticos", "poderes"), children: "Agregar poder" })] }), _jsx("div", { className: "list-grid", children: controller.form.sheet.poderesMisticos.map((item, index) => (_jsxs("article", { className: "entry-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: item.nombre, onChange: (event) => controller.updateRatedItem("poderesMisticos", index, "nombre", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("input", { value: item.tipo, onChange: (event) => controller.updateRatedItem("poderesMisticos", index, "tipo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Efecto" }), _jsx("textarea", { rows: 2, value: item.efecto, onChange: (event) => controller.updateRatedItem("poderesMisticos", index, "efecto", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nivel" }), _jsxs("select", { value: item.nivel, onChange: (event) => controller.updateRatedItem("poderesMisticos", index, "nivel", event.target.value), children: [_jsx("option", { value: "principiante", children: "Principiante" }), _jsx("option", { value: "adepto", children: "Adepto" }), _jsx("option", { value: "maestro", children: "Maestro" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fuente" }), _jsx("input", { value: item.fuente, onChange: (event) => controller.updateRatedItem("poderesMisticos", index, "fuente", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "P\u00E1gina" }), _jsx("input", { value: item.pagina ?? "", onChange: (event) => controller.updateRatedItem("poderesMisticos", index, "pagina", Number(event.target.value || 0)) })] }), _jsx("button", { className: "subtle-button", onClick: () => openCompendiumCapability("poder_mistico", item.nombre), children: "Ver en compendio" }), _jsx("button", { onClick: () => controller.removeRatedItem("poderesMisticos", index), children: "Quitar" })] }, `pow-${index}`))) }), _jsxs("div", { className: "inline-row", children: [_jsx("select", { value: controller.catalogSelection.ritualId, onChange: (event) => controller.setCatalogSelection((prev) => ({ ...prev, ritualId: event.target.value })), children: controller.catalog.rituales.map((item) => (_jsxs("option", { value: item.id, children: [item.nombre, " (", item.libro, " p.", item.pagina, ")"] }, item.id))) }), _jsx("button", { onClick: () => controller.addCatalogRatedItem("rituales", controller.catalog.rituales.find((item) => item.id === controller.catalogSelection.ritualId)), children: "Agregar del compendio" })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nuevo ritual manual" }), _jsx("input", { value: controller.listInput.rituales, onChange: (event) => controller.setListInput((prev) => ({ ...prev, rituales: event.target.value })) })] }), _jsx("button", { onClick: () => controller.addRatedItem("rituales", "rituales"), children: "Agregar ritual" })] }), _jsx("div", { className: "list-grid", children: controller.form.sheet.rituales.map((item, index) => (_jsxs("article", { className: "entry-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: item.nombre, onChange: (event) => controller.updateRatedItem("rituales", index, "nombre", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("input", { value: item.tipo, onChange: (event) => controller.updateRatedItem("rituales", index, "tipo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Efecto" }), _jsx("textarea", { rows: 2, value: item.efecto, onChange: (event) => controller.updateRatedItem("rituales", index, "efecto", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nivel" }), _jsxs("select", { value: item.nivel, onChange: (event) => controller.updateRatedItem("rituales", index, "nivel", event.target.value), children: [_jsx("option", { value: "principiante", children: "Principiante" }), _jsx("option", { value: "adepto", children: "Adepto" }), _jsx("option", { value: "maestro", children: "Maestro" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fuente" }), _jsx("input", { value: item.fuente, onChange: (event) => controller.updateRatedItem("rituales", index, "fuente", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "P\u00E1gina" }), _jsx("input", { value: item.pagina ?? "", onChange: (event) => controller.updateRatedItem("rituales", index, "pagina", Number(event.target.value || 0)) })] }), _jsx("button", { className: "subtle-button", onClick: () => openCompendiumCapability("ritual", item.nombre), children: "Ver en compendio" }), _jsx("button", { onClick: () => controller.removeRatedItem("rituales", index), children: "Quitar" })] }, `rit-${index}`))) })] }), _jsx("div", { className: "section-title", children: "Bendiciones, cargas, rasgos, equipo y contactos" }), _jsx("p", { className: "section-help", children: "Elementos narrativos y de inventario que impactan la partida y la hoja." }), isCampaignManagedLock ? _jsx("p", { className: "section-help", children: "Inventario, contactos y recursos vivos se editan desde la hoja de campa\u00F1a." }) : null, _jsx("fieldset", { disabled: isCampaignManagedLock, className: "campaign-managed-fieldset", children: _jsxs("div", { className: "triple-columns", children: [_jsxs("div", { children: [_jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nueva bendici\u00F3n" }), _jsx("input", { value: controller.listInput.bendiciones, onChange: (event) => controller.setListInput((prev) => ({ ...prev, bendiciones: event.target.value })) })] }), _jsx("button", { onClick: () => controller.addSimpleItem("bendiciones"), children: "Agregar" })] }), _jsx("ul", { className: "tag-list", children: controller.form.sheet.bendiciones.map((item, index) => (_jsxs("li", { children: [item, _jsx("button", { onClick: () => controller.removeSimpleItem("bendiciones", index), children: "x" })] }, `ben-${index}`))) }), _jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nueva carga" }), _jsx("input", { value: controller.listInput.cargas, onChange: (event) => controller.setListInput((prev) => ({ ...prev, cargas: event.target.value })) })] }), _jsx("button", { onClick: () => controller.addSimpleItem("cargas"), children: "Agregar" })] }), _jsx("ul", { className: "tag-list", children: controller.form.sheet.cargas.map((item, index) => (_jsxs("li", { children: [item, _jsx("button", { onClick: () => controller.removeSimpleItem("cargas", index), children: "x" })] }, `car-${index}`))) })] }), _jsxs("div", { children: [_jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nuevo rasgo" }), _jsx("input", { value: controller.listInput.rasgos, onChange: (event) => controller.setListInput((prev) => ({ ...prev, rasgos: event.target.value })) })] }), _jsx("button", { onClick: () => controller.addSimpleItem("rasgos"), children: "Agregar" })] }), _jsx("ul", { className: "tag-list", children: controller.form.sheet.rasgos.map((item, index) => (_jsxs("li", { children: [item, _jsx("button", { onClick: () => controller.removeSimpleItem("rasgos", index), children: "x" })] }, `ras-${index}`))) })] }), _jsxs("div", { children: [_jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nuevo equipo" }), _jsx("input", { value: controller.listInput.equipo, onChange: (event) => controller.setListInput((prev) => ({ ...prev, equipo: event.target.value })) })] }), _jsx("button", { onClick: () => controller.addSimpleItem("equipo"), children: "Agregar" })] }), _jsx("ul", { className: "tag-list", children: controller.form.sheet.equipo.map((item, index) => (_jsxs("li", { children: [item, _jsx("button", { onClick: () => controller.removeSimpleItem("equipo", index), children: "x" })] }, `eq-${index}`))) })] }), _jsxs("div", { children: [_jsxs("div", { className: "inline-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nuevo contacto o PNJ relevante" }), _jsx("input", { value: controller.listInput.contactos, onChange: (event) => controller.setListInput((prev) => ({ ...prev, contactos: event.target.value })) })] }), _jsx("button", { onClick: () => controller.addSimpleItem("contactos"), children: "Agregar" })] }), _jsx("ul", { className: "tag-list", children: controller.form.sheet.contactos.map((item, index) => (_jsxs("li", { children: [item, _jsx("button", { onClick: () => controller.removeSimpleItem("contactos", index), children: "x" })] }, `con-${index}`))) })] })] }) }), _jsx("div", { className: "section-title", children: "Trasfondo y notas" }), _jsx("p", { className: "section-help", children: "Resumen de historia, objetivos y aclaraciones de reglas aplicadas a este PJ." }), isCampaignManagedLock ? _jsx("p", { className: "section-help", children: "Dinero, objetivo personal, grupo, trasfondo vivo y notas de aventura se gestionan desde Campa\u00F1as." }) : null, _jsxs("fieldset", { disabled: isCampaignManagedLock, className: "campaign-managed-fieldset", children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Objetivo personal" }), _jsx("textarea", { rows: 2, value: controller.form.sheet.identidad.objetivoPersonal, onChange: (event) => controller.updateSheet("identidad.objetivoPersonal", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Dinero" }), _jsx("input", { value: controller.form.sheet.recursos.dinero, onChange: (event) => controller.updateSheet("recursos.dinero", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Otros recursos" }), _jsx("input", { value: controller.form.sheet.recursos.otros, onChange: (event) => controller.updateSheet("recursos.otros", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del grupo" }), _jsx("input", { value: controller.form.sheet.grupo.nombre, onChange: (event) => controller.updateSheet("grupo.nombre", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Objetivo del grupo" }), _jsx("textarea", { rows: 2, value: controller.form.sheet.grupo.objetivo, onChange: (event) => controller.updateSheet("grupo.objetivo", event.target.value) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Trasfondo del personaje" }), _jsx("textarea", { rows: 4, value: controller.form.sheet.identidad.trasfondo, onChange: (event) => controller.updateSheet("identidad.trasfondo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas de reglas, erratas y referencias" }), _jsx("textarea", { rows: 5, value: controller.form.sheet.notas, onChange: (event) => controller.updateSheet("notas", event.target.value) })] }), _jsx("div", { className: "section-title", children: "Contactos de Hoja" }), _jsx("p", { className: "section-help", children: "Cinco contactos estructurados para la segunda pagina del PDF oficial." }), _jsx("div", { className: "list-grid", children: controller.form.sheet.contactosHoja.map((item, index) => (_jsxs("article", { className: "entry-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: item.nombre, onChange: (event) => controller.updateSheet(`contactosHoja.${index}.nombre`, event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Raza" }), _jsx("input", { value: item.raza, onChange: (event) => controller.updateSheet(`contactosHoja.${index}.raza`, event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ocupaci\u00F3n" }), _jsx("input", { value: item.ocupacion, onChange: (event) => controller.updateSheet(`contactosHoja.${index}.ocupacion`, event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Jugador" }), _jsx("input", { value: item.jugador, onChange: (event) => controller.updateSheet(`contactosHoja.${index}.jugador`, event.target.value) })] })] }, `contacto-hoja-${index}`))) }), _jsx("div", { className: "section-title", children: "Artefactos" }), _jsx("p", { className: "section-help", children: "Cuatro ranuras de artefactos segun la hoja oficial." }), _jsx("div", { className: "list-grid", children: controller.form.sheet.artefactos.map((item, index) => (_jsxs("article", { className: "entry-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: item.nombre, onChange: (event) => controller.updateSheet(`artefactos.${index}.nombre`, event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Poderes" }), _jsx("textarea", { rows: 2, value: item.poderes, onChange: (event) => controller.updateSheet(`artefactos.${index}.poderes`, event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Corrupci\u00F3n" }), _jsx("input", { value: item.corrupcion, onChange: (event) => controller.updateSheet(`artefactos.${index}.corrupcion`, event.target.value) })] })] }, `artefacto-${index}`))) })] })] }) })) : null, _jsxs("section", { className: "character-directory-panel campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Personajes" }), _jsx("p", { className: "section-help", children: "Acceso directo a hoja, constructor, exportacion y duplicado." })] }), _jsx("span", { className: "meta-text", children: controller.isLoading ? "Cargando..." : `${controller.characters.length} registrados` })] }), _jsx("div", { className: "cards character-record-grid", children: controller.characters.map((character) => (_jsx(CharacterCard, { item: toCharacterCardViewModel(character), selected: selectedCharacterSheetId === character.id, onOpenSheet: () => openCharacterSheet(character.id), onOpenBuilder: () => openCharacterBuilder(character.id), onExportPdf: () => void exportCharacterSheetPdf(character), onDuplicate: () => void controller.duplicateSelected(character.id), onOpenHistory: () => setChangeLogCharacterId(character.id), onDelete: () => {
                                                        if (window.confirm("Esta acción eliminará el personaje. ¿Deseas continuar?")) {
                                                            void controller.deleteSelected(character.id);
                                                        }
                                                    } }, character.id))) })] }), changeLogCharacterId ? (() => {
                                        const character = controller.characters.find((entry) => entry.id === changeLogCharacterId);
                                        return character ? (_jsx(CharacterChangeLogModal, { characterId: character.id, characterName: character.name, ensureAccessToken: ensureAccessToken, onClose: () => setChangeLogCharacterId(null), onRead: controller.refresh })) : null;
                                    })() : null] })] }))] })] }));
}
function rollCheck(label, target) {
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
function rollDamage(label, formula) {
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
    const dice = [];
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
function renderRollGroups(rolls) {
    const groups = [
        { title: "Prueba", items: rolls.filter((roll) => roll.kind === "attribute_check") },
        { title: "Ataque", items: rolls.filter((roll) => roll.kind === "attack_check") },
        { title: "Daño", items: rolls.filter((roll) => roll.kind === "damage") }
    ].filter((group) => group.items.length > 0);
    return groups.map((group) => (_jsxs("div", { className: "campaign-roll-group", children: [_jsx("strong", { children: group.title }), _jsx("div", { className: "campaign-roll-group-lines", children: group.items.map((roll, index) => (_jsxs("span", { children: [roll.label, ": ", roll.formula, " = ", roll.total, typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "éxito" : "fallo"}` : ""] }, `${group.title}-${index}`))) })] }, group.title)));
}
function getActionButtonLabel(action, phase) {
    if (phase === "damage") {
        return "Tirar daño";
    }
    return action.sourceType === "weapon" ? "Tirar ataque" : "Tirar prueba";
}
function getActionPhaseTitle(action, phase) {
    if (phase === "damage") {
        return "Daño";
    }
    return action.sourceType === "weapon" ? "Ataque" : "Prueba";
}
function attributeLabel(attribute) {
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
function CharacterActionSheet({ character }) {
    const sheet = useMemo(() => parseCharacterSheet(character.sheet), [character.sheet]);
    const derived = useMemo(() => computeDerivedStats(sheet), [sheet]);
    const actions = useMemo(() => deriveCharacterActions(sheet), [sheet]);
    const [history, setHistory] = useState([]);
    const [rollDestination, setRollDestination] = useState(() => {
        const destination = getRollDestination();
        return destination === "both" ? "roll20" : destination;
    });
    const [rollTransportStatus, setRollTransportStatus] = useState(null);
    const [roll20BridgeStatus, setRoll20BridgeStatus] = useState(null);
    const [pendingRollConfirmation, setPendingRollConfirmation] = useState(null);
    useEffect(() => {
        if (rollDestination === "umbra") {
            setRoll20BridgeStatus(null);
            return;
        }
        let cancelled = false;
        async function checkBridge() {
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
    function pushHistory(title, rolls, detail) {
        setHistory((current) => [{ title, detail, rolls }, ...current].slice(0, 12));
    }
    function handleRollDestinationChange(destination) {
        setRollDestination(destination);
        persistRollDestination(destination);
        setRollTransportStatus(destination === "umbra"
            ? "Las tiradas se resolverán dentro de UMBRA."
            : "Las tiradas se prepararán para Roll20 por defecto.");
    }
    function queueRoll20Request(request, title) {
        setPendingRollConfirmation({
            request,
            title,
            visibility: "public"
        });
    }
    function runAttributeRoll(attribute) {
        const title = `Prueba de ${attributeLabel(attribute)}`;
        if (rollDestination !== "umbra") {
            queueRoll20Request({
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
            }, title);
            return;
        }
        pushHistory(title, [rollCheck(`Prueba (${attributeLabel(attribute)})`, sheet.atributos[attribute])]);
    }
    function runDefenseRoll() {
        if (rollDestination !== "umbra") {
            queueRoll20Request({
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
            }, "Defensa");
            return;
        }
        pushHistory("Defensa", [rollCheck("Defensa", derived.defensaTotal)]);
    }
    function runArmorRoll(label, formula) {
        if (rollDestination !== "umbra") {
            queueRoll20Request({
                kind: "damage",
                phase: "damage",
                characterName: character.name,
                actionId: `armor:${label}`,
                actionLabel: label,
                sourceName: label,
                sourceType: "ability",
                formula,
                destination: rollDestination
            }, label);
            return;
        }
        const roll = rollDamage(label, formula);
        if (!roll) {
            return;
        }
        pushHistory(label, [roll]);
    }
    function renderActionControls(action) {
        return (_jsxs("div", { className: "character-action-roll-grid", children: [action.rollAttribute ? (_jsxs("div", { className: "character-action-roll-block", children: [_jsx("span", { className: "character-action-roll-title", children: getActionPhaseTitle(action, "attack") }), _jsxs("span", { className: "character-action-roll-meta", children: ["1d20 \u00B7 ", attributeLabel(action.rollAttribute)] }), _jsx("button", { type: "button", onClick: () => runAction(action, "attack"), children: getActionButtonLabel(action, "attack") })] })) : null, action.damageFormula ? (_jsxs("div", { className: "character-action-roll-block", children: [_jsx("span", { className: "character-action-roll-title", children: "Da\u00F1o" }), _jsx("span", { className: "character-action-roll-meta", children: action.damageFormula }), _jsx("button", { type: "button", onClick: () => runAction(action, "damage"), children: getActionButtonLabel(action, "damage") })] })) : null] }));
    }
    function runAction(action, phase) {
        if (rollDestination !== "umbra") {
            queueRoll20Request(buildRollRequest(sheet, character.name, action.id, phase, rollDestination), `${action.label} · ${getActionButtonLabel(action, phase)}`);
            return;
        }
        const result = executeCharacterAction(sheet, action.id, phase);
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    async function handleConfirmRoll20Send(visibility) {
        if (!pendingRollConfirmation) {
            return;
        }
        try {
            const result = await dispatchRoll20Request(pendingRollConfirmation.request, visibility);
            setRoll20BridgeStatus(result.status);
            setRollTransportStatus(result.status.message);
        }
        catch (error) {
            setRollTransportStatus(error instanceof Error ? error.message : "No se pudo preparar la tirada");
        }
        finally {
            setPendingRollConfirmation(null);
        }
    }
    const weaponActions = actions.filter((action) => action.sourceType === "weapon");
    const capabilityActions = actions.filter((action) => action.sourceType !== "weapon");
    return (_jsxs("div", { className: "character-action-sheet", children: [_jsx("div", { className: "row-actions", children: _jsx("div", { children: _jsx("h3", { children: character.name }) }) }), _jsxs("div", { className: "row-actions", children: [_jsxs("label", { className: "field campaign-roll-destination-field", children: [_jsx("span", { children: "Destino de tiradas" }), _jsxs("select", { value: rollDestination, onChange: (event) => handleRollDestinationChange(event.target.value), children: [_jsx("option", { value: "roll20", children: "Roll20" }), _jsx("option", { value: "umbra", children: "UMBRA" })] })] }), rollTransportStatus ? _jsx("p", { className: "meta-text campaign-roll-destination-feedback", children: rollTransportStatus }) : null, rollDestination !== "umbra" && roll20BridgeStatus ? (_jsxs("p", { className: "meta-text campaign-roll-destination-feedback", children: ["UMBRA20: ", roll20BridgeStatus.message] })) : null] }), _jsxs("div", { className: "character-action-sections", children: [_jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Atributos" }), _jsx("div", { className: "campaign-sheet-actions", children: Object.entries(sheet.atributos).map(([key, value]) => (_jsxs("div", { className: "campaign-action-button campaign-action-button--compact", children: [_jsxs("strong", { children: [attributeLabel(key), ": ", value] }), _jsx("div", { className: "campaign-action-controls", children: _jsx("button", { type: "button", onClick: () => runAttributeRoll(key), children: "Tirar prueba" }) })] }, key))) })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Defensa y armaduras" }), _jsxs("div", { className: "campaign-sheet-actions", children: [_jsxs("div", { className: "campaign-action-button campaign-action-button--compact", children: [_jsxs("strong", { children: ["Defensa: ", derived.defensaTotal] }), _jsx("div", { className: "campaign-action-controls", children: _jsx("button", { type: "button", onClick: runDefenseRoll, children: "Tirar prueba" }) })] }), derived.armaduraActiva ? (_jsxs("div", { className: "campaign-action-button", children: [_jsx("strong", { children: sheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Armadura principal") }), _jsx("span", { children: derived.armaduraActiva }), _jsx("div", { className: "character-action-roll-grid", children: _jsxs("div", { className: "character-action-roll-block", children: [_jsx("span", { className: "character-action-roll-title", children: "Protecci\u00F3n" }), _jsx("span", { className: "character-action-roll-meta", children: derived.armaduraActiva }), _jsx("button", { type: "button", onClick: () => runArmorRoll("Protección principal", derived.armaduraActiva), children: "Tirar da\u00F1o" })] }) })] })) : null, sheet.combate.armaduraSecundariaProteccion ? (_jsxs("div", { className: "campaign-action-button", children: [_jsx("strong", { children: sheet.combate.armaduraSecundaria || "Armadura secundaria" }), _jsx("span", { children: sheet.combate.armaduraSecundariaProteccion }), _jsx("div", { className: "character-action-roll-grid", children: _jsxs("div", { className: "character-action-roll-block", children: [_jsx("span", { className: "character-action-roll-title", children: "Protecci\u00F3n" }), _jsx("span", { className: "character-action-roll-meta", children: sheet.combate.armaduraSecundariaProteccion }), _jsx("button", { type: "button", onClick: () => runArmorRoll("Protección secundaria", sheet.combate.armaduraSecundariaProteccion), children: "Tirar da\u00F1o" })] }) })] })) : null] })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Armas" }), _jsxs("div", { className: "campaign-sheet-actions", children: [weaponActions.map((action) => (_jsxs("div", { className: "campaign-action-button", children: [_jsx("strong", { children: action.label }), _jsx("span", { children: action.sourceName }), _jsxs("span", { children: [action.rollAttribute ? `${action.rollAttribute}` : "Sin atributo", action.damageFormula ? ` · ${action.damageFormula}` : ""] }), renderActionControls(action)] }, action.id))), weaponActions.length === 0 ? _jsx("p", { className: "section-help", children: "Este personaje no tiene armas accionables registradas." }) : null] })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Capacidades accionables" }), _jsxs("div", { className: "campaign-sheet-actions", children: [capabilityActions.map((action) => (_jsxs("div", { className: "campaign-action-button", children: [_jsx("strong", { children: action.label }), _jsx("span", { children: action.sourceName }), _jsxs("span", { children: [action.cost, action.rollAttribute ? ` · ${action.rollAttribute}` : "", action.damageFormula ? ` · ${action.damageFormula}` : ""] }), renderActionControls(action)] }, action.id))), capabilityActions.length === 0 ? _jsx("p", { className: "section-help", children: "Este personaje no tiene capacidades accionables registradas." }) : null] })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Historial de tiradas" }), history.length > 0 ? (_jsx("div", { className: "roll-log", children: history.map((entry, index) => (_jsxs("div", { className: "character-action-history-entry", children: [_jsx("strong", { children: entry.title }), renderRollGroups(entry.rolls), entry.detail ? _jsx("p", { children: entry.detail }) : null] }, `${entry.title}-${index}`))) })) : (_jsx("p", { className: "section-help", children: "A\u00FAn no has lanzado ninguna tirada desde esta hoja." }))] })] }), pendingRollConfirmation ? (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal", children: [_jsx("h3", { children: "Enviar tirada" }), _jsx("p", { className: "section-help", children: pendingRollConfirmation.title }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsxs("div", { className: "character-roll-confirm-primary", children: [_jsx("button", { type: "button", onClick: () => void handleConfirmRoll20Send("public"), children: "P\u00FAblico" }), _jsx("button", { type: "button", onClick: () => void handleConfirmRoll20Send("gm"), children: "Solo DJ" })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setPendingRollConfirmation(null), children: "Cancelar" })] })] }) })) : null] }));
}
