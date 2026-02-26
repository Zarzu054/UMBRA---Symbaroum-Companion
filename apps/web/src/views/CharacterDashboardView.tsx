import type { AuthUser } from "@umbra/shared";
import { CharacterCard } from "../components/CharacterCard";
import { getRoleLabel, useCharacterController } from "../controllers/characterController";
import { toCharacterCardViewModel } from "../models/characterModel";
import { exportCharacterSheetPdf } from "../services/characterPdfExport";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
  onLogout: () => Promise<void>;
};

export function CharacterDashboardView({ user, ensureAccessToken, onLogout }: Props) {
  const controller = useCharacterController(ensureAccessToken);

  return (
    <main className="page">
      <header className="top-bar">
        <div>
          <h1>UMBRA</h1>
          <p>{user.email} ({getRoleLabel(user.role)})</p>
        </div>
        <div className="toolbar">
          <button onClick={controller.openCreateModal}>Nuevo personaje</button>
          <button onClick={() => void onLogout()}>Salir</button>
        </div>
      </header>

      <section className="panel lore-panel">
        <h2>Ficha de Personaje de Symbaroum</h2>
        <p>
          Constructor avanzado basado en hoja completa: identidad, atributos, progreso, combate, corrupcion,
          habilidades, poderes, rituales, equipo y referencias por libro/pagina.
        </p>
      </section>

      {controller.isFormModalOpen ? (
        <section className="modal-backdrop" onClick={controller.closeFormModal}>
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
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

        <details className="field-guide">
          <summary>Guía rápida de campos</summary>
          <div className="guide-grid">
            <p><strong>Nombre del personaje:</strong> Nombre en juego del PJ.</p>
            <p><strong>Nombre del jugador:</strong> Persona real que lo juega.</p>
            <p><strong>Raza / Cultura / Arquetipo:</strong> Base narrativa y mecánica del personaje.</p>
            <p><strong>Profesión:</strong> Rol específico (ej. Templario, Cazatesoros, Bruja).</p>
            <p><strong>Atributos:</strong> Valores principales de Symbaroum (5-15).</p>
            <p><strong>Nivel:</strong> Progreso general del personaje.</p>
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
            <select
              value={controller.form.sheet.identidad.raza}
              onChange={(event) => {
                controller.updateSheet("identidad.raza", event.target.value);
                controller.updateTopLevel("race", event.target.value);
              }}
            >
              {controller.races.map((race) => (
                <option key={race} value={race}>
                  {race}
                </option>
              ))}
            </select>
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
        <p className="section-help">Control de avance: nivel, experiencia ganada y experiencia invertida.</p>
        <div className="form-grid">
          <label className="field">
            <span>Nivel</span>
            <input
              type="number"
              min={1}
              max={200}
              value={controller.form.sheet.progreso.nivel}
              onChange={(event) => {
                const level = Number(event.target.value || 1);
                controller.updateSheet("progreso.nivel", level);
                controller.updateTopLevel("level", level);
              }}
            />
          </label>
          <label className="field">
            <span>PX total</span>
            <input
              type="number"
              min={0}
              value={controller.form.sheet.progreso.experienciaTotal}
              onChange={(event) => controller.updateSheet("progreso.experienciaTotal", Number(event.target.value || 0))}
            />
          </label>
          <label className="field">
            <span>PX gastada</span>
            <input
              type="number"
              min={0}
              value={controller.form.sheet.progreso.experienciaGastada}
              onChange={(event) => controller.updateSheet("progreso.experienciaGastada", Number(event.target.value || 0))}
            />
          </label>
          <div className="info-box">PX disponible: {controller.availableXp}</div>
        </div>

        <div className="section-title">Combate y corrupcion</div>
        <p className="section-help">Estado actual en combate y seguimiento de corrupción temporal/permanente.</p>
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
          <div className="info-box">Corrupcion total: {controller.corruptionTotal}</div>
        </div>

        <div className="section-title">Habilidades</div>
        <p className="section-help">Agrega habilidades del compendio o manuales. Define nivel y referencia de regla.</p>
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
                  <option value="novato">Novato</option>
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
              <button onClick={() => controller.removeRatedItem("habilidades", index)}>Quitar</button>
            </article>
          ))}
        </div>

        <div className="section-title">Poderes misticos y rituales</div>
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
                  <option value="novato">Novato</option>
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
                  <option value="novato">Novato</option>
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
              <button onClick={() => controller.removeRatedItem("rituales", index)}>Quitar</button>
            </article>
          ))}
        </div>

        <div className="section-title">Rasgos, equipo y contactos</div>
        <p className="section-help">Elementos narrativos y de inventario que impactan la partida y la hoja.</p>
        <div className="triple-columns">
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

        <div className="section-title">Trasfondo y notas</div>
        <p className="section-help">Resumen de historia, objetivos y aclaraciones de reglas aplicadas a este PJ.</p>
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
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Personajes</h2>
        {controller.isLoading ? <p>Cargando...</p> : null}
        <div className="cards">
          {controller.characters.map((character) => (
            <CharacterCard
              key={character.id}
              item={toCharacterCardViewModel(character)}
              selected={controller.selectedCharacterId === character.id}
              onSelect={() => controller.openEditModal(character.id)}
              onExportPdf={() => void exportCharacterSheetPdf(character)}
              onDuplicate={() => void controller.duplicateSelected(character.id)}
              onDelete={() => {
                if (window.confirm("Esta acción eliminará el personaje. ¿Deseas continuar?")) {
                  void controller.deleteSelected(character.id);
                }
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
