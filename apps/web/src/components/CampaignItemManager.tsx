import { useMemo, useState } from "react";
import type { Campaign, CampaignItemDefinition, CampaignItemTemplate } from "@umbra/shared";
import {
  archiveCampaignItem,
  assignCampaignItemOwner,
  createCampaignItem,
  restoreCampaignItem,
  updateCampaignItem
} from "../services/campaignItemService";

type Kind = "weapon" | "armor" | "item";
type Props = {
  campaign: Campaign;
  kind: Kind;
  ensureAccessToken: () => Promise<string>;
  onRefresh: () => Promise<void>;
};

type EditorState = {
  itemId?: string;
  definition: CampaignItemDefinition;
  isUnique: boolean;
  ownerValue: string;
};

function emptyDefinition(kind: Kind): CampaignItemDefinition {
  return {
    name: kind === "weapon" ? "Nueva arma" : kind === "armor" ? "Nueva armadura" : "Nuevo objeto",
    category: kind === "weapon" ? "weapon" : kind === "armor" ? "armor" : "gear",
    stackable: false,
    description: "",
    weight: "",
    value: "",
    defaultQuantity: 1,
    defaultSlot: kind === "weapon" ? "mainHand" : kind === "armor" ? "armor" : "none",
    attackAttribute: kind === "weapon" ? "diestro" : undefined,
    damageFormula: "",
    protectionFormula: kind === "armor" ? "1d4" : "",
    qualities: kind === "armor" ? "Ligera" : "",
    notes: "",
    grantedActions: [],
    modifiers: []
  };
}

function ownerValue(item: CampaignItemTemplate): string {
  return item.ownerType && item.ownerId ? `${item.ownerType}:${item.ownerId}` : "";
}

function parseOwner(value: string): { ownerType?: "character" | "npc"; ownerId?: string } {
  if (!value) return {};
  const [ownerType, ownerId] = value.split(":") as ["character" | "npc", string];
  return { ownerType, ownerId };
}

