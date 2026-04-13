import { useEffect, useMemo, useState } from "react";
import {
  createCampaignSchema,
  type AuthUser,
  type Campaign,
  type CreateCampaignInput
} from "@umbra/shared";
import {
  addCampaignMember,
  createCampaign,
  fetchCampaigns,
  linkCampaignCharacter,
  removeCampaignMember,
  unlinkCampaignCharacter,
  updateCampaign
} from "../services/campaignService";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
};

type CampaignHashState = {
  campaignId: string | null;
  sheetId: string | null;
};

type CampaignSection = "dmNotes" | "sharedNotes" | "members" | "characters" | "sheet";

const emptyCampaignForm: CreateCampaignInput = {
  name: "",
  summary: "",
  setting: "",
  notes: "",
  sharedNotes: ""
};

function parseCampaignHash(): CampaignHashState {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash.startsWith("campaigns")) {
    return { campaignId: null, sheetId: null };
  }

  const [, search = ""] = rawHash.split("?");
  const params = new URLSearchParams(search);
  return {
    campaignId: params.get("id"),
    sheetId: params.get("sheetId")
  };
}

function replaceCampaignHash(campaignId: string | null, sheetId: string | null): void {
  const params = new URLSearchParams();
  if (campaignId) {
    params.set("id", campaignId);
  }
  if (sheetId) {
    params.set("sheetId", sheetId);
  }

  const nextHash = params.toString() ? `#campaigns?${params.toString()}` : "#campaigns";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function CampaignDashboardView({ user, ensureAccessToken }: Props) {
  const initialHash = parseCampaignHash();
  const isDirector = user.role === "gm" || user.role === "superadmin";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialHash.campaignId);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(initialHash.sheetId);
  const [activeSection, setActiveSection] = useState<CampaignSection>(isDirector ? "dmNotes" : "sharedNotes");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [draft, setDraft] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );
  const selectedSheetEntry = useMemo(
    () => selectedCampaign?.characters.find((entry) => entry.id === selectedSheetId) ?? null,
    [selectedCampaign, selectedSheetId]
  );
  const linkableCharacters = useMemo(
    () =>
      (selectedCampaign?.availableCharacters ?? []).filter(
        (entry) => !entry.linked && (isDirector || entry.ownerId === user.id)
      ),
    [isDirector, selectedCampaign, user.id]
  );

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function syncSelectionFromHash(): void {
      const next = parseCampaignHash();
      setSelectedCampaignId(next.campaignId);
      setSelectedSheetId(next.sheetId);
    }

    syncSelectionFromHash();
    window.addEventListener("hashchange", syncSelectionFromHash);
    return () => window.removeEventListener("hashchange", syncSelectionFromHash);
  }, []);

  useEffect(() => {
    replaceCampaignHash(selectedCampaignId, selectedSheetId);
  }, [selectedCampaignId, selectedSheetId]);

  useEffect(() => {
    if (!isDirector && activeSection === "dmNotes") {
      setActiveSection("sharedNotes");
    }
  }, [activeSection, isDirector]);

  useEffect(() => {
    if (!selectedCampaign) {
      setDraft(emptyCampaignForm);
      setSelectedAvailableCharacterId("");
      setSelectedSheetId(null);
      return;
    }

    setDraft({
      name: selectedCampaign.name,
      summary: selectedCampaign.summary,
      setting: selectedCampaign.setting,
      notes: selectedCampaign.notes,
      sharedNotes: selectedCampaign.sharedNotes
    });
  }, [selectedCampaign]);

  useEffect(() => {
    setSelectedAvailableCharacterId(linkableCharacters[0]?.characterId ?? "");
  }, [linkableCharacters]);

  useEffect(() => {
    if (!selectedCampaignId) {
      return;
    }

    if (!selectedCampaign) {
      setSelectedCampaignId(null);
      setSelectedSheetId(null);
      return;
    }

    if (selectedSheetId && !selectedCampaign.characters.some((entry) => entry.id === selectedSheetId)) {
      setSelectedSheetId(null);
      if (activeSection === "sheet") {
        setActiveSection("characters");
      }
    }
  }, [activeSection, selectedCampaign, selectedCampaignId, selectedSheetId]);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      setCampaigns(await fetchCampaigns(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las campanas");
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
      setIsCreateCampaignModalOpen(false);
      setActiveSection("dmNotes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la campana");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCampaignDetails(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(
        await updateCampaign(selectedCampaign.id, {
          name: draft.name,
          summary: draft.summary,
          setting: draft.setting
        }, token)
      );
      setIsCampaignDetailsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los detalles");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDmNotes(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await updateCampaign(selectedCampaign.id, { notes: draft.notes }, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar las notas del DJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSharedNotes(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await updateCampaign(selectedCampaign.id, { sharedNotes: draft.sharedNotes }, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar las notas compartidas");
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
      setError(err instanceof Error ? err.message : "No se pudo agregar el miembro");
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
      if (selectedSheetId === linkId) {
        setSelectedSheetId(null);
        setActiveSection("characters");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desvincular el personaje");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="campaign-dashboard">
      <section className="panel campaign-list-panel">
        <div className="row-actions">
          <div>
            <h1>Campanas</h1>
            <p className="section-help">Notas compartidas, notas del DJ y personajes vinculados.</p>
          </div>
          <div className="toolbar">
            {isDirector ? (
              <button type="button" onClick={() => setIsCreateCampaignModalOpen(true)}>
                Nueva campana
              </button>
            ) : null}
            <button type="button" disabled={isLoading} onClick={() => void refresh()}>
              Recargar
            </button>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {isLoading ? <p>Cargando campanas...</p> : null}

        <div className="campaign-list">
          {campaigns.map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              className={`campaign-list-item${selectedCampaignId === campaign.id ? " is-active" : ""}`}
              onClick={() => {
                setSelectedCampaignId(campaign.id);
                setSelectedSheetId(null);
                setActiveSection(isDirector ? "dmNotes" : "sharedNotes");
              }}
            >
              <strong>{campaign.name}</strong>
              <span>{campaign.setting || campaign.summary || "Sin ambientacion"}</span>
              <span>{campaign.members.length} miembros</span>
              <span>{campaign.characters.length} personajes vinculados</span>
            </button>
          ))}
          {!isLoading && campaigns.length === 0 ? (
            <p className="section-help">Aun no hay campanas accesibles.</p>
          ) : null}
        </div>
      </section>

      {selectedCampaign ? (
        <section className="campaign-main">
          <section className="panel">
            <div className="row-actions">
              <div>
                <button
                  type="button"
                  className="subtle-button"
                  onClick={() => {
                    setSelectedCampaignId(null);
                    setSelectedSheetId(null);
                    setActiveSection(isDirector ? "dmNotes" : "sharedNotes");
                  }}
                >
                  Volver a campanas
                </button>
                <h2>{selectedCampaign.name}</h2>
                <p className="meta-text">
                  DJ: <strong>{selectedCampaign.gmEmail}</strong>
                </p>
                {selectedCampaign.summary ? <p className="section-help">{selectedCampaign.summary}</p> : null}
              </div>
              {isDirector ? (
                <div className="campaign-header-actions">
                  <button type="button" disabled={isSaving} onClick={() => setIsCampaignDetailsModalOpen(true)}>
                    Detalles
                  </button>
                </div>
              ) : null}
            </div>

            <div className="toolbar campaign-section-nav">
              {isDirector ? (
                <button
                  type="button"
                  className={activeSection === "dmNotes" ? "is-active" : ""}
                  onClick={() => setActiveSection("dmNotes")}
                >
                  Notas DJ
                </button>
              ) : null}
              <button
                type="button"
                className={activeSection === "sharedNotes" ? "is-active" : ""}
                onClick={() => setActiveSection("sharedNotes")}
              >
                Notas compartidas
              </button>
              <button
                type="button"
                className={activeSection === "members" ? "is-active" : ""}
                onClick={() => setActiveSection("members")}
              >
                Miembros
              </button>
              <button
                type="button"
                className={activeSection === "characters" ? "is-active" : ""}
                onClick={() => setActiveSection("characters")}
              >
                Personajes
              </button>
              {isDirector && selectedSheetEntry?.sheet ? (
                <button
                  type="button"
                  className={activeSection === "sheet" ? "is-active" : ""}
                  onClick={() => setActiveSection("sheet")}
                >
                  Hoja abierta
                </button>
              ) : null}
            </div>
          </section>

          {isDirector && activeSection === "dmNotes" ? (
            <section className="panel">
              <div className="row-actions">
                <h3>Notas privadas del DJ</h3>
                <button type="button" disabled={isSaving} onClick={() => void handleSaveDmNotes()}>
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
              <label className="field">
                <span>Apuntes privados de campana</span>
                <textarea
                  rows={14}
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Notas privadas para el director de juego"
                />
              </label>
            </section>
          ) : null}

          {activeSection === "sharedNotes" ? (
            <section className="panel">
              <div className="row-actions">
                <h3>Notas compartidas</h3>
                <button type="button" disabled={isSaving} onClick={() => void handleSaveSharedNotes()}>
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
              <label className="field">
                <span>Notas visibles para los miembros de la campana</span>
                <textarea
                  rows={14}
                  value={draft.sharedNotes}
                  onChange={(event) => setDraft((current) => ({ ...current, sharedNotes: event.target.value }))}
                  placeholder="Apuntes de sesion, acuerdos del grupo, pistas, recordatorios..."
                />
              </label>
            </section>
          ) : null}

          {activeSection === "members" ? (
            <section className="panel">
              <div className="row-actions">
                <h3>Miembros</h3>
                {isDirector ? (
                  <div className="inline-row campaign-inline-form">
                    <label className="field">
                      <span>Email del jugador</span>
                      <input value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} />
                    </label>
                    <button type="button" disabled={isSaving} onClick={() => void handleAddMember()}>
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
                      <button type="button" disabled={isSaving} onClick={() => void handleRemoveMember(member.id)}>
                        Quitar
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection === "characters" ? (
            <section className="panel">
              <div className="row-actions">
                <div>
                  <h3>Personajes vinculados</h3>
                  <p className="section-help">
                    El director puede revisar todas las hojas vinculadas desde aqui. Los jugadores pueden vincular sus propios personajes.
                  </p>
                </div>
                <div className="inline-row campaign-inline-form">
                  <label className="field">
                    <span>Personaje disponible</span>
                    <select
                      value={selectedAvailableCharacterId}
                      onChange={(event) => setSelectedAvailableCharacterId(event.target.value)}
                    >
                      {linkableCharacters.length === 0 ? <option value="">Sin personajes disponibles</option> : null}
                      {linkableCharacters.map((entry) => (
                        <option key={entry.characterId} value={entry.characterId}>
                          {entry.name} - {entry.ownerEmail}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={isSaving || !selectedAvailableCharacterId}
                    onClick={() => void handleLinkCharacter()}
                  >
                    Vincular
                  </button>
                </div>
              </div>

              <div className="cards">
                {selectedCampaign.characters.map((entry) => {
                  const canManageLink = isDirector || entry.ownerId === user.id;
                  return (
                    <article key={entry.id} className="card">
                      <strong>{entry.name}</strong>
                      <span>{entry.ownerEmail}</span>
                      <span>PX total: {entry.experienceTotal} · PX gastada: {entry.experienceSpent}</span>
                      <span>Actualizado: {formatDate(entry.updatedAt)}</span>
                      <div className="card-actions">
                        {isDirector && entry.sheet ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSheetId(entry.id);
                              setActiveSection("sheet");
                            }}
                          >
                            Abrir hoja
                          </button>
                        ) : null}
                        {canManageLink ? (
                          <button type="button" disabled={isSaving} onClick={() => void handleUnlinkCharacter(entry.id)}>
                            Desvincular
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                {selectedCampaign.characters.length === 0 ? (
                  <p className="section-help">Todavia no hay personajes vinculados.</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {isDirector && activeSection === "sheet" && selectedSheetEntry?.sheet ? (
            <section className="campaign-sheet-shell">
              <UnifiedCharacterSheet
                title={selectedSheetEntry.name}
                subtitle={`${selectedSheetEntry.ownerEmail} · Hoja vinculada a campana`}
                sheet={selectedSheetEntry.sheet}
                editable={false}
                busy={isSaving}
                onBack={() => {
                  setSelectedSheetId(null);
                  setActiveSection("characters");
                }}
              />
            </section>
          ) : null}
        </section>
      ) : null}

      {isCreateCampaignModalOpen ? (
        <section className="modal-backdrop" onClick={() => !isSaving && setIsCreateCampaignModalOpen(false)}>
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h3>Nueva campana</h3>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => void handleCreateCampaign()}>
                  Crear
                </button>
                <button type="button" disabled={isSaving} onClick={() => setIsCreateCampaignModalOpen(false)}>
                  Cerrar
                </button>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={campaignForm.name}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Ambientacion</span>
                <input
                  value={campaignForm.setting}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, setting: event.target.value }))}
                />
              </label>
            </div>
            <label className="field">
              <span>Resumen</span>
              <textarea
                rows={3}
                value={campaignForm.summary}
                onChange={(event) => setCampaignForm((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
          </div>
        </section>
      ) : null}

      {isDirector && isCampaignDetailsModalOpen && selectedCampaign ? (
        <section className="modal-backdrop" onClick={() => !isSaving && setIsCampaignDetailsModalOpen(false)}>
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h3>Detalles de campana</h3>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => void handleSaveCampaignDetails()}>
                  Guardar
                </button>
                <button type="button" disabled={isSaving} onClick={() => setIsCampaignDetailsModalOpen(false)}>
                  Cerrar
                </button>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Ambientacion</span>
                <input
                  value={draft.setting}
                  onChange={(event) => setDraft((current) => ({ ...current, setting: event.target.value }))}
                />
              </label>
            </div>
            <label className="field">
              <span>Resumen</span>
              <textarea
                rows={4}
                value={draft.summary}
                onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
          </div>
        </section>
      ) : null}
    </main>
  );
}
