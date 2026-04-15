import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { createCampaignReferenceSchema, createCampaignSchema } from "@umbra/shared";
import { addCampaignMember, createCampaign, createCampaignReference, deleteCampaignReference, fetchCampaigns, linkCampaignCharacter, removeCampaignMember, unlinkCampaignCharacter, updateCampaign, updateCampaignReference } from "../services/campaignService";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ALL_ENTRIES } from "../models/compendiumEntries";
const emptyCampaignForm = {
    name: "",
    summary: "",
    setting: "",
    notes: "",
    sharedNotes: ""
};
const emptyReferenceForm = {
    name: "",
    label: "",
    aliases: [],
    summary: "",
    content: "",
    isPublic: false
};
function parseCampaignHash() {
    const rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash.startsWith("campaigns")) {
        return { campaignId: null, sheetId: null, section: null };
    }
    const [, search = ""] = rawHash.split("?");
    const params = new URLSearchParams(search);
    const rawSection = params.get("section");
    const section = rawSection === "dmNotes" ||
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
function replaceCampaignHash(campaignId, sheetId, section) {
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
function formatDate(value) {
    return new Date(value).toLocaleString();
}
function normalizeCompendiumName(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
export function CampaignDashboardView({ user, ensureAccessToken }) {
    const initialHash = parseCampaignHash();
    const isDirector = user.role === "gm" || user.role === "superadmin";
    const defaultSection = isDirector ? "dmNotes" : "sharedNotes";
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState(initialHash.campaignId);
    const [selectedSheetId, setSelectedSheetId] = useState(initialHash.sheetId);
    const [activeSection, setActiveSection] = useState(initialHash.section && (isDirector || initialHash.section !== "dmNotes") ? initialHash.section : defaultSection);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [formError, setFormError] = useState(null);
    const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
    const [draft, setDraft] = useState(emptyCampaignForm);
    const [memberEmail, setMemberEmail] = useState("");
    const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
    const [selectedReferenceId, setSelectedReferenceId] = useState(null);
    const [referenceForm, setReferenceForm] = useState(emptyReferenceForm);
    const [referenceAliasesText, setReferenceAliasesText] = useState("");
    const [isReferenceCreateModalOpen, setIsReferenceCreateModalOpen] = useState(false);
    const [isReferenceDetailModalOpen, setIsReferenceDetailModalOpen] = useState(false);
    const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
    const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
    const [isBurdenSummaryModalOpen, setIsBurdenSummaryModalOpen] = useState(false);
    const selectedCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null, [campaigns, selectedCampaignId]);
    const selectedSheetEntry = useMemo(() => selectedCampaign?.characters.find((entry) => entry.id === selectedSheetId) ?? null, [selectedCampaign, selectedSheetId]);
    const selectedReference = useMemo(() => selectedCampaign?.references.find((entry) => entry.id === selectedReferenceId) ?? null, [selectedCampaign, selectedReferenceId]);
    const linkableCharacters = useMemo(() => (selectedCampaign?.availableCharacters ?? []).filter((entry) => !entry.linked && (isDirector || entry.ownerId === user.id)), [isDirector, selectedCampaign, user.id]);
    const burdenEntries = useMemo(() => ALL_ENTRIES.filter((entry) => entry.tipo === "carga"), []);
    const campaignBurdenDigest = useMemo(() => {
        if (!selectedCampaign || !isDirector) {
            return [];
        }
        return selectedCampaign.characters.flatMap((entry) => {
            const burdens = entry.sheet?.cargas ?? [];
            return burdens.map((burdenName) => {
                const match = burdenEntries.find((candidate) => normalizeCompendiumName(candidate.nombre) === normalizeCompendiumName(burdenName));
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
    const isAnyModalOpen = isCreateCampaignModalOpen ||
        isCampaignDetailsModalOpen ||
        isReferenceCreateModalOpen ||
        isReferenceDetailModalOpen ||
        isBurdenSummaryModalOpen ||
        isSheetModalOpen;
    useBodyScrollLock(isAnyModalOpen);
    useEffect(() => {
        void refresh();
    }, []);
    useEffect(() => {
        function syncSelectionFromHash() {
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
        if (isLoading) {
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
    }, [activeSection, isLoading, selectedCampaign, selectedCampaignId, selectedSheetId]);
    async function refresh() {
        setIsLoading(true);
        setLoadError(null);
        try {
            const token = await ensureAccessToken();
            setCampaigns(await fetchCampaigns(token));
        }
        catch (err) {
            setLoadError(err instanceof Error ? err.message : "No se pudieron cargar las campanas");
        }
        finally {
            setIsLoading(false);
        }
    }
    function upsertCampaign(updated) {
        setCampaigns((current) => {
            if (current.some((entry) => entry.id === updated.id)) {
                return current.map((entry) => (entry.id === updated.id ? updated : entry));
            }
            return [updated, ...current];
        });
        setSelectedCampaignId(updated.id);
    }
    async function handleCreateCampaign() {
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
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo crear la campana");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveCampaignDetails() {
        if (!selectedCampaign) {
            return;
        }
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaign(selectedCampaign.id, {
                name: draft.name,
                summary: draft.summary,
                setting: draft.setting
            }, token));
            setFormError(null);
            setIsCampaignDetailsModalOpen(false);
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudieron guardar los detalles");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveDmNotes() {
        if (!selectedCampaign) {
            return;
        }
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaign(selectedCampaign.id, { notes: draft.notes }, token));
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudieron guardar las notas del DJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveSharedNotes() {
        if (!selectedCampaign) {
            return;
        }
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaign(selectedCampaign.id, { sharedNotes: draft.sharedNotes }, token));
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudieron guardar las notas compartidas");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleAddMember() {
        if (!selectedCampaign || !memberEmail.trim()) {
            return;
        }
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await addCampaignMember(selectedCampaign.id, { email: memberEmail.trim() }, token));
            setMemberEmail("");
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo agregar el miembro");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleRemoveMember(memberId) {
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await removeCampaignMember(memberId, token));
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo quitar el miembro");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleLinkCharacter() {
        if (!selectedCampaign || !selectedAvailableCharacterId) {
            return;
        }
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await linkCampaignCharacter(selectedCampaign.id, selectedAvailableCharacterId, token));
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo vincular el personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleUnlinkCharacter(linkId) {
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await unlinkCampaignCharacter(linkId, token));
            if (selectedSheetId === linkId) {
                setSelectedSheetId(null);
                setActiveSection("characters");
            }
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo desvincular el personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleCreateReference() {
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
            const createdReference = updated.references.find((entry) => entry.name === payload.name && entry.label === payload.label && entry.content === payload.content);
            setSelectedReferenceId(createdReference?.id ?? null);
            setFormError(null);
            setIsReferenceCreateModalOpen(false);
            setIsReferenceDetailModalOpen(Boolean(createdReference));
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo crear la referencia");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveReference() {
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
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo guardar la referencia");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleDeleteReference(referenceId) {
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const updated = await deleteCampaignReference(referenceId, token);
            upsertCampaign(updated);
            setSelectedReferenceId(null);
            setFormError(null);
            setIsReferenceDetailModalOpen(false);
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo eliminar la referencia");
        }
        finally {
            setIsSaving(false);
        }
    }
    function handlePrepareNewReference() {
        setFormError(null);
        setSelectedReferenceId(null);
        setReferenceForm(emptyReferenceForm);
        setReferenceAliasesText("");
        setIsReferenceDetailModalOpen(false);
        setIsReferenceCreateModalOpen(true);
    }
    function openReferenceDetail(referenceId) {
        setFormError(null);
        setSelectedReferenceId(referenceId);
        setIsReferenceCreateModalOpen(false);
        setIsReferenceDetailModalOpen(true);
    }
    return (_jsxs("main", { className: "campaign-dashboard", children: [!selectedCampaign ? (_jsxs("section", { className: "panel campaign-list-panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h1", { children: "Campanas" }), _jsx("p", { className: "section-help", children: "Notas compartidas, notas del DJ y personajes vinculados." })] }), _jsxs("div", { className: "toolbar", children: [isDirector ? (_jsx("button", { type: "button", onClick: () => {
                                            setFormError(null);
                                            setIsCreateCampaignModalOpen(true);
                                        }, children: "Nueva campana" })) : null, _jsx("button", { type: "button", disabled: isLoading, onClick: () => void refresh(), children: "Recargar" })] })] }), loadError ? _jsx("p", { className: "error-text", children: loadError }) : null, isLoading ? _jsx("p", { children: "Cargando campanas..." }) : null, _jsxs("div", { className: "campaign-list", children: [campaigns.map((campaign) => (_jsxs("button", { type: "button", className: `campaign-list-item${selectedCampaignId === campaign.id ? " is-active" : ""}`, onClick: () => {
                                    setSelectedCampaignId(campaign.id);
                                    setSelectedSheetId(null);
                                    setActiveSection(isDirector ? "dmNotes" : "sharedNotes");
                                }, children: [_jsx("strong", { children: campaign.name }), _jsx("span", { children: campaign.setting || campaign.summary || "Sin ambientacion" }), _jsxs("span", { children: [campaign.members.length, " miembros"] }), _jsxs("span", { children: [campaign.characters.length, " personajes vinculados"] })] }, campaign.id))), !isLoading && campaigns.length === 0 ? (_jsx("p", { className: "section-help", children: "Aun no hay campanas accesibles." })) : null] })] })) : null, selectedCampaign ? (_jsxs("section", { className: "campaign-main", children: [_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h2", { children: selectedCampaign.name }), selectedCampaign.summary ? _jsx("p", { className: "section-help", children: selectedCampaign.summary }) : null] }), _jsxs("div", { className: "campaign-header-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                                    setSelectedCampaignId(null);
                                                    setSelectedSheetId(null);
                                                    setActiveSection(isDirector ? "dmNotes" : "sharedNotes");
                                                }, children: "Volver a campanas" }), isDirector ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                    setFormError(null);
                                                    setIsCampaignDetailsModalOpen(true);
                                                }, children: "Detalles" })) : null] })] }), formError && !isCampaignDetailsModalOpen && !isReferenceCreateModalOpen && !isReferenceDetailModalOpen ? (_jsx("p", { className: "error-text", children: formError })) : null, _jsxs("div", { className: "toolbar campaign-section-nav", children: [isDirector ? (_jsx("button", { type: "button", className: activeSection === "dmNotes" ? "is-active" : "", onClick: () => setActiveSection("dmNotes"), children: "Notas DJ" })) : null, _jsx("button", { type: "button", className: activeSection === "sharedNotes" ? "is-active" : "", onClick: () => setActiveSection("sharedNotes"), children: "Notas compartidas" }), _jsx("button", { type: "button", className: activeSection === "wiki" ? "is-active" : "", onClick: () => setActiveSection("wiki"), children: "Wiki" }), _jsx("button", { type: "button", className: activeSection === "members" ? "is-active" : "", onClick: () => setActiveSection("members"), children: "Miembros" }), _jsx("button", { type: "button", className: activeSection === "characters" ? "is-active" : "", onClick: () => setActiveSection("characters"), children: "Personajes" })] })] }), isDirector && activeSection === "dmNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Notas privadas del DJ" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveDmNotes(), children: isSaving ? "Guardando..." : "Guardar" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Apuntes privados de campana" }), _jsx("textarea", { rows: 14, value: draft.notes, onChange: (event) => setDraft((current) => ({ ...current, notes: event.target.value })), placeholder: "Notas privadas para el director de juego" })] })] })) : null, activeSection === "sharedNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Notas compartidas" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveSharedNotes(), children: isSaving ? "Guardando..." : "Guardar" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas visibles para los miembros de la campana" }), _jsx("textarea", { rows: 14, value: draft.sharedNotes, onChange: (event) => setDraft((current) => ({ ...current, sharedNotes: event.target.value })), placeholder: "Apuntes de sesion, acuerdos del grupo, pistas, recordatorios..." })] })] })) : null, activeSection === "wiki" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Wiki de campana" }), _jsx("p", { className: "section-help", children: "Referencias internas para facciones, lugares, PNJ, tramas y cualquier termino reutilizable." })] }), isDirector ? (_jsx("button", { type: "button", disabled: isSaving, onClick: handlePrepareNewReference, children: "Nueva referencia" })) : null] }), _jsxs("div", { className: "campaign-reference-list", children: [selectedCampaign.references.map((reference) => (_jsxs("button", { type: "button", className: "campaign-list-item", onClick: () => openReferenceDetail(reference.id), children: [_jsx("strong", { children: reference.name }), _jsx("span", { children: reference.label }), _jsx("span", { children: reference.summary || "Sin resumen breve" }), reference.aliases.length > 0 ? _jsxs("span", { children: ["Alias: ", reference.aliases.join(", ")] }) : null, _jsx("span", { children: reference.isPublic ? "Visible para jugadores" : "Solo DJ" })] }, reference.id))), selectedCampaign.references.length === 0 ? (_jsx("p", { className: "section-help", children: "Aun no hay referencias en esta campana." })) : null] })] })) : null, activeSection === "members" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Miembros" }), isDirector ? (_jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Email del jugador" }), _jsx("input", { value: memberEmail, onChange: (event) => setMemberEmail(event.target.value) })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleAddMember(), children: "Agregar" })] })) : null] }), _jsx("div", { className: "cards", children: selectedCampaign.members.map((member) => (_jsxs("article", { className: "card", children: [_jsx("strong", { children: member.email }), _jsx("span", { children: member.role === "gm" ? "Director" : "Jugador" }), _jsxs("span", { children: ["Alta: ", new Date(member.joinedAt).toLocaleDateString()] }), isDirector && member.role !== "gm" ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleRemoveMember(member.id), children: "Quitar" })) : null] }, member.id))) })] })) : null, activeSection === "characters" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Personajes vinculados" }), _jsx("p", { className: "section-help", children: "El director puede revisar todas las hojas vinculadas desde aqui. Los jugadores pueden vincular sus propios personajes." })] }), _jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Personaje disponible" }), _jsxs("select", { value: selectedAvailableCharacterId, onChange: (event) => setSelectedAvailableCharacterId(event.target.value), children: [linkableCharacters.length === 0 ? _jsx("option", { value: "", children: "Sin personajes disponibles" }) : null, linkableCharacters.map((entry) => (_jsxs("option", { value: entry.characterId, children: [entry.name, " - ", entry.ownerEmail] }, entry.characterId)))] })] }), _jsx("button", { type: "button", disabled: isSaving || !selectedAvailableCharacterId, onClick: () => void handleLinkCharacter(), children: "Vincular" }), isDirector ? (_jsx("button", { type: "button", className: "subtle-button", onClick: () => setIsBurdenSummaryModalOpen(true), children: "Resumen de cargas" })) : null] })] }), _jsxs("div", { className: "cards", children: [selectedCampaign.characters.map((entry) => {
                                        const canManageLink = isDirector || entry.ownerId === user.id;
                                        return (_jsxs("article", { className: "card", children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.ownerEmail }), _jsxs("span", { children: ["PX total: ", entry.experienceTotal, " \u00C2\u00B7 PX gastada: ", entry.experienceSpent] }), _jsxs("span", { children: ["Actualizado: ", formatDate(entry.updatedAt)] }), _jsxs("div", { className: "card-actions", children: [isDirector && entry.sheet ? (_jsx("button", { type: "button", onClick: () => {
                                                                setSelectedSheetId(entry.id);
                                                            }, children: "Abrir hoja" })) : null, canManageLink ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleUnlinkCharacter(entry.id), children: "Desvincular" })) : null] })] }, entry.id));
                                    }), selectedCampaign.characters.length === 0 ? (_jsx("p", { className: "section-help", children: "Todavia no hay personajes vinculados." })) : null] })] })) : null, selectedSheetEntry && false ? (_jsx("section", { className: "campaign-sheet-shell", children: _jsx(UnifiedCharacterSheet, { title: campaignSheetModalEntry?.name ?? "", subtitle: `${selectedSheetEntry?.ownerEmail ?? ""} · Hoja vinculada a campana`, sheet: selectedSheetEntry.sheet, editable: false, busy: isSaving, onBack: () => {
                                setSelectedSheetId(null);
                                setActiveSection("characters");
                            } }) })) : null] })) : null, campaignSheetModalEntry ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    setSelectedSheetId(null);
                }, children: _jsxs("div", { className: "panel modal-panel campaign-character-sheet-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions campaign-character-sheet-modal-header", children: [_jsxs("div", { children: [_jsx("h3", { children: campaignSheetModalEntry.name }), _jsxs("p", { className: "section-help", children: [campaignSheetModalEntry.ownerEmail, " \u00C2\u00B7 Hoja vinculada a campana"] })] }), _jsx("button", { type: "button", onClick: () => setSelectedSheetId(null), children: "Cerrar" })] }), _jsx("div", { className: "campaign-character-sheet-modal-body", children: _jsx(UnifiedCharacterSheet, { title: campaignSheetModalEntry.name, subtitle: `${campaignSheetModalEntry.ownerEmail} Â· Hoja vinculada a campana`, sheet: campaignSheetModalEntry.sheet, editable: false, busy: isSaving }) })] }) })) : null, isDirector && isBurdenSummaryModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    setIsBurdenSummaryModalOpen(false);
                }, children: _jsxs("div", { className: "panel modal-panel campaign-character-sheet-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions campaign-character-sheet-modal-header", children: [_jsxs("div", { children: [_jsx("h3", { children: "Resumen de cargas" }), _jsx("p", { className: "section-help", children: "Vista rapida para el DJ con las cargas activas de los personajes vinculados y su explicacion." })] }), _jsxs("div", { className: "toolbar", children: [_jsxs("span", { className: "meta-text", children: [campaignBurdenDigest.length, " registradas"] }), _jsx("button", { type: "button", onClick: () => setIsBurdenSummaryModalOpen(false), children: "Cerrar" })] })] }), _jsx("div", { className: "campaign-character-sheet-modal-body", children: _jsxs("div", { className: "cards", children: [campaignBurdenDigest.map((burden) => (_jsxs("article", { className: "campaign-structured-card app-card-accent app-card-accent--carga", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("strong", { children: burden.burdenName }), _jsxs("p", { className: "section-help", children: [burden.characterName, " \u00B7 ", burden.ownerEmail] })] }), _jsx("span", { className: "compendium-chip", children: "Carga" })] }), _jsx("p", { children: burden.summary }), _jsx("p", { className: "section-help", children: burden.detail }), _jsx("span", { className: "meta-text", children: burden.source })] }, burden.id))), campaignBurdenDigest.length === 0 ? (_jsx("p", { className: "section-help", children: "No hay cargas registradas en los personajes vinculados." })) : null] }) })] }) })) : null, isCreateCampaignModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setFormError(null);
                        setIsCreateCampaignModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Nueva campana" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleCreateCampaign(), children: "Crear" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setFormError(null);
                                                setIsCreateCampaignModalOpen(false);
                                            }, children: "Cerrar" })] })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: campaignForm.name, onChange: (event) => setCampaignForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ambientacion" }), _jsx("input", { value: campaignForm.setting, onChange: (event) => setCampaignForm((current) => ({ ...current, setting: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 3, value: campaignForm.summary, onChange: (event) => setCampaignForm((current) => ({ ...current, summary: event.target.value })) })] })] }) })) : null, isDirector && isCampaignDetailsModalOpen && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setFormError(null);
                        setIsCampaignDetailsModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Detalles de campana" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveCampaignDetails(), children: "Guardar" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setFormError(null);
                                                setIsCampaignDetailsModalOpen(false);
                                            }, children: "Cerrar" })] })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: draft.name, onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ambientacion" }), _jsx("input", { value: draft.setting, onChange: (event) => setDraft((current) => ({ ...current, setting: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 4, value: draft.summary, onChange: (event) => setDraft((current) => ({ ...current, summary: event.target.value })) })] })] }) })) : null, isDirector && isReferenceCreateModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setFormError(null);
                        setIsReferenceCreateModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Nueva referencia" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleCreateReference(), children: isSaving ? "Creando..." : "Crear" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setFormError(null);
                                                setIsReferenceCreateModalOpen(false);
                                            }, children: "Cerrar" })] })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: referenceForm.name, onChange: (event) => setReferenceForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categoria" }), _jsx("input", { value: referenceForm.label, onChange: (event) => setReferenceForm((current) => ({ ...current, label: event.target.value })), placeholder: "PNJ, lugar, faccion, trama..." })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("input", { value: referenceForm.summary, onChange: (event) => setReferenceForm((current) => ({ ...current, summary: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Alias" }), _jsx("input", { value: referenceAliasesText, onChange: (event) => setReferenceAliasesText(event.target.value), placeholder: "Nombres alternativos separados por comas" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 12, value: referenceForm.content, onChange: (event) => setReferenceForm((current) => ({ ...current, content: event.target.value })), placeholder: "Detalle extenso de la referencia, usos, relaciones, pistas..." })] }), _jsxs("label", { className: "checkbox-field", children: [_jsx("input", { type: "checkbox", checked: referenceForm.isPublic, onChange: (event) => setReferenceForm((current) => ({ ...current, isPublic: event.target.checked })) }), _jsx("span", { children: "Visible para los jugadores" })] })] }) })) : null, isReferenceDetailModalOpen && selectedReference ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setFormError(null);
                        setIsReferenceDetailModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: selectedReference.name }), _jsx("p", { className: "section-help", children: selectedReference.label })] }), _jsxs("div", { className: "toolbar", children: [isDirector ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveReference(), children: isSaving ? "Guardando..." : "Guardar" }), _jsx("button", { type: "button", className: "danger-button", disabled: isSaving, onClick: () => void handleDeleteReference(selectedReference.id), children: "Eliminar" })] })) : null, _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setFormError(null);
                                                setIsReferenceDetailModalOpen(false);
                                            }, children: "Cerrar" })] })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, isDirector ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: referenceForm.name, onChange: (event) => setReferenceForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categoria" }), _jsx("input", { value: referenceForm.label, onChange: (event) => setReferenceForm((current) => ({ ...current, label: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("input", { value: referenceForm.summary, onChange: (event) => setReferenceForm((current) => ({ ...current, summary: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Alias" }), _jsx("input", { value: referenceAliasesText, onChange: (event) => setReferenceAliasesText(event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 12, value: referenceForm.content, onChange: (event) => setReferenceForm((current) => ({ ...current, content: event.target.value })) })] }), _jsxs("label", { className: "checkbox-field", children: [_jsx("input", { type: "checkbox", checked: referenceForm.isPublic, onChange: (event) => setReferenceForm((current) => ({ ...current, isPublic: event.target.checked })) }), _jsx("span", { children: "Visible para los jugadores" })] })] })) : (_jsxs("div", { className: "campaign-reference-preview", children: [selectedReference.summary ? _jsx("p", { children: selectedReference.summary }) : null, _jsx("p", { children: selectedReference.content || "Sin contenido detallado." }), selectedReference.aliases.length > 0 ? _jsxs("p", { children: ["Alias: ", selectedReference.aliases.join(", ")] }) : null] }))] }) })) : null] }));
}
