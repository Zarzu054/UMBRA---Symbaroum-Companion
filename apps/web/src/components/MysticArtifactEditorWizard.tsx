import { useState } from "react";
import {
  mysticArtifactDefinitionInputSchema,
  type MysticArtifactDefinitionInput,
  type MysticArtifactPaymentType,
  type MysticArtifactWeaponTag
} from "@umbra/shared";

type Props = {
  initialValue: MysticArtifactDefinitionInput;
  title: string;
  busy?: boolean;
  externalError?: string | null;
  onCancel: () => void;
  onSave: (definition: MysticArtifactDefinitionInput) => Promise<void>;
};

type Ability = MysticArtifactDefinitionInput["abilities"][number];
type ArtifactRoll = Ability["rolls"][number];
type Requirement = Ability["requirements"][number];
type Resource = MysticArtifactDefinitionInput["resources"][number];

const ATTRIBUTES = ["agil", "atento", "diestro", "discreto", "fuerte", "inteligente", "persuasivo", "tenaz"] as const;
const ATTRIBUTE_LABELS: Record<(typeof ATTRIBUTES)[number], string> = {
  agil: "Ágil", atento: "Atento", diestro: "Diestro", discreto: "Discreto",
  fuerte: "Fuerte", inteligente: "Inteligente", persuasivo: "Persuasivo", tenaz: "Tenaz"
};
const WEAPON_TAGS: Array<[MysticArtifactWeaponTag, string]> = [
  ["one_handed", "Una mano"], ["short", "Corta"], ["long", "Larga"],
  ["heavy", "Pesada"], ["ranged", "A distancia"], ["thrown", "Arrojadiza"]
];
const STEPS = ["Narrativa", "Funcionamiento", "Recursos", "Capacidades"] as const;

function emptyAbility(): Ability {
  return {
    name: "Nueva capacidad",
    description: "",
    activation: "active",
    actionCost: "combat",
    corruptionFormula: "1D4",
    requiresBinding: true,
    perSceneNote: "",
    rolls: [],
    requirements: [],
    resourceCosts: []
  };
}

function emptyRoll(): ArtifactRoll {
  return { kind: "check", label: "Tirada", formula: "1D20", actorAttribute: "tenaz" };
}

function emptyRequirement(): Requirement {
  return { type: "capability", capabilityName: "", minimumLevel: "novato", description: "" };
}

function emptyResource(index: number): Resource {
  return { key: `recurso_${index + 1}`, name: "Nuevo recurso", suggestedMaxFormula: "", maximum: 1, current: 1 };
}

function resourceKeyFromName(name: string, fallbackIndex: number): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `recurso_${fallbackIndex + 1}`;
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : undefined;
}

