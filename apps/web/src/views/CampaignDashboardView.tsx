import { useEffect, useMemo, useState } from "react";
import {
  createCampaignReferenceSchema,
  createCampaignSchema,
  type AuthUser,
  type Campaign,
  type CreateCampaignReferenceInput,
  type CreateCampaignInput
} from "@umbra/shared";
import {
  addCampaignMember,
  createCampaign,
  createCampaignReference,
  deleteCampaignReference,
  fetchCampaigns,
  linkCampaignCharacter,
  removeCampaignMember,
  unlinkCampaignCharacter,
  updateCampaign,
  updateCampaignReference
} from "../services/campaignService";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ALL_ENTRIES } from "../models/compendiumEntries";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
};

type CampaignHashState = {
  campaignId: string | null;
  sheetId: string | null;
  section: CampaignSection | null;
};

type CampaignSection = "dmNotes" | "sharedNotes" | "wiki" | "members" | "characters";

const emptyCampaignForm: CreateCampaignInput = {
  name: "",
  summary: "",
  setting: "",
  notes: "",
  sharedNotes: ""
};

const emptyReferenceForm: CreateCampaignReferenceInput = {
  name: "",
  label: "",
  aliases: [],
  summary: "",
  content: "",
  isPublic: false
};

function parseCampaignHash(): CampaignHashState {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash.startsWith("campaigns")) {
    return { campaignId: null, sheetId: null, section: null };
  }

  const [, search = ""] = rawHash.split("?");
  const params = new URLSearchParams(search);
  const rawSection = params.get("section");
  const section: CampaignSection | null =
    rawSection === "dmNotes" ||
    rawSection === "sharedNotes" ||
    rawSection === "wiki" ||
    rawSection === "members" ||
    rawSection === "characters"
      ? rawSection
      : null;
  return {
    campaignId: params.get("id"),
    sheetId: params.get("sheetId"),
    section
  };
}

