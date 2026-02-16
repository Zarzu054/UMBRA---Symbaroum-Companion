import type { AuthUser } from "@umbra/shared";
import { CharacterCard } from "../components/CharacterCard";
import { getRoleLabel, useCharacterController } from "../controllers/characterController";
import { toCharacterCardViewModel } from "../models/characterModel";

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
          <button onClick={controller.newCharacter}>Nuevo personaje</button>
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

      <section className="panel">
        <div className="row-actions">
          <h2>{controller.isEditing ? "Editar personaje" : "Crear personaje"}</h2>
          <button disabled={controller.isSaving} onClick={() => void controller.submit()}>
            {controller.isSaving ? "Guardando..." : controller.isEditing ? "Actualizar ficha" : "Crear ficha"}
          </button>
        </div>

        {controller.error ? <p className="error">{controller.error}</p> : null}

        <div className="section-title">Identidad</div>
        <div className="form-grid">
          <input
            placeholder="Nombre del personaje"
            value={controller.form.name}
            onChange={(event) => controller.updateTopLevel("name", event.target.value)}
          />
          <input
            placeholder="Nombre del jugador"
            value={controller.form.sheet.identidad.nombreJugador}
            onChange={(event) => controller.updateSheet("identidad.nombreJugador", event.target.value)}
          />
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
          <input
            placeholder="Profesion"
            value={controller.form.sheet.identidad.profesion}
            onChange={(event) => {
              controller.updateSheet("identidad.profesion", event.target.value);
              controller.updateTopLevel("profession", event.target.value);
            }}
          />
          <input
            placeholder="Edad"
            value={controller.form.sheet.identidad.edad}
            onChange={(event) => controller.updateSheet("identidad.edad", event.target.value)}
          />
          <input
            placeholder="Apariencia"
            value={controller.form.sheet.identidad.apariencia}
            onChange={(event) => controller.updateSheet("identidad.apariencia", event.target.value)}
          />
        </div>

        <div className="section-title">Atributos</div>
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
        <div className="form-grid">
          <input
            type="number"
            min={1}
            max={200}
            placeholder="Nivel"
            value={controller.form.sheet.progreso.nivel}
            onChange={(event) => {
              const level = Number(event.target.value || 1);
              controller.updateSheet("progreso.nivel", level);
              controller.updateTopLevel("level", level);
            }}
          />
          <input
            type="number"
            min={0}
            placeholder="PX total"
            value={controller.form.sheet.progreso.experienciaTotal}
            onChange={(event) => controller.updateSheet("progreso.experienciaTotal", Number(event.target.value || 0))}
          />
          <input
            type="number"
            min={0}
            placeholder="PX gastada"
            value={controller.form.sheet.progreso.experienciaGastada}
            onChange={(event) => controller.updateSheet("progreso.experienciaGastada", Number(event.target.value || 0))}
          />
          <div className="info-box">PX disponible: {controller.availableXp}</div>
        </div>

        <div className="section-title">Combate y corrupcion</div>
        <div className="form-grid">
          <input
            type="number"
            min={0}
            placeholder="Robustez max"
            value={controller.form.sheet.combate.robustezMax}
            onChange={(event) => controller.updateSheet("combate.robustezMax", Number(event.target.value || 0))}
          />
          <input
            type="number"
            min={0}
            placeholder="Robustez actual"
            value={controller.form.sheet.combate.robustezActual}
            onChange={(event) => controller.updateSheet("combate.robustezActual", Number(event.target.value || 0))}
          />
          <input
            type="number"
            placeholder="Mod defensa"
            value={controller.form.sheet.combate.defensaMod}
            onChange={(event) => controller.updateSheet("combate.defensaMod", Number(event.target.value || 0))}
          />
          <input
            type="number"
            placeholder="Mod iniciativa"
            value={controller.form.sheet.combate.iniciativaMod}
            onChange={(event) => controller.updateSheet("combate.iniciativaMod", Number(event.target.value || 0))}
          />
          <input
            placeholder="Armadura"
            value={controller.form.sheet.combate.armadura}
            onChange={(event) => controller.updateSheet("combate.armadura", event.target.value)}
          />
          <input
            placeholder="Arma principal"
            value={controller.form.sheet.combate.armaPrincipal}
            onChange={(event) => controller.updateSheet("combate.armaPrincipal", event.target.value)}
          />
          <input
            placeholder="Danio principal"
            value={controller.form.sheet.combate.danioPrincipal}
            onChange={(event) => controller.updateSheet("combate.danioPrincipal", event.target.value)}
          />
          <input
            placeholder="Arma secundaria"
            value={controller.form.sheet.combate.armaSecundaria}
            onChange={(event) => controller.updateSheet("combate.armaSecundaria", event.target.value)}
          />
          <input
            placeholder="Danio secundaria"
            value={controller.form.sheet.combate.danioSecundaria}
            onChange={(event) => controller.updateSheet("combate.danioSecundaria", event.target.value)}
          />
          <input
            type="number"
            min={0}
            placeholder="Corrupcion temporal"
            value={controller.form.sheet.corrupcion.temporal}
            onChange={(event) => controller.updateSheet("corrupcion.temporal", Number(event.target.value || 0))}
          />
          <input
            type="number"
            min={0}
            placeholder="Corrupcion permanente"
            value={controller.form.sheet.corrupcion.permanente}
            onChange={(event) => controller.updateSheet("corrupcion.permanente", Number(event.target.value || 0))}
          />
          <input
            type="number"
            min={0}
            placeholder="Umbral de corrupcion"
            value={controller.form.sheet.corrupcion.umbral}
            onChange={(event) => controller.updateSheet("corrupcion.umbral", Number(event.target.value || 0))}
          />
          <div className="info-box">Corrupcion total: {controller.corruptionTotal}</div>
        </div>

        <div className="section-title">Habilidades</div>
        <div className="inline-row">
          <input
            placeholder="Nueva habilidad"
            value={controller.listInput.habilidades}
            onChange={(event) => controller.setListInput((prev) => ({ ...prev, habilidades: event.target.value }))}
          />
          <button onClick={() => controller.addRatedItem("habilidades", "habilidades")}>Agregar</button>
        </div>
        <div className="list-grid">
          {controller.form.sheet.habilidades.map((item, index) => (
            <article key={`hab-${index}`} className="entry-row">
              <input
                value={item.nombre}
                onChange={(event) => controller.updateRatedItem("habilidades", index, "nombre", event.target.value)}
              />
              <select
                value={item.nivel}
                onChange={(event) => controller.updateRatedItem("habilidades", index, "nivel", event.target.value)}
              >
                <option value="novato">Novato</option>
                <option value="adepto">Adepto</option>
                <option value="maestro">Maestro</option>
              </select>
              <input
                placeholder="Fuente"
                value={item.fuente}
                onChange={(event) => controller.updateRatedItem("habilidades", index, "fuente", event.target.value)}
              />
              <button onClick={() => controller.removeRatedItem("habilidades", index)}>Quitar</button>
            </article>
          ))}
        </div>

        <div className="section-title">Poderes misticos y rituales</div>
        <div className="inline-row">
          <input
            placeholder="Nuevo poder mistico"
            value={controller.listInput.poderes}
            onChange={(event) => controller.setListInput((prev) => ({ ...prev, poderes: event.target.value }))}
          />
          <button onClick={() => controller.addRatedItem("poderesMisticos", "poderes")}>Agregar poder</button>
        </div>
        <div className="list-grid">
          {controller.form.sheet.poderesMisticos.map((item, index) => (
            <article key={`pow-${index}`} className="entry-row">
              <input
                value={item.nombre}
                onChange={(event) => controller.updateRatedItem("poderesMisticos", index, "nombre", event.target.value)}
              />
              <select
                value={item.nivel}
                onChange={(event) => controller.updateRatedItem("poderesMisticos", index, "nivel", event.target.value)}
              >
                <option value="novato">Novato</option>
                <option value="adepto">Adepto</option>
                <option value="maestro">Maestro</option>
              </select>
              <input
                placeholder="Fuente"
                value={item.fuente}
                onChange={(event) => controller.updateRatedItem("poderesMisticos", index, "fuente", event.target.value)}
              />
              <button onClick={() => controller.removeRatedItem("poderesMisticos", index)}>Quitar</button>
            </article>
          ))}
        </div>

        <div className="inline-row">
          <input
            placeholder="Nuevo ritual"
            value={controller.listInput.rituales}
            onChange={(event) => controller.setListInput((prev) => ({ ...prev, rituales: event.target.value }))}
          />
          <button onClick={() => controller.addRatedItem("rituales", "rituales")}>Agregar ritual</button>
        </div>
        <div className="list-grid">
          {controller.form.sheet.rituales.map((item, index) => (
            <article key={`rit-${index}`} className="entry-row">
              <input
                value={item.nombre}
                onChange={(event) => controller.updateRatedItem("rituales", index, "nombre", event.target.value)}
              />
              <select
                value={item.nivel}
                onChange={(event) => controller.updateRatedItem("rituales", index, "nivel", event.target.value)}
              >
                <option value="novato">Novato</option>
                <option value="adepto">Adepto</option>
                <option value="maestro">Maestro</option>
              </select>
              <input
                placeholder="Fuente"
                value={item.fuente}
                onChange={(event) => controller.updateRatedItem("rituales", index, "fuente", event.target.value)}
              />
              <button onClick={() => controller.removeRatedItem("rituales", index)}>Quitar</button>
            </article>
          ))}
        </div>

        <div className="section-title">Rasgos, equipo y contactos</div>
        <div className="triple-columns">
          <div>
            <div className="inline-row">
              <input
                placeholder="Rasgo"
                value={controller.listInput.rasgos}
                onChange={(event) => controller.setListInput((prev) => ({ ...prev, rasgos: event.target.value }))}
              />
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
              <input
                placeholder="Equipo"
                value={controller.listInput.equipo}
                onChange={(event) => controller.setListInput((prev) => ({ ...prev, equipo: event.target.value }))}
              />
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
              <input
                placeholder="Contacto o PNJ relevante"
                value={controller.listInput.contactos}
                onChange={(event) => controller.setListInput((prev) => ({ ...prev, contactos: event.target.value }))}
              />
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
        <textarea
          rows={4}
          placeholder="Trasfondo del personaje"
          value={controller.form.sheet.identidad.trasfondo}
          onChange={(event) => controller.updateSheet("identidad.trasfondo", event.target.value)}
        />
        <textarea
          rows={5}
          placeholder="Notas de reglas, erratas aplicadas, referencias de libro/pagina"
          value={controller.form.sheet.notas}
          onChange={(event) => controller.updateSheet("notas", event.target.value)}
        />
      </section>

      <section className="panel">
        <h2>Personajes</h2>
        {controller.isLoading ? <p>Cargando...</p> : null}
        <div className="cards">
          {controller.characters.map((character) => (
            <CharacterCard
              key={character.id}
              item={toCharacterCardViewModel(character)}
              selected={controller.selectedCharacterId === character.id}
              onSelect={() => controller.selectCharacter(character.id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
