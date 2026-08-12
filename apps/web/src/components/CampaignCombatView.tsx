import { useEffect, useMemo, useRef, useState } from "react";
import type { Campaign, CampaignCombat, CampaignCombatParticipantView, CharacterSheet, Monster } from "@umbra/shared";
import {
  addCampaignCombatParticipant,
  advanceCampaignCombatTurn,
  fetchCampaignCombat,
  finishCampaignCombat,
  removeCampaignCombatParticipant,
  reorderCampaignCombat,
  startCampaignCombat,
  updateCampaignCombatParticipant,
  updateCampaignCombatResources
} from "../services/campaignService";
import { fetchCustomMonsters, fetchMonsterCodex } from "../services/monsterService";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { MonsterReferenceSheet } from "./MonsterReferenceSheet";
import { UnifiedCharacterSheet } from "./UnifiedCharacterSheet";

type Props = {
  campaign: Campaign;
  ensureAccessToken: () => Promise<string>;
  onOpenCharacter: (campaignCharacterId: string) => void;
  onCampaignRefresh: () => Promise<void>;
};

type PickerTab = "character" | "npc" | "monster";

const MANUAL_CONDITIONS = [
  ["condition-burning", "Ardiendo"], ["condition-stunned", "Aturdido"], ["condition-blinded", "Cegado"],
  ["condition-prone", "Derribado"], ["condition-poisoned", "Envenenado"], ["condition-immobilized", "Inmovilizado"],
  ["condition-paralyzed", "Paralizado"], ["condition-bleeding", "Sangrando"]
] as const;

function participantTypeLabel(kind: CampaignCombatParticipantView["kind"]): string {
  return kind === "character" ? "PJ" : kind === "npc" ? "PNJ" : "Monstruo";
}

