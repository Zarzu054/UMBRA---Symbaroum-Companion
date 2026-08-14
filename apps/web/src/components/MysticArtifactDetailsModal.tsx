import { useId } from "react";
import {
  formatSkillLevelLabel,
  type MysticArtifact,
  type MysticArtifactPaymentType
} from "@umbra/shared";
import { SourceReferenceButton } from "./SourceReferenceLink";

type Props = {
  artifact: MysticArtifact;
  campaignName?: string;
  availableExperience?: number;
  busy?: boolean;
  onClose: () => void;
  onBind?: (artifactId: string, paymentType: MysticArtifactPaymentType) => Promise<void>;
  onOpenSource?: (artifact: MysticArtifact) => Promise<void>;
};

const ACTION_LABELS = { free: "Gratuita", movement: "Movimiento", combat: "Activa", reaction: "Reacción" } as const;
const ACTIVATION_LABELS = { active: "Activa", passive: "Pasiva", triggered: "Desencadenada" } as const;
const ATTRIBUTE_LABELS = {
  agil: "Ágil",
  atento: "Atento",
  diestro: "Diestro",
  discreto: "Discreto",
  fuerte: "Fuerte",
  inteligente: "Inteligente",
  persuasivo: "Persuasivo",
  tenaz: "Tenaz"
} as const;
const KIND_LABELS = { weapon: "Arma", armor: "Armadura", object: "Objeto" } as const;
const ROLL_KIND_LABELS = { check: "Prueba", attack: "Ataque", damage: "Daño", armor: "Armadura", healing: "Curación", custom: "Especial" } as const;
const TAG_LABELS = { one_handed: "Una mano", short: "Corta", long: "Larga", heavy: "Pesada", ranged: "A distancia", thrown: "Arrojadiza" } as const;

function formatBindingCost(paymentType: MysticArtifactPaymentType, amount: number): string {
  return paymentType === "xp" ? `${amount} PX` : `${amount} Corrupción permanente`;
}

function formatBindingPayment(artifact: MysticArtifact): string {
  if (artifact.bindingPaymentType === "xp") return `${artifact.bindingPaymentAmount ?? 0} PX`;
  if (artifact.bindingPaymentType === "permanent_corruption") return `${artifact.bindingPaymentAmount ?? 0} Corrupción permanente`;
  if (artifact.bindingPaymentType === "narrative") return "Vínculo narrativo";
  return "No consta";
}

function formatArtifactDate(value: string | null): string {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("es-ES");
}

