import { useEffect, useMemo, useState } from "react";
import {
  createCampaignNpcSchema,
  createCampaignSchema,
  createCampaignSessionSchema,
  type AuthUser,
  type Campaign,
  type CreateCampaignInput,
  type CreateCampaignNpcInput,
  type CreateCampaignSessionInput,
  type UpdateCampaignNpcInput,
  type UpdateCampaignSessionInput
} from "@umbra/shared";
import {
  addCampaignMember,
  assignCampaignSessionExperience,
  createCampaign,
  createCampaignNpc,
  createCampaignSession,
  deleteCampaignNpc,
  fetchCampaigns,
  generateCampaignNpc,
  grantCampaignExperience,
  linkCampaignCharacter,
  removeCampaignMember,
  unlinkCampaignCharacter,
  updateCampaign,
  updateCampaignNpc,
  updateCampaignSession
} from "../services/campaignService";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
};

type CampaignHashState = {
  campaignId: string | null;
  sessionId: string | null;
};

const emptyCampaignForm: CreateCampaignInput = { name: "", summary: "", setting: "", notes: "" };
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
const emptySessionForm: CreateCampaignSessionInput = {
  title: "",
  scheduledFor: new Date().toISOString(),
  location: "",
  summary: "",
  publicNotes: "",
  dmNotes: "",
  status: "planned"
};

function toLocalDateTimeValue(value: string): string {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeValue(value: string): string {
  return new Date(value).toISOString();
}

function makeDefaultSessionForm(): CreateCampaignSessionInput {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(20, 0, 0, 0);
  return { ...emptySessionForm, scheduledFor: date.toISOString() };
}

function parseCampaignHash(): CampaignHashState {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash.startsWith("campaigns")) {
    return { campaignId: null, sessionId: null };
  }

  const [, search = ""] = rawHash.split("?");
  const params = new URLSearchParams(search);
  return {
    campaignId: params.get("id"),
    sessionId: params.get("session")
  };
}

