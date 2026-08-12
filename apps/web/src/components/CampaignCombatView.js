import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { addCampaignCombatParticipant, advanceCampaignCombatTurn, fetchCampaignCombat, finishCampaignCombat, removeCampaignCombatParticipant, reorderCampaignCombat, startCampaignCombat, updateCampaignCombatParticipant, updateCampaignCombatResources } from "../services/campaignService";
import { fetchCustomMonsters, fetchMonsterCodex } from "../services/monsterService";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { MonsterReferenceSheet } from "./MonsterReferenceSheet";
import { UnifiedCharacterSheet } from "./UnifiedCharacterSheet";
const MANUAL_CONDITIONS = [
    ["condition-burning", "Ardiendo"], ["condition-stunned", "Aturdido"], ["condition-blinded", "Cegado"],
    ["condition-prone", "Derribado"], ["condition-poisoned", "Envenenado"], ["condition-immobilized", "Inmovilizado"],
    ["condition-paralyzed", "Paralizado"], ["condition-bleeding", "Sangrando"]
];
function participantTypeLabel(kind) {
    return kind === "character" ? "PJ" : kind === "npc" ? "PNJ" : "Monstruo";
}
function monsterFromSnapshot(participant) {
    if (!participant.snapshot)
        return null;
    const snapshot = participant.snapshot;
    return {
        id: snapshot.id,
        name: snapshot.name,
        category: snapshot.category,
        threat: snapshot.threat,
        source: snapshot.source,
        summary: snapshot.summary,
        sheet: snapshot.sheet,
        family: snapshot.sheet.family || undefined,
        variant: snapshot.sheet.variant || undefined,
        references: snapshot.sheet.sourceReferences,
        appearanceOrder: snapshot.sheet.appearanceOrder,
        publishedThreat: snapshot.sheet.publishedThreat || undefined,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt
    };
}
export function CampaignCombatView({ campaign, ensureAccessToken, onOpenCharacter, onCampaignRefresh }) {
    const [combat, setCombat] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerTab, setPickerTab] = useState("character");
    const [monsterSearch, setMonsterSearch] = useState("");
    const [monsterQuantity, setMonsterQuantity] = useState(1);
    const [officialMonsters, setOfficialMonsters] = useState([]);
    const [customMonsters, setCustomMonsters] = useState([]);
    const [selectedMonster, setSelectedMonster] = useState(null);
    const [selectedNpcSheet, setSelectedNpcSheet] = useState(null);
    const draggedId = useRef(null);
    useBodyScrollLock(pickerOpen || Boolean(selectedMonster) || Boolean(selectedNpcSheet));
    const loadCombat = async (silent = false) => {
        if (!silent)
            setLoading(true);
        try {
            const token = await ensureAccessToken();
            setCombat(await fetchCampaignCombat(campaign.id, token));
            if (!silent)
                setError(null);
        }
        catch (loadError) {
            if (!silent)
                setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el combate");
        }
        finally {
            if (!silent)
                setLoading(false);
        }
    };
    useEffect(() => { void loadCombat(); }, [campaign.id]);
    useEffect(() => {
        const timer = window.setInterval(() => { if (!document.hidden && !busy)
            void loadCombat(true); }, 5000);
        const onFocus = () => { if (!busy)
            void loadCombat(true); };
        window.addEventListener("focus", onFocus);
        return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
    }, [campaign.id, busy]);
    useEffect(() => {
        if (!pickerOpen || pickerTab !== "monster" || officialMonsters.length > 0)
            return;
        void (async () => {
            try {
                const token = await ensureAccessToken();
                const [official, custom] = await Promise.all([fetchMonsterCodex(token), fetchCustomMonsters(token)]);
                setOfficialMonsters(official);
                setCustomMonsters(custom);
            }
            catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el catálogo de monstruos");
            }
        })();
    }, [pickerOpen, pickerTab, officialMonsters.length]);
    const linkedCharacterIds = new Set(combat?.participants.filter((entry) => entry.kind === "character").map((entry) => entry.sourceId) ?? []);
    const linkedNpcIds = new Set(combat?.participants.filter((entry) => entry.kind === "npc").map((entry) => entry.sourceId) ?? []);
    const filteredMonsters = useMemo(() => {
        const query = monsterSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return [...officialMonsters.map((monster) => ({ monster, sourceKind: "official" })), ...customMonsters.map((monster) => ({ monster, sourceKind: "custom" }))]
            .filter(({ monster }) => !query || `${monster.name} ${monster.family ?? ""} ${monster.summary}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query));
    }, [customMonsters, monsterSearch, officialMonsters]);
    async function mutate(action, refreshCampaign = false) {
        setBusy(true);
        setError(null);
        try {
            const token = await ensureAccessToken();
            const next = await action(token);
            setCombat(next);
            if (refreshCampaign)
                await onCampaignRefresh();
            return next;
        }
        catch (mutationError) {
            setError(mutationError instanceof Error ? mutationError.message : "No se pudo guardar el combate");
            await loadCombat(true);
            return null;
        }
        finally {
            setBusy(false);
        }
    }
    async function addAndSort(input) {
        const added = await mutate((token) => addCampaignCombatParticipant(campaign.id, input, token));
        if (!added || added.participants.length < 2)
            return;
        const participantIds = [...added.participants].sort((left, right) => right.initiative - left.initiative || left.alias.localeCompare(right.alias)).map((entry) => entry.id);
        await mutate((token) => reorderCampaignCombat(campaign.id, { revision: added.revision, participantIds }, token));
    }
    async function patchResources(participant, patch) {
        const previous = combat;
        if (combat)
            setCombat({ ...combat, participants: combat.participants.map((entry) => entry.id === participant.id ? {
                    ...entry,
                    robustnessCurrent: patch.robustnessCurrent ?? entry.robustnessCurrent,
                    temporaryCorruption: patch.temporaryCorruption ?? entry.temporaryCorruption,
                    permanentCorruption: patch.permanentCorruption ?? entry.permanentCorruption,
                    conditions: patch.conditions ?? entry.conditions
                } : entry) });
        const saved = await mutate((token) => updateCampaignCombatResources(campaign.id, participant.id, patch, token), participant.kind !== "monster");
        if (!saved && previous)
            setCombat(previous);
    }
    async function reorderByIds(ids) {
        if (!combat)
            return;
        await mutate((token) => reorderCampaignCombat(campaign.id, { revision: combat.revision, participantIds: ids }, token));
    }
    if (loading)
        return _jsx("section", { className: "panel campaign-combat-empty", children: _jsx("p", { children: "Cargando combate\u2026" }) });
    if (!combat)
        return (_jsxs("section", { className: "panel campaign-combat-empty", children: [_jsx("h3", { children: "Combate" }), _jsx("p", { className: "section-help", children: "Inicia un encuentro para reunir aqu\u00ED el estado de PJ, PNJ y monstruos." }), error ? _jsx("p", { className: "error-text", children: error }) : null, _jsx("button", { type: "button", disabled: busy, onClick: () => void mutate((token) => startCampaignCombat(campaign.id, token)), children: "Iniciar combate" })] }));
    return (_jsxs("section", { className: "campaign-combat", "aria-label": "Combate de campa\u00F1a", children: [_jsxs("header", { className: "panel campaign-combat-toolbar", children: [_jsxs("div", { children: [_jsx("span", { className: "campaign-combat-eyebrow", children: "ENCUENTRO ACTIVO" }), _jsxs("h3", { children: ["Ronda ", combat.round] }), _jsx("p", { children: combat.participants.find((entry) => entry.id === combat.activeParticipantId)?.alias ?? "Sin turno activo" })] }), _jsxs("div", { className: "campaign-combat-toolbar-actions", children: [_jsx("button", { type: "button", disabled: busy || combat.participants.length === 0, onClick: () => void mutate((token) => advanceCampaignCombatTurn(campaign.id, { revision: combat.revision, action: "previous" }, token)), children: "\u2190 Turno" }), _jsx("button", { type: "button", disabled: busy || combat.participants.length === 0, onClick: () => void mutate((token) => advanceCampaignCombatTurn(campaign.id, { revision: combat.revision, action: "next" }, token)), children: "Turno \u2192" }), _jsx("button", { type: "button", onClick: () => setPickerOpen(true), children: "A\u00F1adir participante" }), _jsx("button", { type: "button", className: "subtle-button", disabled: busy || combat.participants.length < 2, onClick: () => void reorderByIds([...combat.participants].sort((a, b) => b.initiative - a.initiative).map((entry) => entry.id)), children: "Ordenar iniciativa" }), _jsx("button", { type: "button", className: "subtle-button", disabled: busy, onClick: () => { if (window.confirm("¿Reiniciar el combate? Se eliminará el estado actual."))
                                    void mutate((token) => startCampaignCombat(campaign.id, token)); }, children: "Reiniciar" }), _jsx("button", { type: "button", className: "danger-button", disabled: busy, onClick: () => { if (window.confirm("¿Finalizar el combate? Este estado no se archivará."))
                                    void (async () => { setBusy(true); try {
                                        const token = await ensureAccessToken();
                                        await finishCampaignCombat(campaign.id, token);
                                        setCombat(null);
                                    }
                                    catch (finishError) {
                                        setError(finishError instanceof Error ? finishError.message : "No se pudo finalizar");
                                    }
                                    finally {
                                        setBusy(false);
                                    } })(); }, children: "Finalizar" })] })] }), error ? _jsx("p", { className: "error-text campaign-combat-error", children: error }) : null, _jsxs("div", { className: "campaign-combat-list", children: [combat.participants.map((participant, index) => {
                        const isActive = participant.id === combat.activeParticipantId;
                        const automaticIds = new Set(["condition-dying", "legacy-dying", "legacy-corruption"]);
                        return (_jsxs("article", { className: `campaign-combat-card${isActive ? " is-active" : ""}`, draggable: !busy, onDragStart: () => { draggedId.current = participant.id; }, onDragOver: (event) => event.preventDefault(), onDrop: () => { const sourceId = draggedId.current; if (!sourceId || sourceId === participant.id)
                                return; const ids = combat.participants.map((entry) => entry.id); const from = ids.indexOf(sourceId); ids.splice(from, 1); ids.splice(index, 0, sourceId); draggedId.current = null; void reorderByIds(ids); }, children: [_jsxs("header", { children: [_jsx("button", { className: "campaign-combat-drag", type: "button", "aria-label": `Mover ${participant.alias}`, children: "\u22EE\u22EE" }), _jsxs("div", { children: [_jsx("span", { children: participantTypeLabel(participant.kind) }), _jsx("strong", { children: participant.alias })] }), _jsxs("label", { children: [_jsx("span", { children: "Iniciativa" }), _jsx("input", { "aria-label": `Iniciativa de ${participant.alias}`, type: "number", value: participant.initiativeOverride ?? participant.initiative, onChange: (event) => void mutate((token) => updateCampaignCombatParticipant(campaign.id, participant.id, { revision: combat.revision, initiativeOverride: Number(event.target.value) }, token)) })] }), _jsx("button", { type: "button", className: isActive ? "is-current-turn" : "subtle-button", disabled: busy, onClick: () => void mutate((token) => advanceCampaignCombatTurn(campaign.id, { revision: combat.revision, action: "select", participantId: participant.id }, token)), children: isActive ? "Turno actual" : "Dar turno" })] }), _jsxs("div", { className: "campaign-combat-stats", children: [_jsxs("div", { className: "campaign-combat-resource", children: [_jsx("span", { children: "Robustez" }), _jsxs("strong", { children: [participant.robustnessCurrent, " / ", participant.robustnessMaximum] }), _jsxs("div", { children: [_jsx("button", { "aria-label": `Restar Robustez a ${participant.alias}`, disabled: busy || participant.robustnessCurrent <= 0, onClick: () => void patchResources(participant, { robustnessCurrent: participant.robustnessCurrent - 1 }), children: "\u2212" }), _jsx("button", { "aria-label": `Sumar Robustez a ${participant.alias}`, disabled: busy || participant.robustnessCurrent >= participant.robustnessMaximum, onClick: () => void patchResources(participant, { robustnessCurrent: participant.robustnessCurrent + 1 }), children: "+" })] })] }), _jsxs("div", { children: [_jsx("span", { children: "Defensa" }), _jsx("strong", { children: participant.defense })] }), _jsxs("div", { children: [_jsx("span", { children: "Armadura" }), _jsx("strong", { children: participant.armor || "—" })] }), _jsxs("div", { children: [_jsx("span", { children: "Umbral de dolor" }), _jsx("strong", { children: participant.painThreshold })] }), _jsxs("div", { className: "campaign-combat-resource", children: [_jsx("span", { children: "Corrupci\u00F3n temporal" }), _jsx("strong", { children: participant.temporaryCorruption }), _jsxs("div", { children: [_jsx("button", { disabled: busy || participant.temporaryCorruption <= 0, onClick: () => void patchResources(participant, { temporaryCorruption: Math.max(0, participant.temporaryCorruption - 1) }), children: "\u2212" }), _jsx("button", { disabled: busy, onClick: () => void patchResources(participant, { temporaryCorruption: participant.temporaryCorruption + 1 }), children: "+" })] })] }), _jsxs("div", { className: "campaign-combat-resource", children: [_jsx("span", { children: "Corrupci\u00F3n permanente" }), _jsx("strong", { children: participant.permanentCorruption }), _jsxs("div", { children: [_jsx("button", { disabled: busy || participant.permanentCorruption <= 0, onClick: () => void patchResources(participant, { permanentCorruption: Math.max(0, participant.permanentCorruption - 1) }), children: "\u2212" }), _jsx("button", { disabled: busy, onClick: () => void patchResources(participant, { permanentCorruption: participant.permanentCorruption + 1 }), children: "+" })] })] }), _jsxs("div", { children: [_jsx("span", { children: "Umbral de corrupci\u00F3n" }), _jsx("strong", { children: participant.corruptionThreshold })] })] }), _jsxs("div", { className: "campaign-combat-card-details", children: [_jsxs("section", { children: [_jsx("h4", { children: "Ataques" }), participant.attacks.length ? participant.attacks.map((attack, attackIndex) => _jsxs("div", { className: "campaign-combat-attack", children: [_jsx("strong", { children: attack.name }), _jsxs("span", { children: [attack.attribute, " \u00B7 ", attack.damage, attack.qualities ? ` · ${attack.qualities}` : ""] })] }, `${attack.name}-${attackIndex}`)) : _jsx("span", { children: "Sin ataques registrados." })] }), _jsxs("section", { children: [_jsx("h4", { children: "Condiciones" }), _jsxs("div", { className: "campaign-combat-conditions", children: [MANUAL_CONDITIONS.map(([id, name]) => { const active = participant.conditions.some((condition) => condition.id === id && condition.active); return _jsx("button", { type: "button", "aria-pressed": active, className: active ? "is-active" : "", disabled: busy, onClick: () => { const preserved = participant.conditions.filter((condition) => condition.id !== id); if (!active)
                                                                preserved.push({ id, name, category: "state", active: true, severity: "minor", summary: "", notes: "" }); void patchResources(participant, { conditions: preserved }); }, children: name }, id); }), participant.conditions.filter((condition) => automaticIds.has(condition.id)).map((condition) => _jsx("span", { className: "is-automatic", children: condition.name }, condition.id))] })] })] }), _jsxs("footer", { children: [_jsx("button", { type: "button", className: "subtle-button", disabled: busy, onClick: () => { const alias = window.prompt("Nombre mostrado en combate", participant.alias)?.trim(); if (alias && alias !== participant.alias)
                                                void mutate((token) => updateCampaignCombatParticipant(campaign.id, participant.id, { revision: combat.revision, alias }, token)); }, children: "Renombrar" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => { if (participant.kind === "character")
                                                onOpenCharacter(participant.sourceId);
                                            else if (participant.kind === "npc") {
                                                const npc = campaign.npcs.find((entry) => entry.id === participant.sourceId);
                                                if (npc?.sheet)
                                                    setSelectedNpcSheet({ name: npc.name, sheet: npc.sheet });
                                            }
                                            else
                                                setSelectedMonster(participant); }, children: "Ver ficha completa" }), _jsx("button", { type: "button", className: "danger-button", disabled: busy, onClick: () => void mutate((token) => removeCampaignCombatParticipant(campaign.id, participant.id, token)), children: "Retirar" })] })] }, participant.id));
                    }), combat.participants.length === 0 ? _jsx("div", { className: "panel campaign-combat-empty", children: _jsx("p", { children: "A\u00F1ade PJ, PNJ o monstruos para comenzar el orden de iniciativa." }) }) : null] }), pickerOpen ? _jsx("div", { className: "modal-backdrop", role: "presentation", onMouseDown: (event) => { if (event.target === event.currentTarget)
                    setPickerOpen(false); }, children: _jsxs("section", { className: "modal-panel campaign-combat-picker", role: "dialog", "aria-modal": "true", "aria-labelledby": "combat-picker-title", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("h3", { id: "combat-picker-title", children: "A\u00F1adir al combate" }), _jsx("p", { className: "section-help", children: "Los monstruos se copian como instancias independientes." })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setPickerOpen(false), children: "Cerrar" })] }), _jsxs("nav", { "aria-label": "Tipos de participante", children: [_jsx("button", { className: pickerTab === "character" ? "is-active" : "", onClick: () => setPickerTab("character"), children: "PJ" }), _jsx("button", { className: pickerTab === "npc" ? "is-active" : "", onClick: () => setPickerTab("npc"), children: "PNJ" }), _jsx("button", { className: pickerTab === "monster" ? "is-active" : "", onClick: () => setPickerTab("monster"), children: "Monstruos" })] }), _jsxs("div", { className: "campaign-combat-picker-list", children: [pickerTab === "character" ? campaign.characters.filter((entry) => entry.sheet && !linkedCharacterIds.has(entry.id)).map((entry) => _jsxs("button", { disabled: busy, onClick: () => void addAndSort({ kind: "character", campaignCharacterId: entry.id }), children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.ownerEmail })] }, entry.id)) : null, pickerTab === "npc" ? campaign.npcs.filter((entry) => entry.sheet && !linkedNpcIds.has(entry.id)).map((entry) => _jsxs("button", { disabled: busy, onClick: () => void addAndSort({ kind: "npc", campaignNpcId: entry.id }), children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.race || "PNJ de campaña" })] }, entry.id)) : null, pickerTab === "monster" ? _jsxs(_Fragment, { children: [_jsxs("div", { className: "campaign-combat-monster-filter", children: [_jsx("input", { "aria-label": "Buscar monstruos", value: monsterSearch, onChange: (event) => setMonsterSearch(event.target.value), placeholder: "Buscar nombre o familia\u2026" }), _jsxs("label", { children: [_jsx("span", { children: "Cantidad" }), _jsx("input", { type: "number", min: 1, max: 20, value: monsterQuantity, onChange: (event) => setMonsterQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1))) })] })] }), filteredMonsters.map(({ monster, sourceKind }) => _jsxs("button", { disabled: busy, onClick: () => void addAndSort({ kind: "monster", sourceKind, sourceId: monster.id, quantity: monsterQuantity }), children: [_jsx("strong", { children: monster.name }), _jsxs("span", { children: [sourceKind === "official" ? monster.source : "Mis monstruos", " \u00B7 ", monster.threat] })] }, `${sourceKind}-${monster.id}`))] }) : null] })] }) }) : null, selectedMonster && monsterFromSnapshot(selectedMonster) ? _jsx("div", { className: "modal-backdrop campaign-combat-sheet-backdrop", children: _jsx("section", { className: "monster-modal-panel", children: _jsx(MonsterReferenceSheet, { monster: monsterFromSnapshot(selectedMonster), official: selectedMonster.sourceKind === "official", backgroundPreferenceScope: "gm:combat", onClose: () => setSelectedMonster(null) }) }) }) : null, selectedNpcSheet ? _jsx("div", { className: "modal-backdrop campaign-combat-sheet-backdrop", children: _jsxs("section", { className: "campaign-character-sheet-modal", children: [_jsxs("header", { className: "campaign-character-sheet-modal-header", children: [_jsxs("div", { children: [_jsx("h3", { children: selectedNpcSheet.name }), _jsx("p", { children: "PNJ de campa\u00F1a" })] }), _jsx("button", { type: "button", onClick: () => setSelectedNpcSheet(null), children: "Cerrar" })] }), _jsx("div", { className: "campaign-character-sheet-modal-body", children: _jsx(UnifiedCharacterSheet, { title: selectedNpcSheet.name, subtitle: "PNJ de campa\u00F1a", sheet: selectedNpcSheet.sheet, editable: false, collapsibleHistory: true }) })] }) }) : null] }));
}