function splitQualities(value: string): string[] {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function describeValidationError(error: unknown): string {
  if (typeof error === "object" && error && "issues" in error) {
    const issue = (error as { issues?: Array<{ path?: Array<string | number>; message?: string }> }).issues?.[0];
    if (issue) return `${issue.path?.join(" → ") || "Artefacto"}: ${issue.message ?? "valor no válido"}`;
  }
  return error instanceof Error ? error.message : "Revisa los datos del artefacto.";
}

export function MysticArtifactEditorWizard({ initialValue, title, busy = false, externalError, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<MysticArtifactDefinitionInput>(() => structuredClone(initialValue));
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isBusy = busy || saving;

  function updateDefinition(patch: Partial<MysticArtifactDefinitionInput>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function changeKind(kind: MysticArtifactDefinitionInput["kind"]): void {
    setDraft((current) => ({
      ...current,
      kind,
      weapon: kind === "weapon" ? current.weapon ?? {
        attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D8",
        tags: ["one_handed"], qualities: [], requiresBinding: true
      } : undefined,
      armor: kind === "armor" ? current.armor ?? {
        protectionFormula: "1D4", qualities: [], requiresBinding: true
      } : undefined
    }));
  }

  function togglePayment(paymentType: MysticArtifactPaymentType, enabled: boolean): void {
    setDraft((current) => ({
      ...current,
      bindingCosts: enabled
        ? current.bindingCosts.some((cost) => cost.paymentType === paymentType)
          ? current.bindingCosts
          : [...current.bindingCosts, { paymentType, amount: 1 }]
        : current.bindingCosts.filter((cost) => cost.paymentType !== paymentType)
    }));
  }

  function updatePayment(paymentType: MysticArtifactPaymentType, amount: number): void {
    setDraft((current) => ({
      ...current,
      bindingCosts: current.bindingCosts.map((cost) => cost.paymentType === paymentType ? { ...cost, amount: Math.max(0, Math.floor(amount || 0)) } : cost)
    }));
  }

  function updateResource(index: number, patch: Partial<Resource>): void {
    setDraft((current) => ({
      ...current,
      resources: current.resources.map((resource, resourceIndex) => resourceIndex === index ? { ...resource, ...patch } : resource)
    }));
  }

  function renameResource(index: number, name: string): void {
    setDraft((current) => {
      const resource = current.resources[index];
      if (!resource) return current;
      const baseKey = resourceKeyFromName(name, index);
      const occupiedKeys = new Set(current.resources.filter((_, resourceIndex) => resourceIndex !== index).map((entry) => entry.key));
      let nextKey = baseKey;
      let suffix = 2;
      while (occupiedKeys.has(nextKey)) {
        nextKey = `${baseKey}_${suffix}`;
        suffix += 1;
      }
      return {
        ...current,
        resources: current.resources.map((entry, resourceIndex) => resourceIndex === index ? { ...entry, name, key: nextKey } : entry),
        abilities: current.abilities.map((ability) => ({
          ...ability,
          resourceCosts: ability.resourceCosts.map((cost) => cost.resourceKey === resource.key ? { ...cost, resourceKey: nextKey } : cost)
        }))
      };
    });
  }

  function updateAbility(index: number, patch: Partial<Ability>): void {
    setDraft((current) => ({
      ...current,
      abilities: current.abilities.map((ability, abilityIndex) => abilityIndex === index ? { ...ability, ...patch } : ability)
    }));
  }

  function updateRoll(abilityIndex: number, rollIndex: number, patch: Partial<ArtifactRoll>): void {
    const ability = draft.abilities[abilityIndex];
    updateAbility(abilityIndex, { rolls: ability.rolls.map((roll, index) => index === rollIndex ? { ...roll, ...patch } : roll) });
  }

  function updateRequirement(abilityIndex: number, requirementIndex: number, requirement: Requirement): void {
    const ability = draft.abilities[abilityIndex];
    updateAbility(abilityIndex, { requirements: ability.requirements.map((entry, index) => index === requirementIndex ? requirement : entry) });
  }

  function validateStep(targetStep = step): boolean {
    setError(null);
    if (targetStep === 0 && draft.name.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres.");
      return false;
    }
    if (targetStep === 1 && draft.bindingCosts.length === 0) {
      setError("Selecciona al menos una forma de pago para el vínculo.");
      return false;
    }
    if (targetStep === 2) {
      const keys = draft.resources.map((resource) => resource.key.trim());
      if (keys.some((key) => !/^[a-z0-9][a-z0-9_-]*$/.test(key)) || new Set(keys).size !== keys.length) {
        setError("Cada recurso necesita un identificador interno único, en minúsculas y sin espacios.");
        return false;
      }
      if (draft.resources.some((resource) => resource.maximum === undefined || resource.current === undefined || resource.current > resource.maximum)) {
        setError("Cada recurso necesita máximo y valor actual; el actual no puede superar el máximo.");
        return false;
      }
    }
    return true;
  }

  function goNext(): void {
    if (validateStep()) setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function submit(): Promise<void> {
    try {
      setError(null);
      const parsed = mysticArtifactDefinitionInputSchema.parse(draft);
      setSaving(true);
      await onSave(parsed);
    } catch (submitError) {
      setError(describeValidationError(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel modal-panel mystic-artifact-wizard" onClick={(event) => event.stopPropagation()}>
      <div className="row-actions mystic-artifact-wizard__header">
        <div>
          <h3>{title}</h3>
          <p className="section-help">Paso {step + 1} de {STEPS.length}: {STEPS[step]}</p>
        </div>
        <button type="button" className="subtle-button" disabled={isBusy} onClick={onCancel}>Cerrar</button>
      </div>

      <nav className="mystic-artifact-wizard__steps" aria-label="Pasos del creador de artefactos">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`${index === step ? "is-active" : ""}${index < step ? " is-complete" : ""}`}
            disabled={isBusy || index > step + 1}
            onClick={() => {
              if (index < step || validateStep()) setStep(index);
            }}
          >
            <span>{index + 1}</span>{label}
          </button>
        ))}
      </nav>

      {(error || externalError) ? <p className="error-text">{error || externalError}</p> : null}

      <div className="mystic-artifact-wizard__body">
        {step === 0 ? (
          <section className="mystic-artifact-wizard__section">
            <div className="mystic-artifact-wizard__intro">
              <h4>Identidad e historia</h4>
              <p className="section-help">Define qué es el artefacto y cómo se presenta en la ficción. Los jugadores no verán esta información completa hasta vincularse.</p>
            </div>
            <div className="form-grid">
              <label className="field"><span>Nombre *</span><input autoFocus value={draft.name} onChange={(event) => updateDefinition({ name: event.target.value })} /></label>
              <label className="field"><span>Tipo *</span><select value={draft.kind} onChange={(event) => changeKind(event.target.value as MysticArtifactDefinitionInput["kind"])}><option value="object">Objeto</option><option value="weapon">Arma</option><option value="armor">Armadura</option></select></label>
              <label className="field"><span>Libro o aventura</span><input value={draft.sourceTitle} placeholder="Creación de campaña" onChange={(event) => updateDefinition({ sourceTitle: event.target.value })} /></label>
              <label className="field"><span>Página</span><input type="number" min={1} value={draft.sourcePage ?? ""} onChange={(event) => updateDefinition({ sourcePage: numberOrUndefined(event.target.value) })} /></label>
            </div>
            <label className="field"><span>Descripción narrativa</span><textarea rows={9} value={draft.description} placeholder="Aspecto, origen, leyendas, anteriores propietarios..." onChange={(event) => updateDefinition({ description: event.target.value })} /></label>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="mystic-artifact-wizard__section">
            <div className="mystic-artifact-wizard__intro"><h4>Vínculo y perfil principal</h4><p className="section-help">Configura el precio del vínculo y, si corresponde, cómo funciona como arma o armadura.</p></div>
            <div className="mystic-artifact-wizard__subsection">
              <h5>Opciones de pago</h5>
              {(["xp", "permanent_corruption"] as MysticArtifactPaymentType[]).map((paymentType) => {
                const cost = draft.bindingCosts.find((entry) => entry.paymentType === paymentType);
                return <div key={paymentType} className="mystic-artifact-wizard__toggle-row">
                  <label><input type="checkbox" checked={Boolean(cost)} onChange={(event) => togglePayment(paymentType, event.target.checked)} /> {paymentType === "xp" ? "Permitir pago con PX" : "Permitir pago con Corrupción permanente"}</label>
                  {cost ? <label className="field compact"><span>Cantidad</span><input type="number" min={0} max={1000} value={cost.amount} onChange={(event) => updatePayment(paymentType, Number(event.target.value))} /></label> : null}
                </div>;
              })}
            </div>

            {draft.kind === "weapon" && draft.weapon ? (
              <div className="mystic-artifact-wizard__subsection">
                <h5>Perfil de arma</h5>
                <div className="form-grid">
                  <label className="field"><span>Atributo de ataque</span><select value={draft.weapon.attackAttribute} onChange={(event) => updateDefinition({ weapon: { ...draft.weapon!, attackAttribute: event.target.value as typeof draft.weapon.attackAttribute } })}>{ATTRIBUTES.map((attribute) => <option key={attribute} value={attribute}>{ATTRIBUTE_LABELS[attribute]}</option>)}</select></label>
                  <label className="field"><span>Tirada de ataque</span><input value={draft.weapon.attackFormula} onChange={(event) => updateDefinition({ weapon: { ...draft.weapon!, attackFormula: event.target.value } })} /></label>
                  <label className="field"><span>Daño</span><input value={draft.weapon.damageFormula} placeholder="1D8" onChange={(event) => updateDefinition({ weapon: { ...draft.weapon!, damageFormula: event.target.value } })} /></label>
                  <label className="field"><span>Cualidades, separadas por comas</span><input value={draft.weapon.qualities.join(", ")} onChange={(event) => updateDefinition({ weapon: { ...draft.weapon!, qualities: splitQualities(event.target.value) } })} /></label>
                </div>
                <div className="mystic-artifact-wizard__checks"><span>Categorías</span>{WEAPON_TAGS.map(([tag, label]) => <label key={tag}><input type="checkbox" checked={draft.weapon!.tags.includes(tag)} onChange={(event) => updateDefinition({ weapon: { ...draft.weapon!, tags: event.target.checked ? [...draft.weapon!.tags, tag] : draft.weapon!.tags.filter((entry) => entry !== tag) } })} /> {label}</label>)}</div>
                <label><input type="checkbox" checked={draft.weapon.requiresBinding} onChange={(event) => updateDefinition({ weapon: { ...draft.weapon!, requiresBinding: event.target.checked } })} /> Solo puede usarse como arma después del vínculo</label>
              </div>
            ) : null}

            {draft.kind === "armor" && draft.armor ? (
              <div className="mystic-artifact-wizard__subsection">
                <h5>Perfil de armadura</h5>
                <div className="form-grid">
                  <label className="field"><span>Protección</span><input value={draft.armor.protectionFormula} placeholder="1D4" onChange={(event) => updateDefinition({ armor: { ...draft.armor!, protectionFormula: event.target.value } })} /></label>
                  <label className="field"><span>Cualidades, separadas por comas</span><input value={draft.armor.qualities.join(", ")} onChange={(event) => updateDefinition({ armor: { ...draft.armor!, qualities: splitQualities(event.target.value) } })} /></label>
                </div>
                <label><input type="checkbox" checked={draft.armor.requiresBinding} onChange={(event) => updateDefinition({ armor: { ...draft.armor!, requiresBinding: event.target.checked } })} /> Solo puede usarse como armadura después del vínculo</label>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="mystic-artifact-wizard__section">
            <div className="row-actions mystic-artifact-wizard__intro"><div><h4>Recursos y medidores</h4><p className="section-help">Añade cargas, gotas, energía u otros recursos consumidos por las capacidades. Este paso es opcional.</p></div><button type="button" onClick={() => updateDefinition({ resources: [...draft.resources, emptyResource(draft.resources.length)] })}>Añadir recurso</button></div>
            <div className="mystic-artifact-wizard__stack">
              {draft.resources.map((resource, index) => <article key={`${resource.key}-${index}`} className="mystic-artifact-wizard__item">
                <div className="row-actions"><h5>Recurso {index + 1}</h5><button type="button" className="subtle-button" onClick={() => updateDefinition({ resources: draft.resources.filter((_, resourceIndex) => resourceIndex !== index), abilities: draft.abilities.map((ability) => ({ ...ability, resourceCosts: ability.resourceCosts.filter((cost) => cost.resourceKey !== resource.key) })) })}>Quitar</button></div>
                <div className="form-grid">
                  <label className="field"><span>Nombre</span><input value={resource.name} onChange={(event) => renameResource(index, event.target.value)} /></label>
                  <label className="field"><span>Referencia variable</span><input value={resource.suggestedMaxFormula} placeholder="Ej. 1D10 gotas" onChange={(event) => updateResource(index, { suggestedMaxFormula: event.target.value })} /></label>
                  <label className="field"><span>Máximo numérico</span><input type="number" min={0} max={9999} value={resource.maximum ?? ""} onChange={(event) => updateResource(index, { maximum: numberOrUndefined(event.target.value) })} /></label>
                  <label className="field"><span>Valor actual</span><input type="number" min={0} max={resource.maximum ?? 9999} value={resource.current ?? ""} onChange={(event) => updateResource(index, { current: numberOrUndefined(event.target.value) })} /></label>
                </div>
              </article>)}
              {draft.resources.length === 0 ? <p className="section-help">Este artefacto no utiliza medidores.</p> : null}
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="mystic-artifact-wizard__section">
            <div className="row-actions mystic-artifact-wizard__intro"><div><h4>Capacidades</h4><p className="section-help">Define qué puede hacer el artefacto, qué cuesta activarlo y qué tiradas o requisitos utiliza.</p></div><button type="button" onClick={() => updateDefinition({ abilities: [...draft.abilities, emptyAbility()] })}>Añadir capacidad</button></div>
            <div className="mystic-artifact-wizard__stack">
              {draft.abilities.map((ability, abilityIndex) => <article key={abilityIndex} className="mystic-artifact-wizard__item is-ability">
                <div className="row-actions"><h5>{ability.name || `Capacidad ${abilityIndex + 1}`}</h5><button type="button" className="subtle-button" onClick={() => updateDefinition({ abilities: draft.abilities.filter((_, index) => index !== abilityIndex) })}>Quitar capacidad</button></div>
                <div className="form-grid">
                  <label className="field"><span>Nombre *</span><input value={ability.name} onChange={(event) => updateAbility(abilityIndex, { name: event.target.value })} /></label>
                  <label className="field"><span>Tipo</span><select value={ability.activation} onChange={(event) => updateAbility(abilityIndex, { activation: event.target.value as Ability["activation"] })}><option value="active">Activa</option><option value="passive">Pasiva</option><option value="triggered">Desencadenada</option></select></label>
                  <label className="field"><span>Acción</span><select value={ability.actionCost ?? ""} onChange={(event) => updateAbility(abilityIndex, { actionCost: (event.target.value || undefined) as Ability["actionCost"] })}><option value="">No aplicable</option><option value="free">Gratuita</option><option value="movement">Movimiento</option><option value="combat">Combate</option><option value="reaction">Reacción</option></select></label>
                  <label className="field"><span>Corrupción por uso</span><input value={ability.corruptionFormula} placeholder="1D4 o Ninguna" onChange={(event) => updateAbility(abilityIndex, { corruptionFormula: event.target.value })} /></label>
                  <label className="field"><span>Límite por escena</span><input type="number" min={1} value={ability.perSceneLimit ?? ""} placeholder="Sin límite" onChange={(event) => updateAbility(abilityIndex, { perSceneLimit: numberOrUndefined(event.target.value) })} /></label>
                  <label className="field"><span>Nota del límite</span><input value={ability.perSceneNote} onChange={(event) => updateAbility(abilityIndex, { perSceneNote: event.target.value })} /></label>
                </div>
                <label className="field"><span>Descripción y efecto</span><textarea rows={4} value={ability.description} onChange={(event) => updateAbility(abilityIndex, { description: event.target.value })} /></label>
                <label><input type="checkbox" checked={ability.requiresBinding} onChange={(event) => updateAbility(abilityIndex, { requiresBinding: event.target.checked })} /> Requiere vínculo para utilizarse</label>

                <div className="mystic-artifact-wizard__nested">
                  <div className="row-actions"><h6>Tiradas ordenadas</h6><button type="button" onClick={() => updateAbility(abilityIndex, { rolls: [...ability.rolls, emptyRoll()] })}>Añadir tirada</button></div>
                  {ability.rolls.map((roll, rollIndex) => <div key={rollIndex} className="mystic-artifact-wizard__nested-item">
                    <div className="form-grid">
                      <label className="field"><span>Clase</span><select value={roll.kind} onChange={(event) => updateRoll(abilityIndex, rollIndex, { kind: event.target.value as ArtifactRoll["kind"] })}><option value="check">Prueba</option><option value="attack">Ataque</option><option value="damage">Daño</option><option value="armor">Armadura</option><option value="healing">Curación</option><option value="custom">Personalizada</option></select></label>
                      <label className="field"><span>Etiqueta</span><input value={roll.label} onChange={(event) => updateRoll(abilityIndex, rollIndex, { label: event.target.value })} /></label>
                      <label className="field"><span>Fórmula</span><input value={roll.formula} placeholder="1D20, 1D8..." onChange={(event) => updateRoll(abilityIndex, rollIndex, { formula: event.target.value })} /></label>
                      <label className="field"><span>Atributo propio</span><select value={roll.actorAttribute ?? ""} onChange={(event) => updateRoll(abilityIndex, rollIndex, { actorAttribute: (event.target.value || undefined) as ArtifactRoll["actorAttribute"] })}><option value="">Ninguno</option>{ATTRIBUTES.map((attribute) => <option key={attribute} value={attribute}>{ATTRIBUTE_LABELS[attribute]}</option>)}</select></label>
                      <label className="field"><span>Atributo enfrentado</span><select value={roll.opponentAttribute ?? ""} onChange={(event) => updateRoll(abilityIndex, rollIndex, { opponentAttribute: (event.target.value || undefined) as ArtifactRoll["opponentAttribute"] })}><option value="">Ninguno</option>{ATTRIBUTES.map((attribute) => <option key={attribute} value={attribute}>{ATTRIBUTE_LABELS[attribute]}</option>)}</select></label>
                      <label className="field"><span>Objetivo fijo</span><input type="number" min={1} max={99} value={roll.fixedTarget ?? ""} onChange={(event) => updateRoll(abilityIndex, rollIndex, { fixedTarget: numberOrUndefined(event.target.value) })} /></label>
                    </div>
                    <button type="button" className="text-button" onClick={() => updateAbility(abilityIndex, { rolls: ability.rolls.filter((_, index) => index !== rollIndex) })}>Quitar tirada</button>
                  </div>)}
                </div>

                <div className="mystic-artifact-wizard__nested">
                  <div className="row-actions"><h6>Requisitos</h6><button type="button" onClick={() => updateAbility(abilityIndex, { requirements: [...ability.requirements, emptyRequirement()] })}>Añadir requisito</button></div>
                  {ability.requirements.map((requirement, requirementIndex) => <div key={requirementIndex} className="mystic-artifact-wizard__nested-item">
                    <div className="form-grid">
                      <label className="field"><span>Tipo</span><select value={requirement.type} onChange={(event) => updateRequirement(abilityIndex, requirementIndex, event.target.value === "capability" ? { type: "capability", capabilityName: "", minimumLevel: "novato", description: "" } : { type: "narrative", capabilityName: "", description: "" })}><option value="capability">Habilidad comprobable</option><option value="narrative">Condición narrativa</option></select></label>
                      {requirement.type === "capability" ? <><label className="field"><span>Habilidad necesaria</span><input value={requirement.capabilityName} onChange={(event) => updateRequirement(abilityIndex, requirementIndex, { ...requirement, capabilityName: event.target.value })} /></label><label className="field"><span>Nivel mínimo</span><select value={requirement.minimumLevel ?? ""} onChange={(event) => updateRequirement(abilityIndex, requirementIndex, { ...requirement, minimumLevel: (event.target.value || undefined) as Requirement["minimumLevel"] })}><option value="">Cualquiera</option><option value="novato">Principiante</option><option value="adepto">Adepto</option><option value="maestro">Maestro</option></select></label></> : null}
                      <label className="field"><span>{requirement.type === "narrative" ? "Condición" : "Explicación"}</span><input value={requirement.description} onChange={(event) => updateRequirement(abilityIndex, requirementIndex, { ...requirement, description: event.target.value })} /></label>
                    </div>
                    <button type="button" className="text-button" onClick={() => updateAbility(abilityIndex, { requirements: ability.requirements.filter((_, index) => index !== requirementIndex) })}>Quitar requisito</button>
                  </div>)}
                </div>

                {draft.resources.length > 0 ? <div className="mystic-artifact-wizard__nested"><h6>Consumo de recursos</h6>{draft.resources.map((resource) => {
                  const cost = ability.resourceCosts.find((entry) => entry.resourceKey === resource.key);
                  return <div key={resource.key} className="mystic-artifact-wizard__toggle-row"><label><input type="checkbox" checked={Boolean(cost)} onChange={(event) => updateAbility(abilityIndex, { resourceCosts: event.target.checked ? [...ability.resourceCosts, { resourceKey: resource.key, amount: 1 }] : ability.resourceCosts.filter((entry) => entry.resourceKey !== resource.key) })} /> Consume {resource.name}</label>{cost ? <label className="field compact"><span>Cantidad</span><input type="number" min={1} max={999} value={cost.amount} onChange={(event) => updateAbility(abilityIndex, { resourceCosts: ability.resourceCosts.map((entry) => entry.resourceKey === resource.key ? { ...entry, amount: Math.max(1, Number(event.target.value) || 1) } : entry) })} /></label> : null}</div>;
                })}</div> : null}
              </article>)}
              {draft.abilities.length === 0 ? <p className="section-help">Este artefacto no tiene capacidades propias. Aún puede funcionar como arma o armadura.</p> : null}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="mystic-artifact-wizard__footer">
        <button type="button" className="subtle-button" disabled={isBusy || step === 0} onClick={() => { setError(null); setStep((current) => Math.max(0, current - 1)); }}>Anterior</button>
        <span className="meta-text">{draft.name || "Artefacto sin nombre"}</span>
        {step < STEPS.length - 1
          ? <button type="button" disabled={isBusy} onClick={goNext}>Siguiente: {STEPS[step + 1]}</button>
          : <button type="button" disabled={isBusy} onClick={() => void submit()}>{isBusy ? "Guardando..." : "Guardar artefacto"}</button>}
      </footer>
    </div>
  );
}
