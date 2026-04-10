import {
  MONSTER_ATTRIBUTE_KEYS,
  MONSTER_ATTRIBUTE_LABELS,
  MONSTER_CATEGORIES,
  MONSTER_THREATS,
  type AuthUser,
  type Monster
} from "@umbra/shared";
import { useMonsterController } from "../controllers/monsterController";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
};

type MonsterTableViewModel = Pick<Monster, "name" | "category" | "threat" | "source" | "summary" | "sheet">;

function renderMonsterTable(monster: MonsterTableViewModel) {
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
        <div className="info-box"><strong>Defensa:</strong>&nbsp;{monster.sheet.defense}</div>
        <div className="info-box"><strong>Armadura:</strong>&nbsp;{monster.sheet.armor}</div>
        <div className="info-box"><strong>Robustez:</strong>&nbsp;{monster.sheet.toughness}</div>
        <div className="info-box"><strong>Umbral:</strong>&nbsp;{monster.sheet.painThreshold}</div>
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

export function MonsterDashboardView({ user, ensureAccessToken }: Props) {
  const controller = useMonsterController(user, ensureAccessToken);

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
          <div className="info-box">Este primer lote incluye un códice inicial y almacenamiento local por cuenta de DJ.</div>
        </div>
      </section>

      <div className="monster-module-layout">
        <section className="panel monster-section">
          <div className="row-actions">
            <div>
              <h2>Monstruos del códice</h2>
              <p className="section-help">Selección inicial lista para consulta inmediata en partida.</p>
            </div>
            {controller.isLoading ? <span className="meta-text">Cargando…</span> : null}
          </div>

          <div className="monster-browser-layout">
            <div className="monster-browser-list">
              {controller.codexMonsters.map((monster) => (
                <button
                  key={monster.id}
                  className={`compendium-list-item${controller.selectedCodexId === monster.id ? " is-active" : ""}`}
                  onClick={() => controller.setSelectedCodexId(monster.id)}
                >
                  <strong>{monster.name}</strong>
                  <span>{monster.category} · {monster.threat}</span>
                  <span className="compendium-list-summary">{monster.summary}</span>
                </button>
              ))}
            </div>

            <div className="monster-browser-detail">
              {controller.selectedCodexMonster ? renderMonsterTable(controller.selectedCodexMonster) : null}
            </div>
          </div>
        </section>

        <section className="panel monster-section">
          <div className="row-actions">
            <div>
              <h2>Mis monstruos</h2>
              <p className="section-help">Crea, ajusta y revisa tus propios bloques de estadísticas.</p>
            </div>
            <div className="toolbar">
              <button type="button" onClick={controller.resetDraft}>Nuevo monstruo</button>
              <button type="button" disabled={controller.isSaving} onClick={() => void controller.saveDraft()}>
                {controller.isSaving ? "Guardando..." : "Guardar monstruo"}
              </button>
              <button
                type="button"
                className="danger"
                disabled={!controller.selectedCustomId || controller.isSaving}
                onClick={() => void controller.deleteSelected()}
              >
                Eliminar
              </button>
            </div>
          </div>

          {controller.error ? <p className="error">{controller.error}</p> : null}

          <div className="monster-browser-layout">
            <div className="monster-browser-list">
              {controller.customMonsters.length > 0 ? (
                controller.customMonsters.map((monster) => (
                  <button
                    key={monster.id}
                    className={`compendium-list-item${controller.selectedCustomId === monster.id ? " is-active" : ""}`}
                    onClick={() => controller.selectCustomMonster(monster.id)}
                  >
                    <strong>{monster.name}</strong>
                    <span>{monster.category} · {monster.threat}</span>
                    <span className="compendium-list-summary">{monster.summary}</span>
                  </button>
                ))
              ) : (
                <div className="entry-row">
                  <strong>No hay monstruos propios aún.</strong>
                  <p>Crea el primero y quedará guardado para esta cuenta de DJ en este navegador.</p>
                </div>
              )}
            </div>

            <div className="monster-browser-detail monster-builder-stack">
              <section className="monster-builder-card">
                <div className="row-actions">
                  <h3>{controller.selectedCustomId ? "Editar monstruo" : "Crear monstruo"}</h3>
                  <span className="compendium-chip">Total atributos: {controller.draftAttributeTotal}</span>
                </div>
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
                <h3>Vista previa de tabla</h3>
                {renderMonsterTable({
                  ...controller.draft,
                  name: controller.draft.name || "Monstruo sin nombre",
                  summary: controller.draft.summary || "Añade un resumen táctico para completar la ficha."
                })}
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