function monsterFromSnapshot(participant: CampaignCombatParticipantView): Monster | null {
  if (!participant.snapshot) return null;
  const snapshot = participant.snapshot;
  return {
    id: snapshot.id,
    name: snapshot.name,
    category: snapshot.category as Monster["category"],
    threat: snapshot.threat as Monster["threat"],
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

export function CampaignCombatView({ campaign, ensureAccessToken, onOpenCharacter, onCampaignRefresh }: Props) {
  const [combat, setCombat] = useState<CampaignCombat | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("character");
  const [monsterSearch, setMonsterSearch] = useState("");
  const [monsterQuantity, setMonsterQuantity] = useState(1);
  const [officialMonsters, setOfficialMonsters] = useState<Monster[]>([]);
  const [customMonsters, setCustomMonsters] = useState<Monster[]>([]);
  const [selectedMonster, setSelectedMonster] = useState<CampaignCombatParticipantView | null>(null);
  const [selectedNpcSheet, setSelectedNpcSheet] = useState<{ name: string; sheet: CharacterSheet } | null>(null);
  const draggedId = useRef<string | null>(null);
  useBodyScrollLock(pickerOpen || Boolean(selectedMonster) || Boolean(selectedNpcSheet));

  const loadCombat = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await ensureAccessToken();
      setCombat(await fetchCampaignCombat(campaign.id, token));
      if (!silent) setError(null);
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el combate");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void loadCombat(); }, [campaign.id]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden && !busy) void loadCombat(true); }, 5000);
    const onFocus = () => { if (!busy) void loadCombat(true); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [campaign.id, busy]);

  useEffect(() => {
    if (!pickerOpen || pickerTab !== "monster" || officialMonsters.length > 0) return;
    void (async () => {
      try {
        const token = await ensureAccessToken();
        const [official, custom] = await Promise.all([fetchMonsterCodex(token), fetchCustomMonsters(token)]);
        setOfficialMonsters(official);
        setCustomMonsters(custom);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el catálogo de monstruos");
      }
    })();
  }, [pickerOpen, pickerTab, officialMonsters.length]);

  const linkedCharacterIds = new Set(combat?.participants.filter((entry) => entry.kind === "character").map((entry) => entry.sourceId) ?? []);
  const linkedNpcIds = new Set(combat?.participants.filter((entry) => entry.kind === "npc").map((entry) => entry.sourceId) ?? []);
  const filteredMonsters = useMemo(() => {
    const query = monsterSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return [...officialMonsters.map((monster) => ({ monster, sourceKind: "official" as const })), ...customMonsters.map((monster) => ({ monster, sourceKind: "custom" as const }))]
      .filter(({ monster }) => !query || `${monster.name} ${monster.family ?? ""} ${monster.summary}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query));
  }, [customMonsters, monsterSearch, officialMonsters]);

  async function mutate(action: (token: string) => Promise<CampaignCombat>, refreshCampaign = false): Promise<CampaignCombat | null> {
    setBusy(true); setError(null);
    try {
      const token = await ensureAccessToken();
      const next = await action(token);
      setCombat(next);
      if (refreshCampaign) await onCampaignRefresh();
      return next;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "No se pudo guardar el combate");
      await loadCombat(true);
      return null;
    } finally { setBusy(false); }
  }

  async function addAndSort(input: Parameters<typeof addCampaignCombatParticipant>[1]): Promise<void> {
    const added = await mutate((token) => addCampaignCombatParticipant(campaign.id, input, token));
    if (!added || added.participants.length < 2) return;
    const participantIds = [...added.participants].sort((left, right) => right.initiative - left.initiative || left.alias.localeCompare(right.alias)).map((entry) => entry.id);
    await mutate((token) => reorderCampaignCombat(campaign.id, { revision: added.revision, participantIds }, token));
  }

  async function patchResources(participant: CampaignCombatParticipantView, patch: Parameters<typeof updateCampaignCombatResources>[2]): Promise<void> {
    const previous = combat;
    if (combat) setCombat({ ...combat, participants: combat.participants.map((entry) => entry.id === participant.id ? {
      ...entry,
      robustnessCurrent: patch.robustnessCurrent ?? entry.robustnessCurrent,
      temporaryCorruption: patch.temporaryCorruption ?? entry.temporaryCorruption,
      permanentCorruption: patch.permanentCorruption ?? entry.permanentCorruption,
      conditions: patch.conditions ?? entry.conditions
    } : entry) });
    const saved = await mutate((token) => updateCampaignCombatResources(campaign.id, participant.id, patch, token), participant.kind !== "monster");
    if (!saved && previous) setCombat(previous);
  }

  async function reorderByIds(ids: string[]): Promise<void> {
    if (!combat) return;
    await mutate((token) => reorderCampaignCombat(campaign.id, { revision: combat.revision, participantIds: ids }, token));
  }

  if (loading) return <section className="panel campaign-combat-empty"><p>Cargando combate…</p></section>;
  if (!combat) return (
    <section className="panel campaign-combat-empty">
      <h3>Combate</h3>
      <p className="section-help">Inicia un encuentro para reunir aquí el estado de PJ, PNJ y monstruos.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void mutate((token) => startCampaignCombat(campaign.id, token))}>Iniciar combate</button>
    </section>
  );

  return (
    <section className="campaign-combat" aria-label="Combate de campaña">
      <header className="panel campaign-combat-toolbar">
        <div><span className="campaign-combat-eyebrow">ENCUENTRO ACTIVO</span><h3>Ronda {combat.round}</h3><p>{combat.participants.find((entry) => entry.id === combat.activeParticipantId)?.alias ?? "Sin turno activo"}</p></div>
        <div className="campaign-combat-toolbar-actions">
          <button type="button" disabled={busy || combat.participants.length === 0} onClick={() => void mutate((token) => advanceCampaignCombatTurn(campaign.id, { revision: combat.revision, action: "previous" }, token))}>← Turno</button>
          <button type="button" disabled={busy || combat.participants.length === 0} onClick={() => void mutate((token) => advanceCampaignCombatTurn(campaign.id, { revision: combat.revision, action: "next" }, token))}>Turno →</button>
          <button type="button" onClick={() => setPickerOpen(true)}>Añadir participante</button>
          <button type="button" className="subtle-button" disabled={busy || combat.participants.length < 2} onClick={() => void reorderByIds([...combat.participants].sort((a, b) => b.initiative - a.initiative).map((entry) => entry.id))}>Ordenar iniciativa</button>
          <button type="button" className="subtle-button" disabled={busy} onClick={() => { if (window.confirm("¿Reiniciar el combate? Se eliminará el estado actual.")) void mutate((token) => startCampaignCombat(campaign.id, token)); }}>Reiniciar</button>
          <button type="button" className="danger-button" disabled={busy} onClick={() => { if (window.confirm("¿Finalizar el combate? Este estado no se archivará.")) void (async () => { setBusy(true); try { const token = await ensureAccessToken(); await finishCampaignCombat(campaign.id, token); setCombat(null); } catch (finishError) { setError(finishError instanceof Error ? finishError.message : "No se pudo finalizar"); } finally { setBusy(false); } })(); }}>Finalizar</button>
        </div>
      </header>
      {error ? <p className="error-text campaign-combat-error">{error}</p> : null}
      <div className="campaign-combat-list">
        {combat.participants.map((participant, index) => {
          const isActive = participant.id === combat.activeParticipantId;
          const automaticIds = new Set(["condition-dying", "legacy-dying", "legacy-corruption"]);
          return (
            <article key={participant.id} className={`campaign-combat-card${isActive ? " is-active" : ""}`} draggable={!busy}
              onDragStart={() => { draggedId.current = participant.id; }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { const sourceId = draggedId.current; if (!sourceId || sourceId === participant.id) return; const ids = combat.participants.map((entry) => entry.id); const from = ids.indexOf(sourceId); ids.splice(from, 1); ids.splice(index, 0, sourceId); draggedId.current = null; void reorderByIds(ids); }}>
              <header>
                <button className="campaign-combat-drag" type="button" aria-label={`Mover ${participant.alias}`}>⋮⋮</button>
                <div><span>{participantTypeLabel(participant.kind)}</span><strong>{participant.alias}</strong></div>
                <label><span>Iniciativa</span><input aria-label={`Iniciativa de ${participant.alias}`} type="number" value={participant.initiativeOverride ?? participant.initiative} onChange={(event) => void mutate((token) => updateCampaignCombatParticipant(campaign.id, participant.id, { revision: combat.revision, initiativeOverride: Number(event.target.value) }, token))} /></label>
                <button type="button" className={isActive ? "is-current-turn" : "subtle-button"} disabled={busy} onClick={() => void mutate((token) => advanceCampaignCombatTurn(campaign.id, { revision: combat.revision, action: "select", participantId: participant.id }, token))}>{isActive ? "Turno actual" : "Dar turno"}</button>
              </header>
              <div className="campaign-combat-stats">
                <div className="campaign-combat-resource"><span>Robustez</span><strong>{participant.robustnessCurrent} / {participant.robustnessMaximum}</strong><div><button aria-label={`Restar Robustez a ${participant.alias}`} disabled={busy || participant.robustnessCurrent <= 0} onClick={() => void patchResources(participant, { robustnessCurrent: participant.robustnessCurrent - 1 })}>−</button><button aria-label={`Sumar Robustez a ${participant.alias}`} disabled={busy || participant.robustnessCurrent >= participant.robustnessMaximum} onClick={() => void patchResources(participant, { robustnessCurrent: participant.robustnessCurrent + 1 })}>+</button></div></div>
                <div><span>Defensa</span><strong>{participant.defense}</strong></div><div><span>Armadura</span><strong>{participant.armor || "—"}</strong></div><div><span>Umbral de dolor</span><strong>{participant.painThreshold}</strong></div>
                <div className="campaign-combat-resource"><span>Corrupción temporal</span><strong>{participant.temporaryCorruption}</strong><div><button disabled={busy || participant.temporaryCorruption <= 0} onClick={() => void patchResources(participant, { temporaryCorruption: Math.max(0, participant.temporaryCorruption - 1) })}>−</button><button disabled={busy} onClick={() => void patchResources(participant, { temporaryCorruption: participant.temporaryCorruption + 1 })}>+</button></div></div>
                <div className="campaign-combat-resource"><span>Corrupción permanente</span><strong>{participant.permanentCorruption}</strong><div><button disabled={busy || participant.permanentCorruption <= 0} onClick={() => void patchResources(participant, { permanentCorruption: Math.max(0, participant.permanentCorruption - 1) })}>−</button><button disabled={busy} onClick={() => void patchResources(participant, { permanentCorruption: participant.permanentCorruption + 1 })}>+</button></div></div><div><span>Umbral de corrupción</span><strong>{participant.corruptionThreshold}</strong></div>
              </div>
              <div className="campaign-combat-card-details">
                <section><h4>Ataques</h4>{participant.attacks.length ? participant.attacks.map((attack, attackIndex) => <div className="campaign-combat-attack" key={`${attack.name}-${attackIndex}`}><strong>{attack.name}</strong><span>{attack.attribute} · {attack.damage}{attack.qualities ? ` · ${attack.qualities}` : ""}</span></div>) : <span>Sin ataques registrados.</span>}</section>
                <section><h4>Condiciones</h4><div className="campaign-combat-conditions">{MANUAL_CONDITIONS.map(([id, name]) => { const active = participant.conditions.some((condition) => condition.id === id && condition.active); return <button type="button" key={id} aria-pressed={active} className={active ? "is-active" : ""} disabled={busy} onClick={() => { const preserved = participant.conditions.filter((condition) => condition.id !== id); if (!active) preserved.push({ id, name, category: "state", active: true, severity: "minor", summary: "", notes: "" }); void patchResources(participant, { conditions: preserved }); }}>{name}</button>; })}{participant.conditions.filter((condition) => automaticIds.has(condition.id)).map((condition) => <span className="is-automatic" key={condition.id}>{condition.name}</span>)}</div></section>
              </div>
              <footer>
                <button type="button" className="subtle-button" disabled={busy} onClick={() => { const alias = window.prompt("Nombre mostrado en combate", participant.alias)?.trim(); if (alias && alias !== participant.alias) void mutate((token) => updateCampaignCombatParticipant(campaign.id, participant.id, { revision: combat.revision, alias }, token)); }}>Renombrar</button>
                <button type="button" className="subtle-button" onClick={() => { if (participant.kind === "character") onOpenCharacter(participant.sourceId); else if (participant.kind === "npc") { const npc = campaign.npcs.find((entry) => entry.id === participant.sourceId); if (npc?.sheet) setSelectedNpcSheet({ name: npc.name, sheet: npc.sheet }); } else setSelectedMonster(participant); }}>Ver ficha completa</button>
                <button type="button" className="danger-button" disabled={busy} onClick={() => void mutate((token) => removeCampaignCombatParticipant(campaign.id, participant.id, token))}>Retirar</button>
              </footer>
            </article>
          );
        })}
        {combat.participants.length === 0 ? <div className="panel campaign-combat-empty"><p>Añade PJ, PNJ o monstruos para comenzar el orden de iniciativa.</p></div> : null}
      </div>

      {pickerOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerOpen(false); }}><section className="modal-panel campaign-combat-picker" role="dialog" aria-modal="true" aria-labelledby="combat-picker-title"><header><div><h3 id="combat-picker-title">Añadir al combate</h3><p className="section-help">Los monstruos se copian como instancias independientes.</p></div><button type="button" className="subtle-button" onClick={() => setPickerOpen(false)}>Cerrar</button></header><nav aria-label="Tipos de participante"><button className={pickerTab === "character" ? "is-active" : ""} onClick={() => setPickerTab("character")}>PJ</button><button className={pickerTab === "npc" ? "is-active" : ""} onClick={() => setPickerTab("npc")}>PNJ</button><button className={pickerTab === "monster" ? "is-active" : ""} onClick={() => setPickerTab("monster")}>Monstruos</button></nav><div className="campaign-combat-picker-list">
        {pickerTab === "character" ? campaign.characters.filter((entry) => entry.sheet && !linkedCharacterIds.has(entry.id)).map((entry) => <button key={entry.id} disabled={busy} onClick={() => void addAndSort({ kind: "character", campaignCharacterId: entry.id })}><strong>{entry.name}</strong><span>{entry.ownerEmail}</span></button>) : null}
        {pickerTab === "npc" ? campaign.npcs.filter((entry) => entry.sheet && !linkedNpcIds.has(entry.id)).map((entry) => <button key={entry.id} disabled={busy} onClick={() => void addAndSort({ kind: "npc", campaignNpcId: entry.id })}><strong>{entry.name}</strong><span>{entry.race || "PNJ de campaña"}</span></button>) : null}
        {pickerTab === "monster" ? <><div className="campaign-combat-monster-filter"><input aria-label="Buscar monstruos" value={monsterSearch} onChange={(event) => setMonsterSearch(event.target.value)} placeholder="Buscar nombre o familia…"/><label><span>Cantidad</span><input type="number" min={1} max={20} value={monsterQuantity} onChange={(event) => setMonsterQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label></div>{filteredMonsters.map(({ monster, sourceKind }) => <button key={`${sourceKind}-${monster.id}`} disabled={busy} onClick={() => void addAndSort({ kind: "monster", sourceKind, sourceId: monster.id, quantity: monsterQuantity })}><strong>{monster.name}</strong><span>{sourceKind === "official" ? monster.source : "Mis monstruos"} · {monster.threat}</span></button>)}</> : null}
      </div></section></div> : null}

      {selectedMonster && monsterFromSnapshot(selectedMonster) ? <div className="modal-backdrop campaign-combat-sheet-backdrop"><section className="monster-modal-panel"><MonsterReferenceSheet monster={monsterFromSnapshot(selectedMonster)!} official={selectedMonster.sourceKind === "official"} backgroundPreferenceScope="gm:combat" onClose={() => setSelectedMonster(null)} /></section></div> : null}
      {selectedNpcSheet ? <div className="modal-backdrop campaign-combat-sheet-backdrop"><section className="campaign-character-sheet-modal"><header className="campaign-character-sheet-modal-header"><div><h3>{selectedNpcSheet.name}</h3><p>PNJ de campaña</p></div><button type="button" onClick={() => setSelectedNpcSheet(null)}>Cerrar</button></header><div className="campaign-character-sheet-modal-body"><UnifiedCharacterSheet title={selectedNpcSheet.name} subtitle="PNJ de campaña" sheet={selectedNpcSheet.sheet} editable={false} collapsibleHistory /></div></section></div> : null}
    </section>
  );
}