function replaceCampaignHash(campaignId: string | null, sessionId: string | null): void {
  const params = new URLSearchParams();
  if (campaignId) {
    params.set("id", campaignId);
  }
  if (sessionId) {
    params.set("session", sessionId);
  }

  const nextHash = params.toString() ? `#campaigns?${params.toString()}` : "#campaigns";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function getMatchingSessionId(campaign: Campaign, draft: CreateCampaignSessionInput): string | null {
  const matches = campaign.sessions.filter((session) => {
    return (
      session.title === draft.title &&
      session.scheduledFor === draft.scheduledFor &&
      session.location === draft.location &&
      session.summary === draft.summary &&
      session.publicNotes === draft.publicNotes &&
      session.dmNotes === draft.dmNotes &&
      session.status === draft.status
    );
  });

  return matches[0]?.id ?? campaign.sessions[0]?.id ?? null;
}

export function CampaignDashboardView({ user, ensureAccessToken }: Props) {
  const isDirector = user.role === "gm" || user.role === "superadmin";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [draft, setDraft] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
  const [npcForm, setNpcForm] = useState<CreateCampaignNpcInput>(emptyNpcForm);
  const [xpForm, setXpForm] = useState({ characterId: "", amount: 1, reason: "" });
  const [sessionForm, setSessionForm] = useState<CreateCampaignSessionInput>(makeDefaultSessionForm());
  const [sessionXpDraft, setSessionXpDraft] = useState<Record<string, number>>({});

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );
  const selectedSession = useMemo(
    () => selectedCampaign?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedCampaign, selectedSessionId]
  );
  const availableUnlinkedCharacters = selectedCampaign?.availableCharacters.filter((entry) => !entry.linked) ?? [];

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function syncSelectionFromHash(): void {
      const { campaignId, sessionId } = parseCampaignHash();
      setSelectedCampaignId(campaignId);
      setSelectedSessionId(sessionId);
    }

    syncSelectionFromHash();
    window.addEventListener("hashchange", syncSelectionFromHash);
    return () => window.removeEventListener("hashchange", syncSelectionFromHash);
  }, []);

  useEffect(() => {
    if (campaigns.length === 0) {
      if (selectedCampaignId !== null) {
        setSelectedCampaignId(null);
      }
      return;
    }

    if (selectedCampaignId && campaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      return;
    }

    const hashState = parseCampaignHash();
    const fallbackCampaignId =
      hashState.campaignId && campaigns.some((campaign) => campaign.id === hashState.campaignId)
        ? hashState.campaignId
        : campaigns[0].id;
    setSelectedCampaignId(fallbackCampaignId);
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaign) {
      if (selectedSessionId !== null) {
        setSelectedSessionId(null);
      }
      return;
    }

    if (selectedSessionId && selectedCampaign.sessions.some((session) => session.id === selectedSessionId)) {
      return;
    }

    const hashState = parseCampaignHash();
    const fallbackSessionId =
      hashState.sessionId && selectedCampaign.sessions.some((session) => session.id === hashState.sessionId)
        ? hashState.sessionId
        : selectedCampaign.sessions[0]?.id ?? null;
    setSelectedSessionId(fallbackSessionId);
  }, [selectedCampaign, selectedSessionId]);

  useEffect(() => {
    replaceCampaignHash(selectedCampaignId, selectedSessionId);
  }, [selectedCampaignId, selectedSessionId]);

  useEffect(() => {
    if (!selectedCampaign) {
      setDraft(emptyCampaignForm);
      setSelectedAvailableCharacterId("");
      setXpForm({ characterId: "", amount: 1, reason: "" });
      setSessionForm(makeDefaultSessionForm());
      setSessionXpDraft({});
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
      characterId: selectedCampaign.characters.some((entry) => entry.characterId === prev.characterId)
        ? prev.characterId
        : (selectedCampaign.characters[0]?.characterId ?? ""),
      amount: prev.amount,
      reason: prev.reason
    }));
  }, [availableUnlinkedCharacters, selectedCampaign]);

  useEffect(() => {
    if (!selectedSession || !selectedCampaign) {
      setSessionForm(makeDefaultSessionForm());
      setSessionXpDraft(Object.fromEntries((selectedCampaign?.characters ?? []).map((entry) => [entry.characterId, 0])));
      return;
    }

    setSessionForm({
      title: selectedSession.title,
      scheduledFor: selectedSession.scheduledFor,
      location: selectedSession.location,
      summary: selectedSession.summary,
      publicNotes: selectedSession.publicNotes,
      dmNotes: selectedSession.dmNotes,
      status: selectedSession.status
    });
    setSessionXpDraft(Object.fromEntries(selectedCampaign.characters.map((entry) => [entry.characterId, 0])));
  }, [selectedCampaign, selectedSession]);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      setCampaigns(await fetchCampaigns(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las campañas");
    } finally {
      setIsLoading(false);
    }
  }

  function upsertCampaign(updated: Campaign): void {
    setCampaigns((current) => {
      if (current.some((entry) => entry.id === updated.id)) {
        return current.map((entry) => (entry.id === updated.id ? updated : entry));
      }
      return [updated, ...current];
    });
    setSelectedCampaignId(updated.id);
  }
  async function handleCreateCampaign(): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const created = await createCampaign(createCampaignSchema.parse(campaignForm), token);
      upsertCampaign(created);
      setCampaignForm(emptyCampaignForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la campaña");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCampaign(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await updateCampaign(selectedCampaign.id, draft, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la campaña");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMember(): Promise<void> {
    if (!selectedCampaign || !memberEmail.trim()) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await addCampaignMember(selectedCampaign.id, { email: memberEmail.trim() }, token));
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
      upsertCampaign(await removeCampaignMember(memberId, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el miembro");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLinkCharacter(): Promise<void> {
    if (!selectedCampaign || !selectedAvailableCharacterId) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await linkCampaignCharacter(selectedCampaign.id, selectedAvailableCharacterId, token));
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
      upsertCampaign(await unlinkCampaignCharacter(linkId, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desvincular el personaje");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateNpc(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await createCampaignNpc(selectedCampaign.id, createCampaignNpcSchema.parse(npcForm), token));
      setNpcForm(emptyNpcForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerateNpc(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await generateCampaignNpc(selectedCampaign.id, token));
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
      upsertCampaign(await updateCampaignNpc(npcId, payload, token));
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
      upsertCampaign(await deleteCampaignNpc(npcId, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGrantXp(): Promise<void> {
    if (!selectedCampaign || !xpForm.characterId || !xpForm.reason.trim()) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(
        await grantCampaignExperience(
          selectedCampaign.id,
          {
            characterId: xpForm.characterId,
            amount: Number(xpForm.amount),
            reason: xpForm.reason.trim()
          },
          token
        )
      );
      setXpForm((prev) => ({ ...prev, reason: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo otorgar PX");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateSession(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const parsed = createCampaignSessionSchema.parse(sessionForm);
      const updated = await createCampaignSession(selectedCampaign.id, parsed, token);
      upsertCampaign(updated);
      setSelectedSessionId(getMatchingSessionId(updated, parsed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sesión");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSession(): Promise<void> {
    if (!selectedSession) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await updateCampaignSession(selectedSession.id, { ...sessionForm } as UpdateCampaignSessionInput, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la sesión");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssignSessionXp(): Promise<void> {
    if (!selectedSession || !selectedCampaign) {
      return;
    }

    const awards = selectedCampaign.characters
      .map((entry) => ({
        characterId: entry.characterId,
        amount: Number(sessionXpDraft[entry.characterId] || 0)
      }))
      .filter((entry) => entry.amount > 0);

    if (awards.length === 0) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await assignCampaignSessionExperience(selectedSession.id, { awards }, token);
      upsertCampaign(updated);
      setSessionXpDraft(Object.fromEntries(updated.characters.map((entry) => [entry.characterId, 0])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar PX de sesión");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="campaigns-module">
      <section className="panel campaign-hero">
        <h2>Gestor de Campañas</h2>
        <p>Centraliza miembros, personajes vinculados, sesiones del DJ, PNJs y reparto de experiencia.</p>
      </section>

      {error ? (
        <section className="panel error-list">
          <p>{error}</p>
        </section>
      ) : null}

      <div className="campaign-layout">
        <section className="panel campaign-sidebar-panel">
          <div className="row-actions">
            <h3>Campañas</h3>
            <button disabled={isLoading} onClick={() => void refresh()}>
              Recargar
            </button>
          </div>

          {isLoading ? <p>Cargando campañas...</p> : null}

          <div className="campaign-list">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                className={`campaign-list-item${selectedCampaignId === campaign.id ? " is-active" : ""}`}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <strong>{campaign.name}</strong>
                <span>{campaign.setting || "Sin ambientación"}</span>
                <span>{campaign.members.length} miembros</span>
                <span>{campaign.sessions.length} sesiones</span>
              </button>
            ))}
            {!isLoading && campaigns.length === 0 ? (
              <p className="section-help">Aún no hay campañas accesibles.</p>
            ) : null}
          </div>
          {isDirector ? (
            <div className="campaign-create-form">
              <div className="section-title">Nueva campaña</div>
              <label className="field">
                <span>Nombre</span>
                <input value={campaignForm.name} onChange={(event) => setCampaignForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Ambientación</span>
                <input
                  value={campaignForm.setting}
                  onChange={(event) => setCampaignForm((prev) => ({ ...prev, setting: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Resumen</span>
                <textarea
                  rows={3}
                  value={campaignForm.summary}
                  onChange={(event) => setCampaignForm((prev) => ({ ...prev, summary: event.target.value }))}
                />
              </label>
              <button disabled={isSaving} onClick={() => void handleCreateCampaign()}>
                Crear campaña
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
                    <input value={draft.name} disabled={!isDirector} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Ambientación</span>
                    <input
                      value={draft.setting}
                      disabled={!isDirector}
                      onChange={(event) => setDraft((prev) => ({ ...prev, setting: event.target.value }))}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Resumen</span>
                  <textarea rows={3} value={draft.summary} disabled={!isDirector} onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Notas del director</span>
                  <textarea rows={5} value={draft.notes} disabled={!isDirector} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
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
                  <h3>Sesiones</h3>
                  {isDirector ? (
                    <button
                      disabled={isSaving}
                      onClick={() => {
                        setSelectedSessionId(null);
                        setSessionForm(makeDefaultSessionForm());
                      }}
                    >
                      Nueva sesión
                    </button>
                  ) : null}
                </div>
                <div className="campaign-session-layout">
                  <div className="campaign-session-list">
                    {selectedCampaign.sessions.map((session) => (
                      <button
                        key={session.id}
                        className={`campaign-list-item${selectedSessionId === session.id ? " is-active" : ""}`}
                        onClick={() => setSelectedSessionId(session.id)}
                      >
                        <strong>{session.title}</strong>
                        <span>{new Date(session.scheduledFor).toLocaleString()}</span>
                        <span>{session.status}</span>
                      </button>
                    ))}
                    {selectedCampaign.sessions.length === 0 ? (
                      <p className="section-help">Aún no hay sesiones programadas.</p>
                    ) : null}
                  </div>

                  <div className="campaign-session-detail">
                    {isDirector ? (
                      <>
                        <div className="row-actions">
                          <h3>{selectedSession ? "Detalle de sesión" : "Crear sesión"}</h3>
                          <button disabled={isSaving} onClick={() => void (selectedSession ? handleSaveSession() : handleCreateSession())}>
                            {selectedSession ? "Guardar sesión" : "Programar sesión"}
                          </button>
                        </div>
                        <div className="form-grid">
                          <label className="field">
                            <span>Titulo</span>
                            <input value={sessionForm.title} onChange={(event) => setSessionForm((prev) => ({ ...prev, title: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Fecha y hora</span>
                            <input
                              type="datetime-local"
                              value={toLocalDateTimeValue(sessionForm.scheduledFor)}
                              onChange={(event) => setSessionForm((prev) => ({ ...prev, scheduledFor: fromLocalDateTimeValue(event.target.value) }))}
                            />
                          </label>
                          <label className="field">
                            <span>Ubicacion</span>
                            <input value={sessionForm.location} onChange={(event) => setSessionForm((prev) => ({ ...prev, location: event.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Estado</span>
                            <select
                              value={sessionForm.status}
                              onChange={(event) =>
                                setSessionForm((prev) => ({
                                  ...prev,
                                  status: event.target.value as CreateCampaignSessionInput["status"]
                                }))
                              }
                            >
                              <option value="planned">Planificada</option>
                              <option value="completed">Completada</option>
                              <option value="cancelled">Cancelada</option>
                            </select>
                          </label>
                        </div>
                        <label className="field">
                          <span>Resumen para la mesa</span>
                          <textarea rows={2} value={sessionForm.summary} onChange={(event) => setSessionForm((prev) => ({ ...prev, summary: event.target.value }))} />
                        </label>
                        <label className="field">
                          <span>Notas visibles para la mesa</span>
                          <textarea rows={4} value={sessionForm.publicNotes} onChange={(event) => setSessionForm((prev) => ({ ...prev, publicNotes: event.target.value }))} />
                        </label>
                        <label className="field">
                          <span>Notas secretas del DJ</span>
                          <textarea rows={4} value={sessionForm.dmNotes} onChange={(event) => setSessionForm((prev) => ({ ...prev, dmNotes: event.target.value }))} />
                        </label>

                        {selectedSession ? (
                          <>
                            <div className="section-title">PX al cerrar sesión</div>
                            <div className="cards">
                              {selectedCampaign.characters.map((entry) => (
                                <article key={entry.characterId} className="card">
                                  <strong>{entry.name}</strong>
                                  <span>{entry.ownerEmail}</span>
                                  <label className="field">
                                    <span>PX de esta sesión</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={sessionXpDraft[entry.characterId] ?? 0}
                                      onChange={(event) =>
                                        setSessionXpDraft((prev) => ({
                                          ...prev,
                                          [entry.characterId]: Number(event.target.value || 0)
                                        }))
                                      }
                                    />
                                  </label>
                                </article>
                              ))}
                            </div>
                            <button disabled={isSaving} onClick={() => void handleAssignSessionXp()}>
                              Asignar PX de sesión
                            </button>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <h3>{selectedSession?.title ?? "Sesiones"}</h3>
                        <p className="section-help">Las sesiones son una herramienta interna del DJ en el MVP actual.</p>
                      </>
                    )}
                  </div>
                </div>
              </section>
              <section className="panel">
                <div className="row-actions">
                  <h3>Personajes de la campaña</h3>
                  {isDirector ? (
                    <div className="inline-row campaign-inline-form">
                      <label className="field">
                        <span>Personaje disponible</span>
                        <select value={selectedAvailableCharacterId} onChange={(event) => setSelectedAvailableCharacterId(event.target.value)}>
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
                  {selectedCampaign.characters.length === 0 ? (
                    <p className="section-help">Todavía no hay personajes vinculados.</p>
                  ) : null}
                </div>

                {isDirector && selectedCampaign.characters.length > 0 ? (
                  <div className="campaign-xp-panel">
                    <div className="section-title">Otorgar experiencia manual</div>
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
                  {selectedCampaign.npcs.length === 0 ? (
                    <p className="section-help">Todavía no hay PNJs registrados.</p>
                  ) : null}
                </div>
              </section>

              <section className="panel">
                <h3>Historial de experiencia</h3>
                <div className="campaign-log-list">
                  {selectedCampaign.experienceLog.map((entry) => (
                    <article key={entry.id} className="card">
                      <strong>+{entry.amount} PX para {entry.characterName}</strong>
                      <span>{entry.reason}</span>
                      <span>{entry.grantedByEmail} · {new Date(entry.createdAt).toLocaleString()}</span>
                    </article>
                  ))}
                  {selectedCampaign.experienceLog.length === 0 ? (
                    <p className="section-help">Aún no hay concesiones de experiencia registradas.</p>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section className="panel">
              <h2>Sin campaña seleccionada</h2>
              <p>Elige una campaña en la columna lateral o crea una nueva si eres director.</p>
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
