import { useEffect, useState } from "react";
import type { AuthUser } from "@umbra/shared";
import { CharacterCard } from "../components/CharacterCard";
import { getRoleLabel, useCharacterController } from "../controllers/characterController";
import { findCompendiumCapabilityEntryId } from "../models/compendiumEntries";
import { toCharacterCardViewModel } from "../models/characterModel";
import { exportCharacterSheetPdf } from "../services/characterPdfExport";
import { CampaignDashboardView } from "./CampaignDashboardView";
import { CompendiumView } from "./CompendiumView";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
  onLogout: () => Promise<void>;
};

type AppModule = "characters" | "compendium" | "campaigns";

type CompendiumFocus = {
  entryId: string | null;
  query: string;
  source: string;
  token: number;
};

function parseHash(): { module: AppModule; focus?: Omit<CompendiumFocus, "token"> } {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (rawHash.startsWith("campaigns")) {
    return { module: "campaigns" };
  }

  if (rawHash.startsWith("characters")) {
    return { module: "characters" };
  }

  if (!rawHash.startsWith("compendium")) {
    return { module: "characters" };
  }

  const [, search = ""] = rawHash.split("?");
  const params = new URLSearchParams(search);
  return {
    module: "compendium",
    focus: {
      entryId: params.get("id"),
      query: params.get("q") ?? "",
      source: params.get("source") ?? "all"
    }
  };
}

