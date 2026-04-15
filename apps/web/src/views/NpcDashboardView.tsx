import { useMemo, useState } from "react";
import {
  MONSTER_ATTRIBUTE_KEYS,
  MONSTER_ATTRIBUTE_LABELS,
  createDefaultMonsterSheet,
  createNpcSheetSeed,
  parseCharacterSheet,
  synchronizeCharacterSheet,
  type Character,
  type CharacterSheet,
  type Npc,
  type NpcDepth
} from "@umbra/shared";
import { CharacterBuilderView } from "./CharacterBuilderView";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
import { useNpcController } from "../controllers/npcController";
import { updateNpc as persistNpcUpdate } from "../services/npcService";

type Props = {
  ensureAccessToken: () => Promise<string>;
};

type NpcPageMode = "list" | "detail" | "sheet" | "builder";
type DepthFilter = "all" | NpcDepth;

const DEPTH_LABELS: Record<NpcDepth, string> = {
  notes: "Solo notas",
  stat_block: "Bloque rapido",
  full_sheet: "Hoja completa"
};

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildNpcCharacterRecord(npc: Npc): Character {
  const sheet = npc.sheet
    ? synchronizeCharacterSheet(npc.sheet)
    : createNpcSheetSeed({
        name: npc.name,
        race: npc.race,
        archetype: npc.archetype,
        occupation: npc.occupation,
        summary: npc.summary,
        notes: npc.notes
      });

  return {
    id: npc.id,
    name: npc.name,
    archetype: npc.archetype || "Guerrero",
    race: npc.race || "Humano",
    culture: "",
    profession: npc.occupation || "",
    level: 1,
    sheet,
    createdAt: npc.createdAt,
    updatedAt: npc.updatedAt
  };
}

