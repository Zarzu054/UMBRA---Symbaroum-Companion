import { useMemo, useState } from "react";
import {
  getDerivedMonsterSheetStats,
  MONSTER_ATTRIBUTE_KEYS,
  MONSTER_ATTRIBUTE_LABELS,
  MONSTER_CATEGORIES,
  MONSTER_THREATS,
  type AuthUser,
  type Monster
} from "@umbra/shared";
import { useMonsterController } from "../controllers/monsterController";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
};

type MonsterTableViewModel = Pick<Monster, "name" | "category" | "threat" | "source" | "summary" | "sheet">;
type MonsterModuleTab = "codex" | "custom";

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function renderMonsterTable(monster: MonsterTableViewModel) {
  const derivedSheet = getDerivedMonsterSheetStats(monster.sheet);

  return (
    <div className="monster-statblock">
      <div className="monster-statblock-header">
        <div>
          <h3>{monster.name}</h3>
          <p>{monster.summary}</p>
        </div>
        <div className="monster-statblock-meta">
          <span className="compendium-chip">{monster.category}</span>
          <span className="compendium-chip">{monster.threat}</span>
          <span className="compendium-chip">{monster.source}</span>
        </div>
      </div>

      <div className="monster-stat-grid">
        <div className="info-box"><strong>Ataque:</strong>&nbsp;{monster.sheet.attack}</div>
        <div className="info-box"><strong>Daño:</strong>&nbsp;{monster.sheet.damage}</div>
        <div className="info-box"><strong>Defensa:</strong>&nbsp;{derivedSheet.defense}</div>
        <div className="info-box"><strong>Armadura:</strong>&nbsp;{derivedSheet.armor}</div>
        <div className="info-box"><strong>Robustez:</strong>&nbsp;{derivedSheet.toughness}</div>
        <div className="info-box"><strong>Umbral:</strong>&nbsp;{derivedSheet.painThreshold}</div>
        <div className="info-box"><strong>Movimiento:</strong>&nbsp;{monster.sheet.movement}</div>
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
                <td key={attribute}>{monster.sheet.attributes[attribute]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="monster-detail-grid">
        <article className="entry-row">
          <strong>Rasgos</strong>
          <ul className="tag-list">
            {monster.sheet.traits.map((trait) => (
              <li key={trait}>{trait}</li>
            ))}
          </ul>
        </article>
        <article className="entry-row">
          <strong>Acciones</strong>
          <ul className="tag-list">
            {monster.sheet.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </article>
        <article className="entry-row">
          <strong>Táctica</strong>
          <p>{monster.sheet.tactics || "Sin táctica definida."}</p>
        </article>
        <article className="entry-row">
          <strong>Debilidad</strong>
          <p>{monster.sheet.weakness || "Sin debilidad definida."}</p>
        </article>
        <article className="entry-row">
          <strong>Botín / restos</strong>
          <p>{monster.sheet.loot || "Sin botín definido."}</p>
        </article>
      </div>
    </div>
  );
}

type MonsterEditorModalProps = {
  controller: ReturnType<typeof useMonsterController>;
  onClose: () => void;
};

function MonsterEditorModal({ controller, onClose }: MonsterEditorModalProps) {
  useBodyScrollLock(true);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal-panel monster-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="row-actions">
          <div>
            <h2>{controller.selectedCustomId ? "Editar monstruo" : "Crear monstruo"}</h2>
            <p className="section-help">Formulario completo con vista previa integrada del bloque de estadísticas.</p>
          </div>
          <div className="toolbar">
            <span className="compendium-chip">Total atributos: {controller.draftAttributeTotal}</span>
            <button type="button" disabled={controller.isSaving} onClick={() => void controller.saveDraft()}>
              {controller.isSaving ? "Guardando..." : "Guardar monstruo"}
            </button>
            <button type="button" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        {controller.formError ? <p className="error">{controller.formError}</p> : null}

        <div className="monster-editor-layout">
          <section className="monster-builder-card">
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={controller.draft.name}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateField("name", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Categoría</span>
                <select
                  value={controller.draft.category}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateField("category", event.target.value)}
                >
                  {MONSTER_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Peligrosidad</span>
                <select
                  value={controller.draft.threat}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateField("threat", event.target.value)}
                >
                  {MONSTER_THREATS.map((threat) => (
                    <option key={threat} value={threat}>{threat}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Resumen táctico</span>
                <input
                  value={controller.draft.summary}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateField("summary", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Ataque</span>
                <input
                  value={controller.draft.sheet.attack}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("attack", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Daño</span>
                <input
                  value={controller.draft.sheet.damage}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("damage", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Defensa</span>
                <input
                  value={controller.draft.sheet.defense}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("defense", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Armadura</span>
                <input
                  value={controller.draft.sheet.armor}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("armor", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Robustez</span>
                <input
                  value={controller.draft.sheet.toughness}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("toughness", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Umbral de dolor</span>
                <input
                  value={controller.draft.sheet.painThreshold}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("painThreshold", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Movimiento</span>
                <input
                  value={controller.draft.sheet.movement}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("movement", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Botín / restos</span>
                <input
                  value={controller.draft.sheet.loot}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("loot", event.target.value)}
                />
              </label>
            </div>

            <div className="section-title">Atributos</div>
            <div className="attributes-grid">
              {MONSTER_ATTRIBUTE_KEYS.map((attribute) => (
                <label key={attribute} className="attribute-box">
                  <span>{MONSTER_ATTRIBUTE_LABELS[attribute]}</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={controller.draft.sheet.attributes[attribute]}
                    disabled={controller.isSaving}
                    onChange={(event) => controller.updateAttribute(attribute, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>

            <div className="section-title">Rasgos y conducta</div>
            <div className="form-grid">
              <label className="field">
                <span>Rasgos de monstruo</span>
                <textarea
                  rows={4}
                  placeholder="Un rasgo por línea"
                  value={controller.draft.sheet.traits.join("\n")}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateListField("traits", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Acciones</span>
                <textarea
                  rows={4}
                  placeholder="Una acción por línea"
                  value={controller.draft.sheet.actions.join("\n")}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateListField("actions", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Táctica</span>
                <textarea
                  rows={4}
                  value={controller.draft.sheet.tactics}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("tactics", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Debilidad</span>
                <textarea
                  rows={4}
                  value={controller.draft.sheet.weakness}
                  disabled={controller.isSaving}
                  onChange={(event) => controller.updateSheetField("weakness", event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="monster-builder-card">
            <h3>Vista previa</h3>
            {renderMonsterTable({
              ...controller.draft,
              name: controller.draft.name || "Monstruo sin nombre",
              summary: controller.draft.summary || "Añade un resumen táctico para completar la ficha."
            })}
          </section>
        </div>
      </div>
    </div>
  );
}

type MonsterSheetModalProps = {
  monster: Monster;
  onClose: () => void;
};

function MonsterSheetModal({ monster, onClose }: MonsterSheetModalProps) {
  useBodyScrollLock(true);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal-panel monster-sheet-modal" onClick={(event) => event.stopPropagation()}>
        <div className="monster-sheet-modal-header">
          <div className="row-actions">
          <h2>Hoja rápida</h2>
          <button type="button" onClick={onClose}>Cerrar</button>
          </div>
        </div>
        <div className="monster-sheet-modal-body">
          {renderMonsterTable(monster)}
        </div>
      </div>
    </div>
  );
}

export function MonsterDashboardView({ user, ensureAccessToken }: Props) {
  const controller = useMonsterController(user, ensureAccessToken);
  const [activeTab, setActiveTab] = useState<MonsterModuleTab>("codex");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCodexSheetOpen, setIsCodexSheetOpen] = useState(false);
  const [detailMonsterId, setDetailMonsterId] = useState<string | null>(null);
  const [sheetPreviewMonsterId, setSheetPreviewMonsterId] = useState<string | null>(null);
  const [codexSearch, setCodexSearch] = useState("");

  const filteredCodexMonsters = useMemo(() => {
    const query = normalizeSearchValue(codexSearch);
    if (!query) return controller.codexMonsters;

    return controller.codexMonsters.filter((monster) => {
      const haystack = normalizeSearchValue([
        monster.name,
        monster.category,
        monster.threat,
        monster.source,
        monster.summary,
        monster.sheet.traits.join(" "),
        monster.sheet.actions.join(" ")
      ].join(" "));

      return haystack.includes(query);
    });
  }, [codexSearch, controller.codexMonsters]);

  const visibleCodexMonster = useMemo(
    () => filteredCodexMonsters.find((monster) => monster.id === controller.selectedCodexId) ?? filteredCodexMonsters[0] ?? null,
    [filteredCodexMonsters, controller.selectedCodexId]
  );

  const detailMonster = useMemo(
    () => controller.customMonsters.find((monster) => monster.id === detailMonsterId) ?? null,
    [controller.customMonsters, detailMonsterId]
  );
  const sheetPreviewMonster = useMemo(
    () => controller.customMonsters.find((monster) => monster.id === sheetPreviewMonsterId) ?? null,
    [controller.customMonsters, sheetPreviewMonsterId]
  );

  function openCreateModal(): void {
    controller.resetDraft();
    setIsEditorOpen(true);
  }

  function openEditModal(monsterId: string): void {
    controller.selectCustomMonster(monsterId);
    setIsEditorOpen(true);
  }

  function openDetail(monsterId: string): void {
    setDetailMonsterId(monsterId);
  }

  function closeDetail(): void {
    setDetailMonsterId(null);
  }

  function openCodexDetail(monsterId: string): void {
    controller.setSelectedCodexId(monsterId);
    setIsCodexSheetOpen(true);
  }

  return (
    <div className="monster-module">
      <section className="panel lore-panel">
        <h2>Archivo del Director de Juego</h2>
        <p>
          Acceso rápido a monstruos listos para mesa y un banco propio de criaturas diseñadas con la lógica del
          Códice de monstruos.
        </p>
        <div className="monster-guidance-grid">
          <div className="info-box">Plantilla sugerida de atributos: 80 puntos repartidos con un rol táctico claro.</div>
          <div className="info-box">Prioriza rasgos pasivos, una debilidad clara y pocas acciones realmente decisivas.</div>
          <div className="info-box">El módulo separa el códice base de tus monstruos persistidos en base de datos.</div>
        </div>
      </section>

      <section className="panel monster-section">
        <div className="toolbar campaign-section-nav" aria-label="Secciones del módulo de monstruos">
          <button type="button" className={activeTab === "codex" ? "is-active" : ""} onClick={() => setActiveTab("codex")}>
            Monstruos del códice
          </button>
          <button type="button" className={activeTab === "custom" ? "is-active" : ""} onClick={() => setActiveTab("custom")}>
            Mis monstruos
          </button>
        </div>
      </section>

      <div className="monster-module-layout">
        {activeTab === "codex" ? (
          <section className="panel monster-section">
            <div className="row-actions">
              <div>
                <h2>Monstruos del códice</h2>
                <p className="section-help">Selección inicial lista para consulta inmediata en partida.</p>
              </div>
              <div className="toolbar">
                {controller.isLoading ? <span className="meta-text">Cargando...</span> : null}
                <span className="meta-text">{filteredCodexMonsters.length} resultados</span>
              </div>
            </div>

            <div className="compendium-filters">
              <label className="field compendium-search">
                <span>Buscar en el códice</span>
                <input
                  type="search"
                  value={codexSearch}
                  onChange={(event) => setCodexSearch(event.target.value)}
                  placeholder="Nombre, rasgo, categoría, acción..."
                />
              </label>
            </div>

            <div className="monster-browser-layout">
              <div className="monster-browser-list">
                {filteredCodexMonsters.length > 0 ? (
                  filteredCodexMonsters.map((monster) => (
                    <button
                      key={monster.id}
                      className={`compendium-list-item${visibleCodexMonster?.id === monster.id ? " is-active" : ""}`}
                      onClick={() => openCodexDetail(monster.id)}
                    >
                      <strong>{monster.name}</strong>
                      <span>{monster.category} · {monster.threat}</span>
                      <span className="compendium-list-summary">{monster.summary}</span>
                    </button>
                  ))
                ) : (
                  <div className="entry-row">
                    <strong>No hay coincidencias.</strong>
                    <p>Ajusta la búsqueda para localizar otro monstruo del códice.</p>
                  </div>
                )}
              </div>

            </div>
          </section>
        ) : null}

        {activeTab === "custom" ? (
          detailMonster ? (
            <section className="panel monster-section">
              <div className="row-actions">
                <div>
                  <h2>{detailMonster.name}</h2>
                  <p className="section-help">{detailMonster.category} · {detailMonster.threat}</p>
                </div>
                <div className="toolbar">
                  <button type="button" className="subtle-button" onClick={closeDetail}>Volver al listado</button>
                  <button type="button" onClick={() => openEditModal(detailMonster.id)}>Editar</button>
                  <button type="button" onClick={() => setSheetPreviewMonsterId(detailMonster.id)}>Hoja rápida</button>
                </div>
              </div>

              {renderMonsterTable(detailMonster)}
            </section>
          ) : (
            <section className="panel monster-section">
              <div className="row-actions">
                <div>
                  <h2>Mis monstruos</h2>
                  <p className="section-help">Listado compacto con acceso a detalle, edición y hoja rápida.</p>
                </div>
                <div className="toolbar">
                  <button type="button" onClick={openCreateModal}>Nuevo monstruo</button>
                </div>
              </div>

              {controller.loadError ? <p className="error">{controller.loadError}</p> : null}

              <div className="monster-record-list">
                {controller.customMonsters.length > 0 ? (
                  controller.customMonsters.map((monster) => (
                    <article key={monster.id} className="monster-record-item">
                      <div className="monster-record-main">
                        <strong>{monster.name}</strong>
                        <span>{monster.category} · {monster.threat}</span>
                        <span className="compendium-list-summary">{monster.summary}</span>
                      </div>
                      <div className="monster-record-actions">
                        <button type="button" className="subtle-button" onClick={() => setSheetPreviewMonsterId(monster.id)}>
                          Hoja rápida
                        </button>
                        <button type="button" className="subtle-button" onClick={() => openDetail(monster.id)}>
                          Ver detalle
                        </button>
                        <button type="button" onClick={() => openEditModal(monster.id)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={controller.isSaving}
                          onClick={async () => {
                            controller.selectCustomMonster(monster.id);
                            await controller.deleteSelected();
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="entry-row">
                    <strong>No hay monstruos propios aún.</strong>
                    <p>Crea el primero para empezar tu colección de bloques personalizados.</p>
                  </div>
                )}
              </div>
            </section>
          )
        ) : null}
      </div>

      {isEditorOpen ? <MonsterEditorModal controller={controller} onClose={() => setIsEditorOpen(false)} /> : null}
      {sheetPreviewMonster ? (
        <MonsterSheetModal monster={sheetPreviewMonster} onClose={() => setSheetPreviewMonsterId(null)} />
      ) : null}
      {isCodexSheetOpen && visibleCodexMonster ? (
        <MonsterSheetModal monster={visibleCodexMonster} onClose={() => setIsCodexSheetOpen(false)} />
      ) : null}
    </div>
  );
}