function replaceCampaignHash(
  campaignId: string | null,
  sheetId: string | null,
  section: CampaignSection | null
): void {
  const params = new URLSearchParams();
  if (campaignId) {
    params.set("id", campaignId);
  }
  if (sheetId) {
    params.set("sheetId", sheetId);
  }
  if (campaignId && section) {
    params.set("section", section);
  }

  const nextHash = params.toString() ? `#campaigns?${params.toString()}` : "#campaigns";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function normalizeCompendiumName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function CampaignDashboardView({ user, ensureAccessToken }: Props) {
  const initialHash = parseCampaignHash();
  const isDirector = user.role === "gm" || user.role === "superadmin";
  const defaultSection: CampaignSection = isDirector ? "dmNotes" : "sharedNotes";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialHash.campaignId);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(initialHash.sheetId);
  const [activeSection, setActiveSection] = useState<CampaignSection>(
    initialHash.section && (isDirector || initialHash.section !== "dmNotes") ? initialHash.section : defaultSection
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [draft, setDraft] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [referenceForm, setReferenceForm] = useState<CreateCampaignReferenceInput>(emptyReferenceForm);
  const [referenceAliasesText, setReferenceAliasesText] = useState("");
  const [isReferenceCreateModalOpen, setIsReferenceCreateModalOpen] = useState(false);
  const [isReferenceDetailModalOpen, setIsReferenceDetailModalOpen] = useState(false);
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
  const selectedReference = useMemo(
    () => selectedCampaign?.references.find((entry) => entry.id === selectedReferenceId) ?? null,
    [selectedCampaign, selectedReferenceId]
  );
  const linkableCharacters = useMemo(
    () =>
      (selectedCampaign?.availableCharacters ?? []).filter(
        (entry) => !entry.linked && (isDirector || entry.ownerId === user.id)
      ),
    [isDirector, selectedCampaign, user.id]
  );
  const burdenEntries = useMemo(
    () => ALL_ENTRIES.filter((entry) => entry.tipo === "carga"),
    []
  );
  const campaignBurdenDigest = useMemo(() => {
    if (!selectedCampaign || !isDirector) {
      return [];
    }

    return selectedCampaign.characters.flatMap((entry) => {
      const burdens = entry.sheet?.cargas ?? [];
      return burdens.map((burdenName) => {
        const match = burdenEntries.find(
          (candidate) => normalizeCompendiumName(candidate.nombre) === normalizeCompendiumName(burdenName)
        );

        return {
          id: `${entry.id}-${normalizeCompendiumName(burdenName)}`,
          burdenName,
          characterName: entry.name,
          ownerEmail: entry.ownerEmail,
          summary: match?.resumen ?? "Carga registrada en la ficha del personaje.",
          detail: match?.detalle ?? "Consulta el compendio o la hoja del personaje para el detalle completo.",
          source: match ? `${match.fuente}${match.pagina ? ` · p.${match.pagina}` : ""}` : "Sin referencia enlazada"
        };
      });
    });
  }, [burdenEntries, isDirector, selectedCampaign]);
  const campaignSheetModalEntry = isDirector && selectedSheetEntry?.sheet ? selectedSheetEntry : null;
  const isSheetModalOpen = Boolean(campaignSheetModalEntry);
  const isAnyModalOpen =
    isCreateCampaignModalOpen ||
    isCampaignDetailsModalOpen ||
    isReferenceCreateModalOpen ||
    isReferenceDetailModalOpen ||
    isSheetModalOpen;

  useBodyScrollLock(isAnyModalOpen);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function syncSelectionFromHash(): void {
      const next = parseCampaignHash();
      setSelectedCampaignId(next.campaignId);
      setSelectedSheetId(next.sheetId);
      setActiveSection(next.section && (isDirector || next.section !== "dmNotes") ? next.section : defaultSection);
    }

    syncSelectionFromHash();
    window.addEventListener("hashchange", syncSelectionFromHash);
    return () => window.removeEventListener("hashchange", syncSelectionFromHash);
  }, [defaultSection, isDirector]);

  useEffect(() => {
    replaceCampaignHash(selectedCampaignId, selectedSheetId, selectedCampaignId ? activeSection : null);
  }, [activeSection, selectedCampaignId, selectedSheetId]);

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
      setSelectedReferenceId(null);
      setReferenceForm(emptyReferenceForm);
      setReferenceAliasesText("");
      setIsReferenceCreateModalOpen(false);
      setIsReferenceDetailModalOpen(false);
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
    if (selectedReferenceId && !selectedCampaign?.references.some((entry) => entry.id === selectedReferenceId)) {
      setSelectedReferenceId(null);
      setIsReferenceDetailModalOpen(false);
    }
  }, [selectedCampaign, selectedReferenceId]);

  useEffect(() => {
    if (!selectedReference) {
      setReferenceForm(emptyReferenceForm);
      setReferenceAliasesText("");
      return;
    }

    setReferenceForm({
      name: selectedReference.name,
      label: selectedReference.label,
      aliases: selectedReference.aliases,
      summary: selectedReference.summary,
      content: selectedReference.content,
      isPublic: selectedReference.isPublic
    });
    setReferenceAliasesText(selectedReference.aliases.join(", "));
  }, [selectedReference]);

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
    }
  }, [activeSection, selectedCampaign, selectedCampaignId, selectedSheetId]);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setLoadError(null);
    try {
      const token = await ensureAccessToken();
      setCampaigns(await fetchCampaigns(token));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudieron cargar las campanas");
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
    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const created = await createCampaign(createCampaignSchema.parse(campaignForm), token);
      upsertCampaign(created);
      setCampaignForm(emptyCampaignForm);
      setFormError(null);
      setIsCreateCampaignModalOpen(false);
      setActiveSection("dmNotes");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear la campana");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCampaignDetails(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setFormError(null);
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
      setFormError(null);
      setIsCampaignDetailsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudieron guardar los detalles");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDmNotes(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await updateCampaign(selectedCampaign.id, { notes: draft.notes }, token));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudieron guardar las notas del DJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSharedNotes(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await updateCampaign(selectedCampaign.id, { sharedNotes: draft.sharedNotes }, token));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudieron guardar las notas compartidas");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMember(): Promise<void> {
    if (!selectedCampaign || !memberEmail.trim()) {
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await addCampaignMember(selectedCampaign.id, { email: memberEmail.trim() }, token));
      setMemberEmail("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo agregar el miembro");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveMember(memberId: string): Promise<void> {
    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await removeCampaignMember(memberId, token));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo quitar el miembro");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLinkCharacter(): Promise<void> {
    if (!selectedCampaign || !selectedAvailableCharacterId) {
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await linkCampaignCharacter(selectedCampaign.id, selectedAvailableCharacterId, token));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo vincular el personaje");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnlinkCharacter(linkId: string): Promise<void> {
    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await unlinkCampaignCharacter(linkId, token));
      if (selectedSheetId === linkId) {
        setSelectedSheetId(null);
        setActiveSection("characters");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo desvincular el personaje");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateReference(): Promise<void> {
    if (!selectedCampaign) {
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const aliases = referenceAliasesText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const payload = createCampaignReferenceSchema.parse({
        ...referenceForm,
        aliases
      });
      const updated = await createCampaignReference(selectedCampaign.id, payload, token);
      upsertCampaign(updated);
      const createdReference = updated.references.find(
        (entry) => entry.name === payload.name && entry.label === payload.label && entry.content === payload.content
      );
      setSelectedReferenceId(createdReference?.id ?? null);
      setFormError(null);
      setIsReferenceCreateModalOpen(false);
      setIsReferenceDetailModalOpen(Boolean(createdReference));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear la referencia");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveReference(): Promise<void> {
    if (!selectedReference) {
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const aliases = referenceAliasesText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const payload = createCampaignReferenceSchema.parse({
        ...referenceForm,
        aliases
      });
      upsertCampaign(await updateCampaignReference(selectedReference.id, payload, token));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la referencia");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteReference(referenceId: string): Promise<void> {
    setFormError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const updated = await deleteCampaignReference(referenceId, token);
      upsertCampaign(updated);
      setSelectedReferenceId(null);
      setFormError(null);
      setIsReferenceDetailModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo eliminar la referencia");
    } finally {
      setIsSaving(false);
    }
  }

  function handlePrepareNewReference(): void {
    setFormError(null);
    setSelectedReferenceId(null);
    setReferenceForm(emptyReferenceForm);
    setReferenceAliasesText("");
    setIsReferenceDetailModalOpen(false);
    setIsReferenceCreateModalOpen(true);
  }

  function openReferenceDetail(referenceId: string): void {
    setFormError(null);
    setSelectedReferenceId(referenceId);
    setIsReferenceCreateModalOpen(false);
    setIsReferenceDetailModalOpen(true);
  }

  return (
    <main className="campaign-dashboard">
      {!selectedCampaign ? (
        <section className="panel campaign-list-panel">
          <div className="row-actions">
            <div>
              <h1>Campanas</h1>
              <p className="section-help">Notas compartidas, notas del DJ y personajes vinculados.</p>
            </div>
            <div className="toolbar">
              {isDirector ? (
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setIsCreateCampaignModalOpen(true);
                  }}
                >
                  Nueva campana
                </button>
              ) : null}
              <button type="button" disabled={isLoading} onClick={() => void refresh()}>
                Recargar
              </button>
            </div>
          </div>

          {loadError ? <p className="error-text">{loadError}</p> : null}
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
      ) : null}

      {selectedCampaign ? (
        <section className="campaign-main">
          <section className="panel">
            <div className="row-actions">
              <div>
                <h2>{selectedCampaign.name}</h2>
                {selectedCampaign.summary ? <p className="section-help">{selectedCampaign.summary}</p> : null}
              </div>
              <div className="campaign-header-actions">
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
                {isDirector ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setFormError(null);
                      setIsCampaignDetailsModalOpen(true);
                    }}
                  >
                    Detalles
                  </button>
                ) : null}
              </div>
            </div>

            {formError && !isCampaignDetailsModalOpen && !isReferenceCreateModalOpen && !isReferenceDetailModalOpen ? (
              <p className="error-text">{formError}</p>
            ) : null}

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
                className={activeSection === "wiki" ? "is-active" : ""}
                onClick={() => setActiveSection("wiki")}
              >
                Wiki
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

          {activeSection === "wiki" ? (
            <section className="panel">
              <div className="row-actions">
                <div>
                  <h3>Wiki de campana</h3>
                  <p className="section-help">Referencias internas para facciones, lugares, PNJ, tramas y cualquier termino reutilizable.</p>
                </div>
                {isDirector ? (
                  <button type="button" disabled={isSaving} onClick={handlePrepareNewReference}>
                    Nueva referencia
                  </button>
                ) : null}
              </div>

              <div className="campaign-reference-list">
                {selectedCampaign.references.map((reference) => (
                  <button
                    key={reference.id}
                    type="button"
                    className="campaign-list-item"
                    onClick={() => openReferenceDetail(reference.id)}
                  >
                    <strong>{reference.name}</strong>
                    <span>{reference.label}</span>
                    <span>{reference.summary || "Sin resumen breve"}</span>
                    {reference.aliases.length > 0 ? <span>Alias: {reference.aliases.join(", ")}</span> : null}
                    <span>{reference.isPublic ? "Visible para jugadores" : "Solo DJ"}</span>
                  </button>
                ))}
                {selectedCampaign.references.length === 0 ? (
                  <p className="section-help">Aun no hay referencias en esta campana.</p>
                ) : null}
              </div>
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
                      <span>PX total: {entry.experienceTotal} Â· PX gastada: {entry.experienceSpent}</span>
                      <span>Actualizado: {formatDate(entry.updatedAt)}</span>
                      <div className="card-actions">
                        {isDirector && entry.sheet ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSheetId(entry.id);
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

              {isDirector ? (
                <section className="campaign-burden-summary">
                  <div className="row-actions">
                    <div>
                      <h3>Resumen de cargas</h3>
                      <p className="section-help">
                        Vista rapida para el DJ con las cargas activas de los personajes vinculados y su explicacion.
                      </p>
                    </div>
                    <span className="meta-text">{campaignBurdenDigest.length} registradas</span>
                  </div>

                  <div className="cards">
                    {campaignBurdenDigest.map((burden) => (
                      <article key={burden.id} className="campaign-structured-card app-card-accent app-card-accent--carga">
                        <div className="row-actions">
                          <div>
                            <strong>{burden.burdenName}</strong>
                            <p className="section-help">
                              {burden.characterName} · {burden.ownerEmail}
                            </p>
                          </div>
                          <span className="compendium-chip">Carga</span>
                        </div>
                        <p>{burden.summary}</p>
                        <p className="section-help">{burden.detail}</p>
                        <span className="meta-text">{burden.source}</span>
                      </article>
                    ))}
                    {campaignBurdenDigest.length === 0 ? (
                      <p className="section-help">No hay cargas registradas en los personajes vinculados.</p>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}

          {selectedSheetEntry && false ? (
            <section className="campaign-sheet-shell">
              <UnifiedCharacterSheet
                title={campaignSheetModalEntry?.name ?? ""}
                subtitle={`${selectedSheetEntry?.ownerEmail ?? ""} · Hoja vinculada a campana`}
                sheet={selectedSheetEntry!.sheet!}
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

      {campaignSheetModalEntry ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            setSelectedSheetId(null);
          }}
        >
          <div
            className="panel modal-panel campaign-character-sheet-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-actions campaign-character-sheet-modal-header">
              <div>
                <h3>{campaignSheetModalEntry.name}</h3>
                <p className="section-help">{campaignSheetModalEntry.ownerEmail} Â· Hoja vinculada a campana</p>
              </div>
              <button type="button" onClick={() => setSelectedSheetId(null)}>
                Cerrar
              </button>
            </div>
            <div className="campaign-character-sheet-modal-body">
              <UnifiedCharacterSheet
                title={campaignSheetModalEntry.name}
                subtitle={`${campaignSheetModalEntry.ownerEmail} Â· Hoja vinculada a campana`}
                sheet={campaignSheetModalEntry.sheet!}
                editable={false}
                busy={isSaving}
              />
            </div>
          </div>
        </section>
      ) : null}

      {isCreateCampaignModalOpen ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setFormError(null);
              setIsCreateCampaignModalOpen(false);
            }
          }}
        >
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h3>Nueva campana</h3>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => void handleCreateCampaign()}>
                  Crear
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setFormError(null);
                    setIsCreateCampaignModalOpen(false);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            {formError ? <p className="error-text">{formError}</p> : null}
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
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setFormError(null);
              setIsCampaignDetailsModalOpen(false);
            }
          }}
        >
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h3>Detalles de campana</h3>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => void handleSaveCampaignDetails()}>
                  Guardar
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setFormError(null);
                    setIsCampaignDetailsModalOpen(false);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            {formError ? <p className="error-text">{formError}</p> : null}
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

      {isDirector && isReferenceCreateModalOpen ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setFormError(null);
              setIsReferenceCreateModalOpen(false);
            }
          }}
        >
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h3>Nueva referencia</h3>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => void handleCreateReference()}>
                  {isSaving ? "Creando..." : "Crear"}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setFormError(null);
                    setIsReferenceCreateModalOpen(false);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            {formError ? <p className="error-text">{formError}</p> : null}

            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={referenceForm.name}
                  onChange={(event) => setReferenceForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Categoria</span>
                <input
                  value={referenceForm.label}
                  onChange={(event) => setReferenceForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="PNJ, lugar, faccion, trama..."
                />
              </label>
            </div>

            <label className="field">
              <span>Resumen</span>
              <input
                value={referenceForm.summary}
                onChange={(event) => setReferenceForm((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Alias</span>
              <input
                value={referenceAliasesText}
                onChange={(event) => setReferenceAliasesText(event.target.value)}
                placeholder="Nombres alternativos separados por comas"
              />
            </label>

            <label className="field">
              <span>Contenido</span>
              <textarea
                rows={12}
                value={referenceForm.content}
                onChange={(event) => setReferenceForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="Detalle extenso de la referencia, usos, relaciones, pistas..."
              />
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={referenceForm.isPublic}
                onChange={(event) => setReferenceForm((current) => ({ ...current, isPublic: event.target.checked }))}
              />
              <span>Visible para los jugadores</span>
            </label>
          </div>
        </section>
      ) : null}

      {isReferenceDetailModalOpen && selectedReference ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setFormError(null);
              setIsReferenceDetailModalOpen(false);
            }
          }}
        >
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <div>
                <h3>{selectedReference.name}</h3>
                <p className="section-help">{selectedReference.label}</p>
              </div>
              <div className="toolbar">
                {isDirector ? (
                  <>
                    <button type="button" disabled={isSaving} onClick={() => void handleSaveReference()}>
                      {isSaving ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={isSaving}
                      onClick={() => void handleDeleteReference(selectedReference.id)}
                    >
                      Eliminar
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setFormError(null);
                    setIsReferenceDetailModalOpen(false);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            {formError ? <p className="error-text">{formError}</p> : null}

            {isDirector ? (
              <>
                <div className="form-grid">
                  <label className="field">
                    <span>Nombre</span>
                    <input
                      value={referenceForm.name}
                      onChange={(event) => setReferenceForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Categoria</span>
                    <input
                      value={referenceForm.label}
                      onChange={(event) => setReferenceForm((current) => ({ ...current, label: event.target.value }))}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Resumen</span>
                  <input
                    value={referenceForm.summary}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, summary: event.target.value }))}
                  />
                </label>

                <label className="field">
                  <span>Alias</span>
                  <input
                    value={referenceAliasesText}
                    onChange={(event) => setReferenceAliasesText(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Contenido</span>
                  <textarea
                    rows={12}
                    value={referenceForm.content}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, content: event.target.value }))}
                  />
                </label>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={referenceForm.isPublic}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, isPublic: event.target.checked }))}
                  />
                  <span>Visible para los jugadores</span>
                </label>
              </>
            ) : (
              <div className="campaign-reference-preview">
                {selectedReference.summary ? <p>{selectedReference.summary}</p> : null}
                <p>{selectedReference.content || "Sin contenido detallado."}</p>
                {selectedReference.aliases.length > 0 ? <p>Alias: {selectedReference.aliases.join(", ")}</p> : null}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}