function renderNpcStatBlock(npc: Pick<Npc, "name" | "summary" | "statBlock" | "faction" | "labels">) {
  const statBlock = npc.statBlock ?? createDefaultMonsterSheet();

  return (
    <div className="monster-statblock npc-statblock">
      <div className="monster-statblock-header">
        <div>
          <h3>{npc.name}</h3>
          <p>{npc.summary || "Sin resumen breve."}</p>
        </div>
        <div className="monster-statblock-meta">
          <span className="compendium-chip">{npc.faction || "Sin faccion"}</span>
          {npc.labels.map((label) => (
            <span key={`${npc.name}-${label}`} className="compendium-chip">{label}</span>
          ))}
        </div>
      </div>

      <div className="monster-stat-grid">
        <div className="info-box"><strong>Ataque:</strong>&nbsp;{statBlock.attack}</div>
        <div className="info-box"><strong>Daño:</strong>&nbsp;{statBlock.damage}</div>
        <div className="info-box"><strong>Defensa:</strong>&nbsp;{statBlock.defense}</div>
        <div className="info-box"><strong>Armadura:</strong>&nbsp;{statBlock.armor}</div>
        <div className="info-box"><strong>Robustez:</strong>&nbsp;{statBlock.toughness}</div>
        <div className="info-box"><strong>Umbral:</strong>&nbsp;{statBlock.painThreshold}</div>
        <div className="info-box"><strong>Movimiento:</strong>&nbsp;{statBlock.movement}</div>
      </div>

      <div className="monster-attribute-table table-wrap">
        <table>
          <thead>
            <tr>
              {MONSTER_ATTRIBUTE_KEYS.map((attribute) => (
                <th key={attribute}>{MONSTER_ATTRIBUTE_LABELS[attribute]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {MONSTER_ATTRIBUTE_KEYS.map((attribute) => (
                <td key={attribute}>{statBlock.attributes[attribute]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="monster-detail-grid">
        <article className="entry-row">
          <strong>Rasgos</strong>
          <ul className="tag-list">
            {statBlock.traits.length > 0 ? statBlock.traits.map((trait) => <li key={trait}>{trait}</li>) : <li>Sin rasgos.</li>}
          </ul>
        </article>
        <article className="entry-row">
          <strong>Acciones</strong>
          <ul className="tag-list">
            {statBlock.actions.length > 0 ? statBlock.actions.map((action) => <li key={action}>{action}</li>) : <li>Sin acciones.</li>}
          </ul>
        </article>
        <article className="entry-row">
          <strong>Tactica</strong>
          <p>{statBlock.tactics || "Sin tactica definida."}</p>
        </article>
        <article className="entry-row">
          <strong>Debilidad</strong>
          <p>{statBlock.weakness || "Sin debilidad definida."}</p>
        </article>
      </div>
    </div>
  );
}

type NpcEditorModalProps = {
  controller: ReturnType<typeof useNpcController>;
  onClose: () => void;
};

function NpcEditorModal({ controller, onClose }: NpcEditorModalProps) {
  const draft = controller.draft;

  async function handleSave(): Promise<void> {
    const saved = await controller.saveDraft();
    if (saved) {
      onClose();
    }
  }

  return (
    <section className="modal-backdrop" onClick={onClose}>
      <div className="panel modal-panel monster-modal-panel npc-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="row-actions">
          <div>
            <h2>{controller.selectedNpcId ? "Editar PNJ" : "Crear PNJ"}</h2>
            <p className="section-help">Tres profundidades: notas, bloque rapido o hoja completa con constructor.</p>
          </div>
          <div className="toolbar">
            <button type="button" disabled={controller.isSaving} onClick={() => void handleSave()}>
              {controller.isSaving ? "Guardando..." : "Guardar PNJ"}
            </button>
            <button type="button" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        {controller.error ? <p className="error">{controller.error}</p> : null}

        <div className="monster-editor-layout">
          <section className="monster-builder-card">
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={draft.name} onChange={(event) => controller.updateField("name", event.target.value)} />
              </label>
              <label className="field">
                <span>Profundidad</span>
                <select value={draft.depth} onChange={(event) => controller.updateDepth(event.target.value as NpcDepth)}>
                  <option value="notes">Solo notas</option>
                  <option value="stat_block">Bloque rapido</option>
                  <option value="full_sheet">Hoja completa</option>
                </select>
              </label>
              <label className="field">
                <span>Raza</span>
                <input value={draft.race} onChange={(event) => controller.updateField("race", event.target.value)} />
              </label>
              <label className="field">
                <span>Arquetipo</span>
                <input value={draft.archetype} onChange={(event) => controller.updateField("archetype", event.target.value)} />
              </label>
              <label className="field">
                <span>Ocupacion</span>
                <input value={draft.occupation} onChange={(event) => controller.updateField("occupation", event.target.value)} />
              </label>
              <label className="field">
                <span>Faccion</span>
                <input value={draft.faction} onChange={(event) => controller.updateField("faction", event.target.value)} />
              </label>
              <label className="field field-span-2">
                <span>Etiquetas</span>
                <input
                  value={draft.labels.join(", ")}
                  placeholder="mercader, ordo magica, informante"
                  onChange={(event) => controller.updateLabels(event.target.value)}
                />
              </label>
              <label className="field field-span-2">
                <span>Resumen</span>
                <input value={draft.summary} onChange={(event) => controller.updateField("summary", event.target.value)} />
              </label>
              <label className="field field-span-2">
                <span>Notas</span>
                <textarea rows={6} value={draft.notes} onChange={(event) => controller.updateField("notes", event.target.value)} />
              </label>
            </div>

            {draft.depth !== "notes" ? (
              <>
                <div className="section-title">Bloque rapido</div>
                <div className="form-grid">
                  <label className="field"><span>Ataque</span><input value={draft.statBlock?.attack ?? ""} onChange={(event) => controller.updateStatBlockField("attack", event.target.value)} /></label>
                  <label className="field"><span>Daño</span><input value={draft.statBlock?.damage ?? ""} onChange={(event) => controller.updateStatBlockField("damage", event.target.value)} /></label>
                  <label className="field"><span>Defensa</span><input value={draft.statBlock?.defense ?? ""} onChange={(event) => controller.updateStatBlockField("defense", event.target.value)} /></label>
                  <label className="field"><span>Armadura</span><input value={draft.statBlock?.armor ?? ""} onChange={(event) => controller.updateStatBlockField("armor", event.target.value)} /></label>
                  <label className="field"><span>Robustez</span><input value={draft.statBlock?.toughness ?? ""} onChange={(event) => controller.updateStatBlockField("toughness", event.target.value)} /></label>
                  <label className="field"><span>Umbral</span><input value={draft.statBlock?.painThreshold ?? ""} onChange={(event) => controller.updateStatBlockField("painThreshold", event.target.value)} /></label>
                  <label className="field"><span>Movimiento</span><input value={draft.statBlock?.movement ?? ""} onChange={(event) => controller.updateStatBlockField("movement", event.target.value)} /></label>
                </div>
                <div className="attributes-grid">
                  {MONSTER_ATTRIBUTE_KEYS.map((attribute) => (
                    <label key={attribute} className="attribute-box">
                      <span>{MONSTER_ATTRIBUTE_LABELS[attribute]}</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={draft.statBlock?.attributes[attribute] ?? 10}
                        onChange={(event) => controller.updateStatBlockAttribute(attribute, Number(event.target.value || 0))}
                      />
                    </label>
                  ))}
                </div>
                <div className="form-grid">
                  <label className="field field-span-2">
                    <span>Rasgos</span>
                    <textarea
                      rows={3}
                      value={(draft.statBlock?.traits ?? []).join("\n")}
                      onChange={(event) => controller.updateStatBlockField("traits", event.target.value.split("\n").map((entry) => entry.trim()).filter(Boolean))}
                    />
                  </label>
                  <label className="field field-span-2">
                    <span>Acciones</span>
                    <textarea
                      rows={3}
                      value={(draft.statBlock?.actions ?? []).join("\n")}
                      onChange={(event) => controller.updateStatBlockField("actions", event.target.value.split("\n").map((entry) => entry.trim()).filter(Boolean))}
                    />
                  </label>
                  <label className="field">
                    <span>Tactica</span>
                    <textarea rows={3} value={draft.statBlock?.tactics ?? ""} onChange={(event) => controller.updateStatBlockField("tactics", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Debilidad</span>
                    <textarea rows={3} value={draft.statBlock?.weakness ?? ""} onChange={(event) => controller.updateStatBlockField("weakness", event.target.value)} />
                  </label>
                </div>
              </>
            ) : null}
          </section>

          <section className="monster-builder-card">
            <h3>Vista previa</h3>
            {draft.depth === "notes" ? (
              <article className="campaign-sheet-card npc-notes-preview">
                <div className="row-actions">
                  <strong>{draft.name || "PNJ sin nombre"}</strong>
                  <span className="compendium-chip">{DEPTH_LABELS[draft.depth]}</span>
                </div>
                <p className="meta-text">{draft.faction || "Sin faccion"}</p>
                <p>{draft.summary || "Añade un resumen para definir el rol narrativo del PNJ."}</p>
                <p className="section-help">{draft.notes || "Las notas largas del PNJ apareceran aqui."}</p>
              </article>
            ) : (
              renderNpcStatBlock({
                name: draft.name || "PNJ sin nombre",
                summary: draft.summary,
                statBlock: draft.statBlock ?? createDefaultMonsterSheet(),
                faction: draft.faction,
                labels: draft.labels
              })
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

export function NpcDashboardView({ ensureAccessToken }: Props) {
  const controller = useNpcController(ensureAccessToken);
  const [search, setSearch] = useState("");
  const [depthFilter, setDepthFilter] = useState<DepthFilter>("all");
  const [factionFilter, setFactionFilter] = useState("all");
  const [pageMode, setPageMode] = useState<NpcPageMode>("list");
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const factions = useMemo(
    () => ["all", ...new Set(controller.npcs.map((npc) => npc.faction.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "es")))],
    [controller.npcs]
  );

  const visibleNpcs = useMemo(() => {
    const query = normalizeSearchValue(search);
    return controller.npcs.filter((npc) => {
      if (depthFilter !== "all" && npc.depth !== depthFilter) {
        return false;
      }
      if (factionFilter !== "all" && npc.faction !== factionFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = normalizeSearchValue([
        npc.name,
        npc.race,
        npc.archetype,
        npc.occupation,
        npc.faction,
        npc.summary,
        npc.notes,
        ...npc.labels
      ].join(" "));
      return haystack.includes(query);
    });
  }, [controller.npcs, depthFilter, factionFilter, search]);

  const groupedNpcs = useMemo(() => {
    const groups = new Map<string, Npc[]>();
    for (const npc of visibleNpcs) {
      const key = npc.faction.trim() || "Sin faccion";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(npc);
    }
    return [...groups.entries()];
  }, [visibleNpcs]);

  const selectedNpc = controller.selectedNpc;
  const selectedNpcCharacter = selectedNpc && selectedNpc.depth === "full_sheet" ? buildNpcCharacterRecord(selectedNpc) : null;

  async function saveNpcSheet(nextSheet: CharacterSheet): Promise<void> {
    if (!selectedNpc) {
      return;
    }
    const token = await ensureAccessToken();
    const updated = await persistNpcUpdate(
      selectedNpc.id,
      {
        depth: "full_sheet",
        name: nextSheet.identidad.nombrePersonaje.trim() || selectedNpc.name,
        race: String(nextSheet.identidad.raza),
        archetype: String(nextSheet.identidad.arquetipo),
        occupation: nextSheet.identidad.profesion,
        faction: selectedNpc.faction,
        labels: selectedNpc.labels,
        summary: nextSheet.identidad.apariencia || selectedNpc.summary,
        notes: nextSheet.identidad.trasfondo || selectedNpc.notes,
        statBlock: selectedNpc.statBlock,
        sheet: synchronizeCharacterSheet(nextSheet)
      },
      token
    );
    controller.selectNpc(updated.id);
    controller.loadDraftFromNpc(updated);
    await controller.refresh();
  }

  function openCreateModal(depth: NpcDepth = "notes"): void {
    controller.selectNpc(null);
    controller.resetDraft(depth);
    setIsEditorOpen(true);
  }

  function openEditModal(npc: Npc): void {
    controller.selectNpc(npc.id);
    controller.loadDraftFromNpc(npc);
    setIsEditorOpen(true);
  }

  if (pageMode === "builder" && selectedNpcCharacter) {
    return (
      <CharacterBuilderView
        character={selectedNpcCharacter}
        onBackToCharacters={() => setPageMode("sheet")}
        onOpenSheet={() => setPageMode("sheet")}
        onSave={saveNpcSheet}
        backLabel="Volver a PNJ"
        sheetLabel="Abrir hoja PNJ"
        saveLabel="Guardar constructor PNJ"
      />
    );
  }

  if (pageMode === "sheet" && selectedNpcCharacter) {
    return (
      <section className="campaign-sheet-shell">
        <UnifiedCharacterSheet
          title={selectedNpcCharacter.name}
          subtitle={`${selectedNpcCharacter.archetype || "Sin arquetipo"} · ${selectedNpcCharacter.race || "Sin raza"} · PNJ`}
          sheet={parseCharacterSheet(selectedNpcCharacter.sheet)}
          editable
          onOpenBuilder={() => setPageMode("builder")}
          onSave={saveNpcSheet}
        />
      </section>
    );
  }

  if (pageMode === "detail" && selectedNpc) {
    return (
      <div className="monster-module npc-module">
        <section className="panel monster-section">
          <div className="row-actions">
            <div>
              <button type="button" className="subtle-button" onClick={() => setPageMode("list")}>Volver al archivo</button>
              <h2>{selectedNpc.name}</h2>
              <p className="section-help">{DEPTH_LABELS[selectedNpc.depth]} · {selectedNpc.faction || "Sin faccion"}</p>
            </div>
            <div className="toolbar">
              {selectedNpc.depth === "full_sheet" ? (
                <>
                  <button type="button" className="subtle-button" onClick={() => setPageMode("sheet")}>Abrir hoja</button>
                  <button type="button" onClick={() => setPageMode("builder")}>Abrir constructor</button>
                </>
              ) : null}
              <button type="button" onClick={() => openEditModal(selectedNpc)}>Editar</button>
              <button type="button" className="danger" onClick={() => void controller.removeNpc(selectedNpc.id)}>Eliminar</button>
            </div>
          </div>

          <div className="compendium-tags">
            <span className="compendium-chip">{DEPTH_LABELS[selectedNpc.depth]}</span>
            <span className="compendium-chip">{selectedNpc.faction || "Sin faccion"}</span>
            {selectedNpc.labels.map((label) => <span key={`${selectedNpc.id}-${label}`} className="compendium-chip">{label}</span>)}
          </div>

          <article className="campaign-sheet-card npc-detail-notes">
            <h3>Notas</h3>
            <p className="meta-text">{selectedNpc.summary || "Sin resumen breve."}</p>
            <p>{selectedNpc.notes || "Sin notas ampliadas."}</p>
          </article>

          {selectedNpc.depth !== "notes" ? renderNpcStatBlock(selectedNpc) : null}
        </section>

        {isEditorOpen ? <NpcEditorModal controller={controller} onClose={() => setIsEditorOpen(false)} /> : null}
      </div>
    );
  }

  return (
    <div className="monster-module npc-module">
      <section className="panel lore-panel">
        <h2>Archivo de PNJ</h2>
        <p>PNJ narrativos, PNJ con bloque rapido y PNJ con hoja completa, separados de los monstruos del Director de Juego.</p>
        <div className="monster-guidance-grid">
          <div className="info-box">Solo notas: ideal para contactos, mercaderes, nobles y PNJ sociales.</div>
          <div className="info-box">Bloque rapido: añade estadisticas y rasgos de mesa sin cargar una hoja completa.</div>
          <div className="info-box">Hoja completa: usa la misma hoja y constructor que un PJ, con inventario y acciones.</div>
        </div>
      </section>

      <section className="panel monster-section">
        <div className="row-actions">
          <div>
            <h2>PNJ del Director</h2>
            <p className="section-help">Agrupados por faccion y filtrables por profundidad, etiquetas y nombre.</p>
          </div>
          <div className="toolbar">
            <button type="button" onClick={() => openCreateModal("notes")}>Nuevo PNJ</button>
            <button type="button" className="subtle-button" onClick={() => openCreateModal("stat_block")}>Nuevo bloque rapido</button>
            <button type="button" className="subtle-button" onClick={() => openCreateModal("full_sheet")}>Nueva hoja completa</button>
          </div>
        </div>

        {controller.error ? <p className="error">{controller.error}</p> : null}

        <div className="compendium-filters">
          <label className="field compendium-search">
            <span>Buscar</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, faccion, etiqueta..." />
          </label>
          <label className="field">
            <span>Profundidad</span>
            <select value={depthFilter} onChange={(event) => setDepthFilter(event.target.value as DepthFilter)}>
              <option value="all">Todas</option>
              <option value="notes">Solo notas</option>
              <option value="stat_block">Bloque rapido</option>
              <option value="full_sheet">Hoja completa</option>
            </select>
          </label>
          <label className="field">
            <span>Faccion</span>
            <select value={factionFilter} onChange={(event) => setFactionFilter(event.target.value)}>
              {factions.map((faction) => <option key={faction} value={faction}>{faction === "all" ? "Todas" : faction}</option>)}
            </select>
          </label>
        </div>

        <div className="npc-faction-stack">
          {groupedNpcs.length > 0 ? groupedNpcs.map(([faction, npcs]) => (
            <section key={faction} className="campaign-sheet-card npc-faction-group">
              <div className="row-actions">
                <h3>{faction}</h3>
                <span className="meta-text">{npcs.length} PNJ</span>
              </div>
              <div className="cards npc-record-grid">
                {npcs.map((npc) => (
                  <article key={npc.id} className={`card npc-record-card app-card-accent app-card-accent--npc-${npc.depth}`}>
                    <div className="row-actions">
                      <div>
                        <h3>{npc.name}</h3>
                        <p className="meta-text">{npc.race || "Sin raza"}{npc.occupation ? ` · ${npc.occupation}` : ""}</p>
                      </div>
                      <span className="compendium-chip">{DEPTH_LABELS[npc.depth]}</span>
                    </div>
                    <p>{npc.summary || "Sin resumen breve."}</p>
                    {npc.labels.length > 0 ? (
                      <div className="compendium-tags">
                        {npc.labels.map((label) => <span key={`${npc.id}-${label}`} className="compendium-chip">{label}</span>)}
                      </div>
                    ) : null}
                    <div className="card-actions">
                      <button type="button" className="subtle-button" onClick={() => {
                        controller.selectNpc(npc.id);
                        setPageMode(npc.depth === "full_sheet" ? "sheet" : "detail");
                      }}>
                        {npc.depth === "full_sheet" ? "Abrir hoja" : "Ver detalle"}
                      </button>
                      {npc.depth === "full_sheet" ? (
                        <button type="button" className="subtle-button" onClick={() => {
                          controller.selectNpc(npc.id);
                          setPageMode("builder");
                        }}>
                          Constructor
                        </button>
                      ) : null}
                      <button type="button" onClick={() => openEditModal(npc)}>Editar</button>
                      <button type="button" className="danger" onClick={() => void controller.removeNpc(npc.id)}>Eliminar</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )) : (
            <div className="entry-row">
              <strong>No hay PNJ que coincidan.</strong>
              <p>Ajusta los filtros o crea un PNJ nuevo.</p>
            </div>
          )}
        </div>
      </section>

      {isEditorOpen ? <NpcEditorModal controller={controller} onClose={() => setIsEditorOpen(false)} /> : null}
    </div>
  );
}