export function CharacterDashboardView({ user, ensureAccessToken, onLogout }: Props) {
  const controller = useCharacterController(ensureAccessToken);
  const [activeModule, setActiveModule] = useState<AppModule>("characters");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [compendiumFocus, setCompendiumFocus] = useState<CompendiumFocus>({
    entryId: null,
    query: "",
    source: "all",
    token: 0
  });

  useEffect(() => {
    function syncWithHash(): void {
      const parsed = parseHash();
      switch (parsed.module) {
        case "compendium":
          setActiveModule("compendium");
          setCompendiumFocus((prev) => ({
            entryId: parsed.focus?.entryId ?? null,
            query: parsed.focus?.query ?? "",
            source: parsed.focus?.source ?? "all",
            token: prev.token + 1
          }));
          return;
        case "campaigns":
          setActiveModule("campaigns");
          return;
        case "characters":
        default:
          setActiveModule("characters");
          return;
      }
    }

    syncWithHash();
    window.addEventListener("hashchange", syncWithHash);
    return () => window.removeEventListener("hashchange", syncWithHash);
  }, []);

  function openCompendiumCapability(tipo: "habilidad" | "poder_mistico" | "ritual", nombre: string): void {
    const entryId = findCompendiumCapabilityEntryId(tipo, nombre);
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

  return (
    <main className="page">
      <div className={`app-shell${isSidebarOpen ? "" : " is-sidebar-collapsed"}`}>
        <aside className={`app-sidebar${isSidebarOpen ? "" : " is-collapsed"}`}>
          <div className="app-sidebar-inner">
            <div className="app-sidebar-head">
              <div>
                <h1>UMBRA</h1>
                <p>{user.email}</p>
                <p>{getRoleLabel(user.role)}</p>
              </div>
              <button
                className="sidebar-toggle"
                aria-label={isSidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
                onClick={() => setIsSidebarOpen((current) => !current)}
              >
                {isSidebarOpen ? "◀" : "▶"}
              </button>
            </div>
            <nav className="sidebar-nav">
              <button className={activeModule === "characters" ? "active-toggle" : ""} onClick={openCharactersModule}>
                Personajes
              </button>
              <button className={activeModule === "campaigns" ? "active-toggle" : ""} onClick={openCampaignsModule}>
                Campañas
              </button>
              <button className={activeModule === "compendium" ? "active-toggle" : ""} onClick={openCompendiumModule}>
                Compendio
              </button>
            </nav>
            <div className="sidebar-session">
              <button onClick={() => void onLogout()}>Salir</button>
            </div>
          </div>
        </aside>

        <section className="app-content">
          {!isSidebarOpen ? (
            <div className="content-topbar">
              <button
                className="sidebar-toggle"
                aria-label="Mostrar barra lateral"
                onClick={() => setIsSidebarOpen(true)}
              >
                ▶
              </button>
            </div>
          ) : null}

          {activeModule === "compendium" ? (
            <CompendiumView
              onBackToCharacters={openCharactersModule}
              initialEntryId={compendiumFocus.entryId}
              initialQuery={compendiumFocus.query}
              initialSourceFilter={compendiumFocus.source}
              focusToken={compendiumFocus.token}
            />
          ) : activeModule === "campaigns" ? (
            <CampaignDashboardView user={user} ensureAccessToken={ensureAccessToken} />
          ) : (
            <>
      <section className="panel content-toolbar-panel">
        <div className="toolbar">
          <button onClick={controller.openCreateModal}>Nuevo personaje</button>
          <button disabled={controller.isSaving} onClick={() => void controller.createRandomCharacter()}>
            Generar aleatorio
          </button>
        </div>
      </section>
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
                  if (window.confirm("Esta acciÃ³n eliminarÃ¡ el personaje. Â¿Deseas continuar?")) {
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
        <p className="section-help">Control de avance: nivel, experiencia ganada y experiencia invertida.</p>
        <div className="form-grid">
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
          <div className="info-box">PX disponible: {controller.derived.xpDisponible}</div>
        </div>

        <div className="section-title">Cálculos automáticos (MVP)</div>
        <p className="section-help">
          Puedes añadir modificadores automáticos en efectos/notas usando tokens como: <code>DEF+1</code>, <code>INI+1</code>,
          <code>ROBMAX+2</code>, <code>UMBCORR+1</code>.
        </p>
        <div className="form-grid">
          <div className="info-box">Defensa total: {controller.derived.defensaTotal}</div>
          <div className="info-box">Iniciativa total: {controller.derived.iniciativaTotal}</div>
          <div className="info-box">Robustez máx. total: {controller.derived.robustezMaximaTotal}</div>
          <div className="info-box">Robustez actual total: {controller.derived.robustezActualTotal}</div>
          <div className="info-box">Umbral de dolor total: {controller.derived.umbralDolorTotal}</div>
          <div className="info-box">Umbral de corrupción total: {controller.derived.umbralCorrupcionTotal}</div>
        </div>
        {controller.derived.warnings.length > 0 ? (
          <div className="warning-block">
            {controller.derived.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

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
          <div className="info-box">Corrupcion total: {controller.derived.corrupcionTotal}</div>
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
              <button className="subtle-button" onClick={() => openCompendiumCapability("habilidad", item.nombre)}>Ver en compendio</button>
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
              <button className="subtle-button" onClick={() => openCompendiumCapability("ritual", item.nombre)}>Ver en compendio</button>
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
                <span>Ocupacion</span>
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
                <span>Corrupcion</span>
                <input
                  value={item.corrupcion}
                  onChange={(event) => controller.updateSheet(`artefactos.${index}.corrupcion`, event.target.value)}
                />
              </label>
            </article>
          ))}
        </div>
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
              onSimulate={() => controller.selectCharacterForSimulation(character.id)}
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

      <section className="panel">
        <h2>Simulador de tiradas</h2>
        <p className="section-help">Disponible solo para personajes ya creados. Pulsa "Simular tiradas" en una tarjeta.</p>
        {controller.simulationCharacter ? (
          <>
            <p className="meta-text">
              Personaje activo: <strong>{controller.simulationCharacter.name}</strong>
            </p>
            <div className="form-grid">
              <label className="field">
                <span>Tipo de tirada</span>
                <select
                  value={controller.rollState.mode}
                  onChange={(event) =>
                    controller.setRollState((prev) => ({
                      ...prev,
                      mode: event.target.value as "defensa" | "iniciativa" | "atributo"
                    }))
                  }
                >
                  <option value="defensa">Defensa (usa cálculo total)</option>
                  <option value="iniciativa">Iniciativa (usa cálculo total)</option>
                  <option value="atributo">Atributo</option>
                </select>
              </label>
              {controller.rollState.mode === "atributo" ? (
                <label className="field">
                  <span>Atributo</span>
                  <select
                    value={controller.rollState.attribute}
                    onChange={(event) =>
                      controller.setRollState((prev) => ({
                        ...prev,
                        attribute: event.target.value as (typeof controller.attributeKeys)[number]
                      }))
                    }
                  >
                    {controller.attributeKeys.map((attribute) => (
                      <option key={attribute} value={attribute}>
                        {controller.attributeLabels[attribute]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="field">
                <span>Modificador situacional</span>
                <input
                  type="number"
                  value={controller.rollState.situationalMod}
                  onChange={(event) =>
                    controller.setRollState((prev) => ({ ...prev, situationalMod: Number(event.target.value || 0) }))
                  }
                />
              </label>
              <div className="toolbar">
                <button onClick={controller.runTestRoll}>Tirar d20</button>
                <button onClick={controller.clearRollHistory}>Limpiar historial</button>
              </div>
            </div>
            {controller.simulationDerived ? (
              <div className="form-grid">
                <div className="info-box">Defensa total: {controller.simulationDerived.defensaTotal}</div>
                <div className="info-box">Iniciativa total: {controller.simulationDerived.iniciativaTotal}</div>
                <div className="info-box">Corrupción total: {controller.simulationDerived.corrupcionTotal}</div>
              </div>
            ) : null}
            {controller.rollState.history.length > 0 ? (
              <div className="roll-log">
                {controller.rollState.history.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="section-help">Aún no hay tiradas de prueba.</p>
            )}
          </>
        ) : (
          <p className="section-help">Elige un personaje para habilitar el simulador.</p>
        )}
      </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

