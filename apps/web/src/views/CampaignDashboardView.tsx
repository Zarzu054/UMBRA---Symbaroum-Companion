import { useEffect, useMemo, useState } from "react";
import {
  createCampaignNpcSchema,
  createCampaignSchema,
  type AuthUser,
  type Campaign,
  type CreateCampaignInput,
  type CreateCampaignNpcInput,
  type UpdateCampaignNpcInput
} from "@umbra/shared";
import {
  addCampaignMember,
  createCampaign,
  createCampaignNpc,
  deleteCampaignNpc,
  fetchCampaigns,
  generateCampaignNpc,
  grantCampaignExperience,
  linkCampaignCharacter,
  removeCampaignMember,
  unlinkCampaignCharacter,
  updateCampaign,
  updateCampaignNpc
} from "../services/campaignService";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
};

const emptyCampaignForm: CreateCampaignInput = {
  name: "",
  summary: "",
  setting: "",
  notes: ""
};

const emptyNpcForm: CreateCampaignNpcInput = {
  name: "",
  race: "",
  archetype: "",
  occupation: "",
  threat: "",
  summary: "",
  notes: "",
  statBlock: "",
  isGenerated: false
};

export function CampaignDashboardView({ user, ensureAccessToken }: Props) {
  const isDirector = user.role === "gm" || user.role === "superadmin";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [draft, setDraft] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
  const [npcForm, setNpcForm] = useState<CreateCampaignNpcInput>(emptyNpcForm);
  const [xpForm, setXpForm] = useState({ characterId: "", amount: 1, reason: "" });

  useEffect(() => {
    void refresh();
  }, []);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const availableUnlinkedCharacters = selectedCampaign?.availableCharacters.filter((entry) => !entry.linked) ?? [];

  useEffect(() => {
    if (!campaigns.length) {
      setSelectedCampaignId(null);
      return;
    }

    if (!selectedCampaignId || !campaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaign) {
      setDraft(emptyCampaignForm);
      setSelectedAvailableCharacterId("");
      setXpForm({ characterId: "", amount: 1, reason: "" });
      return;
    }

    setDraft({
      name: selectedCampaign.name,
      summary: selectedCampaign.summary,
      setting: selectedCampaign.setting,
      notes: selectedCampaign.notes
    });
    setSelectedAvailableCharacterId(availableUnlinkedCharacters[0]?.characterId ?? "");
    setXpForm((prev) => ({
      characterId: selectedCampaign.characters[0]?.characterId ?? prev.characterId,
      amount: prev.amount,
      reason: prev.reason
    }));
  }, [selectedCampaign, availableUnlinkedCharacters]);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      const data = await fetchCampaigns(token);
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las campanas");
    } finally {
      setIsLoading(false);
    }
  }

  function upsertCampaign(updated: Campaign): void {
    setCampaigns((current) => {
      const exists = current.some((entry) => entry.id === updated.id);
      if (!exists) return [updated, ...current];
      return current.map((entry) => (entry.id === updated.id ? updated : entry));
    });
    setSelectedCampaignId(updated.id);
  }

  async function handleCreateCampaign(): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const payload = createCampaignSchema.parse(campaignForm);
      const token = await ensureAccessToken();
      const created = await createCampaign(payload, token);
      upsertCampaign(created);
      setCampaignForm(emptyCampaignForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la campana");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCampaign(): Promise<void> {
    if (!selectedCampaign) return;
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await updateCampaign(selectedCampaign.id, draft, token);
      upsertCampaign(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la campana");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMember(): Promise<void> {
    if (!selectedCampaign || !memberEmail.trim()) return;
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await addCampaignMember(selectedCampaign.id, { email: memberEmail.trim() }, token);
      upsertCampaign(updated);
      setMemberEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el jugador");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveMember(memberId: string): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await removeCampaignMember(memberId, token);
      upsertCampaign(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el miembro");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLinkCharacter(): Promise<void> {
    if (!selectedCampaign || !selectedAvailableCharacterId) return;
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await linkCampaignCharacter(selectedCampaign.id, selectedAvailableCharacterId, token);
      upsertCampaign(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular el personaje");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnlinkCharacter(linkId: string): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await unlinkCampaignCharacter(linkId, token);
      upsertCampaign(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desvincular el personaje");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateNpc(): Promise<void> {
    if (!selectedCampaign) return;
    setError(null);
    setIsSaving(true);
    try {
      const payload = createCampaignNpcSchema.parse(npcForm);
      const token = await ensureAccessToken();
      const updated = await createCampaignNpc(selectedCampaign.id, payload, token);
      upsertCampaign(updated);
      setNpcForm(emptyNpcForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerateNpc(): Promise<void> {
    if (!selectedCampaign) return;
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await generateCampaignNpc(selectedCampaign.id, token);
      upsertCampaign(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateNpc(npcId: string, payload: UpdateCampaignNpcInput): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await updateCampaignNpc(npcId, payload, token);
      upsertCampaign(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteNpc(npcId: string): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await deleteCampaignNpc(npcId, token);
      upsertCampaign(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGrantXp(): Promise<void> {
    if (!selectedCampaign || !xpForm.characterId || !xpForm.reason.trim()) return;
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await grantCampaignExperience(
        selectedCampaign.id,
        {
          characterId: xpForm.characterId,
          amount: Number(xpForm.amount),
          reason: xpForm.reason.trim()
        },
        token
      );
      upsertCampaign(updated);
      setXpForm((prev) => ({ ...prev, reason: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo otorgar PX");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="campaigns-module">
      <section className="panel campaign-hero">
        <h2>Gestor de Campanas</h2>
        <p>
          Centraliza miembros, personajes vinculados, PNJs y reparto de experiencia para descargar al director de
          juego de trabajo administrativo.
        </p>
      </section>

      {error ? <section className="panel error-list"><p>{error}</p></section> : null}

      <div className="campaign-layout">
        <section className="panel campaign-sidebar-panel">
          <div className="row-actions">
            <h3>Campanas</h3>
            <button disabled={isLoading} onClick={() => void refresh()}>
              Recargar
            </button>
          </div>
          {isLoading ? <p>Cargando campanas...</p> : null}
          <div className="campaign-list">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                className={`campaign-list-item${selectedCampaignId === campaign.id ? " is-active" : ""}`}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <strong>{campaign.name}</strong>
                <span>{campaign.setting || "Sin ambientacion"}</span>
                <span>{campaign.members.length} miembros</span>
              </button>
            ))}
            {!isLoading && campaigns.length === 0 ? <p className="section-help">Aun no hay campanas accesibles.</p> : null}
          </div>

          {isDirector ? (
            <div className="campaign-create-form">
              <div className="section-title">Nueva campana</div>
              <label className="field">
                <span>Nombre</span>
                <input value={campaignForm.name} onChange={(event) => setCampaignForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Ambientacion</span>
                <input value={campaignForm.setting} onChange={(event) => setCampaignForm((prev) => ({ ...prev, setting: event.target.value }))} />
              </label>
              <label className="field">
                <span>Resumen</span>
                <textarea rows={3} value={campaignForm.summary} onChange={(event) => setCampaignForm((prev) => ({ ...prev, summary: event.target.value }))} />
              </label>
              <button disabled={isSaving} onClick={() => void handleCreateCampaign()}>
                Crear campana
              </button>
            </div>
          ) : null}
        </section>

        <section className="campaign-main">
          {selectedCampaign ? (
            <>
              <section className="panel">
                <div className="row-actions">
                  <div>
                    <h2>{selectedCampaign.name}</h2>
                    <p className="meta-text">
                      DJ: <strong>{selectedCampaign.gmEmail}</strong>
                    </p>
                  </div>
                  {isDirector ? (
                    <button disabled={isSaving} onClick={() => void handleSaveCampaign()}>
                      Guardar detalle
                    </button>
                  ) : null}
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Nombre</span>
                    <input
                      value={draft.name}
                      disabled={!isDirector}
                      onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Ambientacion</span>
                    <input
                      value={draft.setting}
                      disabled={!isDirector}
                      onChange={(event) => setDraft((prev) => ({ ...prev, setting: event.target.value }))}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Resumen</span>
                  <textarea
                    rows={3}
                    value={draft.summary}
                    disabled={!isDirector}
                    onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Notas del director</span>
                  <textarea
                    rows={5}
                    value={draft.notes}
                    disabled={!isDirector}
                    onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>
              </section>

              <section className="panel">
                <div className="row-actions">
                  <h3>Miembros</h3>
                  {isDirector ? (
                    <div className="inline-row campaign-inline-form">
                      <label className="field">
                        <span>Email del jugador</span>
                        <input value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} />
                      </label>
                      <button disabled={isSaving} onClick={() => void handleAddMember()}>
                        Agregar
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="cards">
                  {selectedCampaign.members.map((member) => (
                    <article key={member.id} className="card">
                      <strong>{member.email}</strong>
                      <span>{member.role === "gm" ? "Director" : "Jugador"}</span>
                      <span>Alta: {new Date(member.joinedAt).toLocaleDateString()}</span>
                      {isDirector && member.role !== "gm" ? (
                        <button disabled={isSaving} onClick={() => void handleRemoveMember(member.id)}>
                          Quitar
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="row-actions">
                  <h3>Personajes de la campana</h3>
                  {isDirector ? (
                    <div className="inline-row campaign-inline-form">
                      <label className="field">
                        <span>Personaje disponible</span>
                        <select
                          value={selectedAvailableCharacterId}
                          onChange={(event) => setSelectedAvailableCharacterId(event.target.value)}
                        >
                          {availableUnlinkedCharacters.length === 0 ? <option value="">Sin personajes disponibles</option> : null}
                          {availableUnlinkedCharacters.map((entry) => (
                            <option key={entry.characterId} value={entry.characterId}>
                              {entry.name} - {entry.ownerEmail}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button disabled={isSaving || !selectedAvailableCharacterId} onClick={() => void handleLinkCharacter()}>
                        Vincular
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="cards">
                  {selectedCampaign.characters.map((entry) => (
                    <article key={entry.id} className="card">
                      <strong>{entry.name}</strong>
                      <span>{entry.ownerEmail}</span>
                      <span>PX total: {entry.experienceTotal}</span>
                      <span>PX gastada: {entry.experienceSpent}</span>
                      {isDirector ? (
                        <button disabled={isSaving} onClick={() => void handleUnlinkCharacter(entry.id)}>
                          Desvincular
                        </button>
                      ) : null}
                    </article>
                  ))}
                  {selectedCampaign.characters.length === 0 ? <p className="section-help">Todavia no hay personajes vinculados.</p> : null}
                </div>

                {isDirector && selectedCampaign.characters.length > 0 ? (
                  <div className="campaign-xp-panel">
                    <div className="section-title">Otorgar experiencia</div>
                    <div className="form-grid">
                      <label className="field">
                        <span>Personaje</span>
                        <select value={xpForm.characterId} onChange={(event) => setXpForm((prev) => ({ ...prev, characterId: event.target.value }))}>
                          {selectedCampaign.characters.map((entry) => (
                            <option key={entry.characterId} value={entry.characterId}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>PX</span>
                        <input
                          type="number"
                          min={1}
                          value={xpForm.amount}
                          onChange={(event) => setXpForm((prev) => ({ ...prev, amount: Number(event.target.value || 1) }))}
                        />
                      </label>
                      <label className="field campaign-xp-reason">
                        <span>Motivo</span>
                        <input value={xpForm.reason} onChange={(event) => setXpForm((prev) => ({ ...prev, reason: event.target.value }))} />
                      </label>
                      <button disabled={isSaving} onClick={() => void handleGrantXp()}>
                        Conceder PX
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="panel">
                <div className="row-actions">
                  <h3>PNJs</h3>
                  {isDirector ? (
                    <button disabled={isSaving} onClick={() => void handleGenerateNpc()}>
                      Generar PNJ
                    </button>
                  ) : null}
                </div>

                {isDirector ? (
                  <div className="campaign-npc-form">
                    <div className="form-grid">
                      <label className="field">
                        <span>Nombre</span>
                        <input value={npcForm.name} onChange={(event) => setNpcForm((prev) => ({ ...prev, name: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Raza</span>
                        <input value={npcForm.race} onChange={(event) => setNpcForm((prev) => ({ ...prev, race: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Arquetipo</span>
                        <input value={npcForm.archetype} onChange={(event) => setNpcForm((prev) => ({ ...prev, archetype: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Ocupacion</span>
                        <input value={npcForm.occupation} onChange={(event) => setNpcForm((prev) => ({ ...prev, occupation: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Amenaza</span>
                        <input value={npcForm.threat} onChange={(event) => setNpcForm((prev) => ({ ...prev, threat: event.target.value }))} />
                      </label>
                    </div>
                    <label className="field">
                      <span>Resumen</span>
                      <textarea rows={2} value={npcForm.summary} onChange={(event) => setNpcForm((prev) => ({ ...prev, summary: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Bloque rapido</span>
                      <textarea rows={2} value={npcForm.statBlock} onChange={(event) => setNpcForm((prev) => ({ ...prev, statBlock: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Notas</span>
                      <textarea rows={3} value={npcForm.notes} onChange={(event) => setNpcForm((prev) => ({ ...prev, notes: event.target.value }))} />
                    </label>
                    <button disabled={isSaving} onClick={() => void handleCreateNpc()}>
                      Crear PNJ manual
                    </button>
                  </div>
                ) : null}

                <div className="campaign-npc-list">
                  {selectedCampaign.npcs.map((npc) => (
                    <CampaignNpcEditor
                      key={npc.id}
                      npc={npc}
                      editable={isDirector}
                      busy={isSaving}
                      onSave={handleUpdateNpc}
                      onDelete={handleDeleteNpc}
                    />
                  ))}
                  {selectedCampaign.npcs.length === 0 ? <p className="section-help">Todavia no hay PNJs registrados.</p> : null}
                </div>
              </section>

              <section className="panel">
                <h3>Historial de experiencia</h3>
                <div className="campaign-log-list">
                  {selectedCampaign.experienceLog.map((entry) => (
                    <article key={entry.id} className="card">
                      <strong>
                        +{entry.amount} PX para {entry.characterName}
                      </strong>
                      <span>{entry.reason}</span>
                      <span>
                        {entry.grantedByEmail} · {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </article>
                  ))}
                  {selectedCampaign.experienceLog.length === 0 ? (
                    <p className="section-help">Aun no hay concesiones de experiencia registradas.</p>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section className="panel">
              <h2>Sin campana seleccionada</h2>
              <p>Elige una campana en la columna lateral o crea una nueva si eres director.</p>
            </section>
          )}
        </section>
      </div>
    </section>
  );
}

type CampaignNpcEditorProps = {
  npc: Campaign["npcs"][number];
  editable: boolean;
  busy: boolean;
  onSave: (npcId: string, payload: UpdateCampaignNpcInput) => Promise<void>;
  onDelete: (npcId: string) => Promise<void>;
};

function CampaignNpcEditor({ npc, editable, busy, onSave, onDelete }: CampaignNpcEditorProps) {
  const [draft, setDraft] = useState<UpdateCampaignNpcInput>(npc);

  useEffect(() => {
    setDraft(npc);
  }, [npc]);

  return (
    <article className="card campaign-npc-card">
      <div className="form-grid">
        <label className="field">
          <span>Nombre</span>
          <input value={draft.name ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
        </label>
        <label className="field">
          <span>Raza</span>
          <input value={draft.race ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, race: event.target.value }))} />
        </label>
        <label className="field">
          <span>Arquetipo</span>
          <input value={draft.archetype ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, archetype: event.target.value }))} />
        </label>
        <label className="field">
          <span>Ocupacion</span>
          <input value={draft.occupation ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, occupation: event.target.value }))} />
        </label>
        <label className="field">
          <span>Amenaza</span>
          <input value={draft.threat ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, threat: event.target.value }))} />
        </label>
      </div>
      <label className="field">
        <span>Resumen</span>
        <textarea rows={2} value={draft.summary ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))} />
      </label>
      <label className="field">
        <span>Bloque rapido</span>
        <textarea rows={2} value={draft.statBlock ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, statBlock: event.target.value }))} />
      </label>
      <label className="field">
        <span>Notas</span>
        <textarea rows={3} value={draft.notes ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
      </label>
      <div className="card-actions">
        <span>{npc.isGenerated ? "Generado" : "Manual"}</span>
        {editable ? (
          <>
            <button disabled={busy} onClick={() => void onSave(npc.id, draft)}>
              Guardar PNJ
            </button>
            <button className="danger" disabled={busy} onClick={() => void onDelete(npc.id)}>
              Eliminar PNJ
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