export function MysticArtifactDetailsModal({
  artifact,
  campaignName,
  availableExperience,
  busy = false,
  onClose,
  onBind,
  onOpenSource
}: Props) {
  const titleId = useId();
  const resourceNames = new Map(artifact.resources.map((resource) => [resource.key, resource.name]));
  const bindingCostLabel = artifact.bindingCosts
    .map((cost) => formatBindingCost(cost.paymentType, cost.amount))
    .join(" o ");
  const concealedUntilBinding = !artifact.isBound
    && !artifact.description
    && !artifact.weapon
    && !artifact.armor
    && artifact.abilities.length === 0;

  return (
    <section className="modal-backdrop" onClick={() => !busy && onClose()}>
      <article
        className="panel modal-panel mystic-artifact-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mystic-artifact-details__header">
          <div>
            <span className="eyebrow">{KIND_LABELS[artifact.kind]}{campaignName ? ` · ${campaignName}` : ""}</span>
            <h3 id={titleId}>{artifact.name}</h3>
            <p className="section-help">{artifact.sourceTitle || "Creación de campaña"}{artifact.sourcePage ? ` · p.${artifact.sourcePage}` : ""}</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose}>Cerrar</button>
        </header>

        <p className="mystic-artifact-details__description">
          {artifact.description || (concealedUntilBinding
            ? "Los detalles protegidos de este artefacto se revelarán al completar el vínculo."
            : "Sin descripción narrativa.")}
        </p>

        <div className="mystic-artifact-details__summary">
          <div><strong>Estado del vínculo</strong><span>{artifact.isBound ? "Vinculado" : "Sin vincular"}</span></div>
          <div><strong>Opciones de vínculo</strong><span>{bindingCostLabel || "Sin coste configurado"}</span></div>
          {artifact.isBound ? <div><strong>Pago realizado</strong><span>{formatBindingPayment(artifact)}</span></div> : null}
          {artifact.isBound ? <div><strong>Fecha del vínculo</strong><span>{formatArtifactDate(artifact.boundAt)}</span></div> : null}
          {artifact.weapon ? <div><strong>Ataque</strong><span>{artifact.weapon.attackFormula || "1D20"} con {ATTRIBUTE_LABELS[artifact.weapon.attackAttribute]}</span></div> : null}
          {artifact.weapon ? <div><strong>Daño</strong><span>{artifact.weapon.damageFormula || "Según arma"}</span></div> : null}
          {artifact.weapon ? <div><strong>Perfil disponible</strong><span>{artifact.weapon.requiresBinding ? "Requiere vínculo" : "No requiere vínculo"}</span></div> : null}
          {artifact.weapon?.tags.length ? <div><strong>Categorías</strong><span>{artifact.weapon.tags.map((tag) => TAG_LABELS[tag]).join(", ")}</span></div> : null}
          {artifact.weapon?.qualities.length ? <div><strong>Cualidades</strong><span>{artifact.weapon.qualities.join(", ")}</span></div> : null}
          {artifact.armor ? <div><strong>Protección</strong><span>{artifact.armor.protectionFormula || "Según armadura"}</span></div> : null}
          {artifact.armor ? <div><strong>Perfil disponible</strong><span>{artifact.armor.requiresBinding ? "Requiere vínculo" : "No requiere vínculo"}</span></div> : null}
          {artifact.armor?.qualities.length ? <div><strong>Cualidades</strong><span>{artifact.armor.qualities.join(", ")}</span></div> : null}
        </div>

        {artifact.resources.length ? (
          <section className="mystic-artifact-details__section">
            <h4>Recursos</h4>
            <div className="mystic-artifact-details__resources">
              {artifact.resources.map((resource) => (
                <article key={resource.id}>
                  <strong>{resource.name}</strong>
                  <span>{resource.current !== undefined && resource.maximum !== undefined ? `${resource.current}/${resource.maximum}` : "Valor por fijar"}</span>
                  {resource.suggestedMaxFormula ? <small>Máximo sugerido: {resource.suggestedMaxFormula}</small> : null}
                </article>
              ))}
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
                  <span className={ability.locked ? "is-locked" : ""}>{ability.locked ? "Bloqueada" : ability.actionCost ? ACTION_LABELS[ability.actionCost] : ACTIVATION_LABELS[ability.activation]}</span>
                </div>
                <p>{ability.description || "Sin descripción adicional."}</p>
                <dl>
                  <div><dt>Activación</dt><dd>{ACTIVATION_LABELS[ability.activation]}</dd></div>
                  {ability.actionCost ? <div><dt>Acción</dt><dd>{ACTION_LABELS[ability.actionCost]}</dd></div> : null}
                  <div><dt>Corrupción</dt><dd>{ability.corruptionFormula || "Ninguna"}</dd></div>
                  <div><dt>Vínculo</dt><dd>{ability.requiresBinding ? "Necesario" : "No necesario"}</dd></div>
                  {ability.perSceneLimit ? <div><dt>Límite</dt><dd>{ability.perSceneLimit} por escena</dd></div> : null}
                  {ability.resourceCosts.length ? (
                    <div>
                      <dt>Consume</dt>
                      <dd>{ability.resourceCosts.map((cost) => `${cost.amount} ${resourceNames.get(cost.resourceKey) ?? cost.resourceKey}`).join(" · ")}</dd>
                    </div>
                  ) : null}
                </dl>
                {ability.locked ? <p className="error-text">{ability.lockReason || "No se cumplen los requisitos."}</p> : null}
                {ability.rolls.length ? (
                  <div className="mystic-artifact-details__rolls">
                    <strong>Tiradas</strong>
                    {ability.rolls.map((roll) => (
                      <div key={roll.id}>
                        <b>{roll.label}</b>
                        <span>{ROLL_KIND_LABELS[roll.kind]}</span>
                        {roll.formula ? <span>Fórmula: {roll.formula}</span> : null}
                        {roll.actorAttribute ? <span>Atributo: {ATTRIBUTE_LABELS[roll.actorAttribute]}</span> : null}
                        {roll.opponentAttribute ? <span>Contra: {ATTRIBUTE_LABELS[roll.opponentAttribute]}</span> : null}
                        {roll.fixedTarget ? <span>Objetivo fijo: {roll.fixedTarget}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {ability.requirements.length ? (
                  <p className="meta-text">
                    Requisitos: {ability.requirements.map((requirement) => requirement.type === "capability"
                      ? `${requirement.capabilityName}${requirement.minimumLevel ? ` (${formatSkillLevelLabel(requirement.minimumLevel)})` : ""}${requirement.description ? ` — ${requirement.description}` : ""}`
                      : requirement.description).join(" · ")}
                  </p>
                ) : null}
                {ability.perSceneNote ? <p className="meta-text">{ability.perSceneNote}</p> : null}
              </article>
            ))}
            {artifact.abilities.length === 0 ? (
              <p className="section-help">
                {artifact.isBound ? "Este artefacto no tiene capacidades activables separadas." : "Las capacidades protegidas se revelarán al completar el vínculo."}
              </p>
            ) : null}
          </div>
        </section>

        {!artifact.isBound && onBind ? (
          <footer className="mystic-artifact-details__footer mystic-artifact-details__binding-footer">
            <div>
              <strong>Completar vínculo</strong>
              <span>Elige una de las formas de pago configuradas.{availableExperience !== undefined ? ` PX disponibles: ${availableExperience}.` : ""}</span>
            </div>
            <div className="toolbar">
              {artifact.bindingCosts.map((cost) => (
                <button
                  key={cost.paymentType}
                  type="button"
                  disabled={busy || (cost.paymentType === "xp" && availableExperience !== undefined && cost.amount > availableExperience)}
                  onClick={() => void onBind(artifact.id, cost.paymentType)}
                >
                  {busy ? "Vinculando..." : `Vincular por ${formatBindingCost(cost.paymentType, cost.amount)}`}
                </button>
              ))}
            </div>
          </footer>
        ) : null}

        {artifact.sourceTitle && artifact.sourcePage ? (
          <footer className="mystic-artifact-details__footer">
            <div>
              <strong>Referencia</strong>
              <span>{onOpenSource ? "El libro se abre directamente en la página del artefacto." : `${artifact.sourceTitle} · p.${artifact.sourcePage}`}</span>
            </div>
            {onOpenSource ? (
              <SourceReferenceButton
                source={artifact.sourceTitle}
                page={artifact.sourcePage}
                ariaLabel={`Abrir fuente · ${artifact.sourceTitle} p.${artifact.sourcePage}`}
                disabled={busy}
                onClick={() => void onOpenSource(artifact)}
              />
            ) : null}
          </footer>
        ) : null}
      </article>
    </section>
  );
}