export function CampaignItemManager({ campaign, kind, ensureAccessToken, onRefresh }: Props) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = useMemo(() => (campaign.campaignItems ?? [])
    .filter((item) => item.kind === kind && (showArchived || !item.archivedAt))
    .filter((item) => !query.trim() || `${item.definition.name} ${item.definition.description} ${item.definition.qualities}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))),
  [campaign.campaignItems, kind, query, showArchived]);

  async function mutate(action: (token: string) => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action(await ensureAccessToken());
      await onRefresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el objeto de campaña.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEditor(): Promise<void> {
    if (!editor) return;
    const owner = parseOwner(editor.ownerValue);
    const saved = await mutate((token) => editor.itemId
      ? updateCampaignItem(editor.itemId, { definition: editor.definition, isUnique: editor.isUnique, ...owner }, token)
      : createCampaignItem(campaign.id, { definition: editor.definition, isUnique: editor.isUnique, ...owner }, token));
    if (saved) setEditor(null);
  }

  async function changeOwner(item: CampaignItemTemplate, value: string): Promise<void> {
    const owner = parseOwner(value);
    await mutate((token) => assignCampaignItemOwner(item.id, {
      ownerType: owner.ownerType ?? null,
      ownerId: owner.ownerId ?? null
    }, token));
  }

  const label = kind === "weapon" ? "arma" : kind === "armor" ? "armadura" : "objeto";
  return (
    <div className="campaign-item-manager">
      <div className="row-actions">
        <div className="inline-row campaign-inline-form">
          <label className="field"><span>Buscar</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar ${label}...`} /></label>
          <label className="campaign-item-archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Mostrar archivados</label>
        </div>
        <button type="button" disabled={busy} onClick={() => setEditor({ definition: emptyDefinition(kind), isUnique: false, ownerValue: "" })}>Crear {label}</button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="cards campaign-item-template-grid">
        {items.map((item) => (
          <article key={item.id} className={`card campaign-item-template-card${item.archivedAt ? " is-archived" : ""}`}>
            <div className="row-actions">
              <div><strong>{item.definition.name}</strong><span>{item.definition.category === "artifact" ? "Artefacto menor" : kind === "weapon" ? "Arma" : kind === "armor" ? "Armadura" : "Objeto"}</span></div>
              <div className="toolbar">{item.isUnique ? <span className="campaign-item-unique-badge">Pieza única</span> : <span className="compendium-chip">Reutilizable</span>}{item.archivedAt ? <span className="compendium-chip">Archivado</span> : null}</div>
            </div>
            {item.definition.description ? <p>{item.definition.description}</p> : null}
            {item.definition.qualities ? <span>Cualidades: {item.definition.qualities}</span> : null}
            {item.isUnique ? (
              <label className="field"><span>Poseedor</span><select value={ownerValue(item)} disabled={busy || Boolean(item.archivedAt)} onChange={(event) => void changeOwner(item, event.target.value)}>
                <option value="">Sin poseedor</option>
                {campaign.characters.map((character) => <option key={character.id} value={`character:${character.id}`}>PJ · {character.name}</option>)}
                {campaign.npcs.map((npc) => <option key={npc.id} value={`npc:${npc.id}`}>PNJ · {npc.name}</option>)}
              </select></label>
            ) : null}
            <div className="card-actions">
              <button type="button" disabled={busy} onClick={() => setEditor({ itemId: item.id, definition: { ...item.definition }, isUnique: item.isUnique, ownerValue: ownerValue(item) })}>Editar</button>
              {item.archivedAt
                ? <button type="button" disabled={busy} onClick={() => void mutate((token) => restoreCampaignItem(item.id, token))}>Restaurar</button>
                : <button type="button" className="danger" disabled={busy} onClick={() => void mutate((token) => archiveCampaignItem(item.id, token))}>Archivar</button>}
            </div>
          </article>
        ))}
        {items.length === 0 ? <p className="section-help">No hay {label}s de campaña en esta sección.</p> : null}
      </div>

      {editor ? (
        <div className="modal-backdrop" onClick={() => !busy && setEditor(null)}>
          <section className="panel modal-panel campaign-item-editor-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions"><div><h3>{editor.itemId ? `Editar ${label}` : `Crear ${label}`}</h3><p className="section-help">La definición se compartirá con todos los inventarios de la campaña.</p></div><button type="button" className="subtle-button" onClick={() => setEditor(null)}>Cerrar</button></div>
            <div className="form-grid">
              <label className="field"><span>Nombre</span><input value={editor.definition.name} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, name: event.target.value } })} /></label>
              {kind === "item" ? <label className="field"><span>Categoría</span><select value={editor.definition.category} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, category: event.target.value as CampaignItemDefinition["category"] } })}><option value="gear">Equipo</option><option value="consumable">Consumible</option><option value="artifact">Artefacto menor</option><option value="treasure">Tesoro</option><option value="other">Otro</option></select></label> : null}
              {kind === "weapon" ? <label className="field"><span>Daño</span><input value={editor.definition.damageFormula} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, damageFormula: event.target.value } })} /></label> : null}
              {kind === "armor" ? <label className="field"><span>Protección</span><input value={editor.definition.protectionFormula} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, protectionFormula: event.target.value } })} /></label> : null}
              <label className="field"><span>Valor</span><input value={editor.definition.value} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, value: event.target.value } })} /></label>
              <label className="field"><span>Peso</span><input value={editor.definition.weight} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, weight: event.target.value } })} /></label>
              <label className="field"><span>Cantidad predeterminada</span><input type="number" min={1} disabled={editor.isUnique} value={editor.isUnique ? 1 : editor.definition.defaultQuantity} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, defaultQuantity: Math.max(1, Number(event.target.value || 1)) } })} /></label>
              <label className="field"><span>Apilable</span><select disabled={editor.isUnique} value={editor.isUnique ? "no" : editor.definition.stackable ? "si" : "no"} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, stackable: event.target.value === "si" } })}><option value="no">No</option><option value="si">Sí</option></select></label>
            </div>
            <label className="campaign-item-unique-toggle"><input type="checkbox" checked={editor.isUnique} onChange={(event) => setEditor({ ...editor, isUnique: event.target.checked, definition: event.target.checked ? { ...editor.definition, stackable: false, defaultQuantity: 1 } : editor.definition })} /><span><strong>Poseedor único</strong><small>Solo puede existir en el inventario de un PJ o PNJ de la campaña.</small></span></label>
            {editor.isUnique ? <label className="field"><span>Poseedor inicial</span><select value={editor.ownerValue} onChange={(event) => setEditor({ ...editor, ownerValue: event.target.value })}><option value="">Sin poseedor</option>{campaign.characters.map((character) => <option key={character.id} value={`character:${character.id}`}>PJ · {character.name}</option>)}{campaign.npcs.map((npc) => <option key={npc.id} value={`npc:${npc.id}`}>PNJ · {npc.name}</option>)}</select></label> : null}
            <label className="field"><span>Cualidades</span><input value={editor.definition.qualities} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, qualities: event.target.value } })} placeholder="Separadas por comas" /></label>
            <label className="field"><span>Descripción</span><textarea rows={3} value={editor.definition.description} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, description: event.target.value } })} /></label>
            <label className="field"><span>Notas</span><textarea rows={3} value={editor.definition.notes} onChange={(event) => setEditor({ ...editor, definition: { ...editor.definition, notes: event.target.value } })} /></label>
            {error ? <p className="error-text">{error}</p> : null}
            <div className="row-actions"><button type="button" className="subtle-button" onClick={() => setEditor(null)}>Cancelar</button><button type="button" disabled={busy || editor.definition.name.trim().length < 2} onClick={() => void saveEditor()}>Guardar</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
