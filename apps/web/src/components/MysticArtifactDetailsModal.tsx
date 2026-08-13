import { formatSkillLevelLabel, type MysticArtifact } from "@umbra/shared";
import { SourceReferenceButton } from "./SourceReferenceLink";

type Props = {
  artifact: MysticArtifact;
  busy?: boolean;
  onClose: () => void;
  onOpenSource: (artifact: MysticArtifact) => Promise<void>;
};

const ACTION_LABELS = { free: "Gratuita", movement: "Movimiento", combat: "Activa", reaction: "Reacción" } as const;
const KIND_LABELS = { weapon: "Arma", armor: "Armadura", object: "Objeto" } as const;
const TAG_LABELS = { one_handed: "Una mano", short: "Corta", long: "Larga", heavy: "Pesada", ranged: "A distancia", thrown: "Arrojadiza" } as const;

export function MysticArtifactDetailsModal({ artifact, busy = false, onClose, onOpenSource }: Props) {
  return (
    <section className="modal-backdrop" onClick={() => !busy && onClose()}>
      <article className="panel modal-panel mystic-artifact-details" onClick={(event) => event.stopPropagation()}>
        <header className="mystic-artifact-details__header">
          <div>
            <span className="eyebrow">{KIND_LABELS[artifact.kind]}</span>
            <h3>{artifact.name}</h3>
            <p className="section-help">{artifact.sourceTitle || "Creación de campaña"}{artifact.sourcePage ? ` · p.${artifact.sourcePage}` : ""}</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose}>Cerrar</button>
        </header>

        <p className="mystic-artifact-details__description">{artifact.description || "Sin descripción narrativa."}</p>

        <div className="mystic-artifact-details__summary">
          <div><strong>Vínculo</strong><span>{artifact.bindingCosts.map((cost) => cost.paymentType === "xp" ? `${cost.amount} PX` : `${cost.amount} Corrupción permanente`).join(" o ")}</span></div>
          {artifact.weapon ? <div><strong>Perfil de arma</strong><span>Ataque {artifact.weapon.attackFormula || "1D20"} con {artifact.weapon.attackAttribute} · Daño {artifact.weapon.damageFormula || "según arma"}</span></div> : null}
          {artifact.weapon?.tags.length ? <div><strong>Categorías</strong><span>{artifact.weapon.tags.map((tag) => TAG_LABELS[tag]).join(", ")}</span></div> : null}
          {artifact.weapon?.qualities.length ? <div><strong>Cualidades</strong><span>{artifact.weapon.qualities.join(", ")}</span></div> : null}
          {artifact.armor ? <div><strong>Perfil de armadura</strong><span>Protección {artifact.armor.protectionFormula || "según escudo"}{artifact.armor.qualities.length ? ` · ${artifact.armor.qualities.join(", ")}` : ""}</span></div> : null}
        </div>

        {artifact.resources.length ? (
          <section className="mystic-artifact-details__section">
            <h4>Recursos</h4>
            <div className="mystic-artifact-details__chips">
              {artifact.resources.map((resource) => <span key={resource.id}>{resource.name}: {resource.current ?? "por fijar"}/{resource.maximum ?? (resource.suggestedMaxFormula || "por fijar")}</span>)}
            </div>
          </section>
        ) : null}

        <section className="mystic-artifact-details__section">
          <h4>Capacidades</h4>
          <div className="mystic-artifact-details__abilities">
            {artifact.abilities.map((ability) => (
              <article key={ability.id}>
                <div className="row-actions">
                  <strong>{ability.name}</strong>
                  <span>{ability.actionCost ? ACTION_LABELS[ability.actionCost] : ability.activation === "passive" ? "Pasiva" : "Desencadenada"}</span>
                </div>
                <p>{ability.description}</p>
                <dl>
                  <div><dt>Corrupción</dt><dd>{ability.corruptionFormula || "Ninguna"}</dd></div>
                  <div><dt>Vínculo</dt><dd>{ability.requiresBinding ? "Necesario" : "No necesario"}</dd></div>
                  {ability.perSceneLimit ? <div><dt>Límite</dt><dd>{ability.perSceneLimit} por escena</dd></div> : null}
                </dl>
                {ability.rolls.length ? <p className="meta-text">Tiradas: {ability.rolls.map((roll) => `${roll.label}${roll.formula ? ` ${roll.formula}` : ""}${roll.opponentAttribute ? ` (${roll.actorAttribute} contra ${roll.opponentAttribute})` : roll.actorAttribute ? ` (${roll.actorAttribute})` : ""}`).join(" · ")}</p> : null}
                {ability.requirements.length ? <p className="meta-text">Requisitos: {ability.requirements.map((requirement) => requirement.type === "capability" ? `${requirement.capabilityName}${requirement.minimumLevel ? ` (${formatSkillLevelLabel(requirement.minimumLevel)})` : ""}` : requirement.description).join(" · ")}</p> : null}
                {ability.perSceneNote ? <p className="meta-text">{ability.perSceneNote}</p> : null}
              </article>
            ))}
            {artifact.abilities.length === 0 ? <p className="section-help">Este artefacto no tiene capacidades activables separadas.</p> : null}
          </div>
        </section>

        {artifact.sourceTitle && artifact.sourcePage ? (
          <footer className="mystic-artifact-details__footer">
            <div><strong>Referencia para el DJ</strong><span>El libro se abre directamente en la página donde se explica el artefacto.</span></div>
            <SourceReferenceButton
              source={artifact.sourceTitle}
              page={artifact.sourcePage}
              ariaLabel={`Abrir fuente · ${artifact.sourceTitle} p.${artifact.sourcePage}`}
              disabled={busy}
              onClick={() => void onOpenSource(artifact)}
            />
          </footer>
        ) : null}
      </article>
    </section>
  );
}
