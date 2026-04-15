import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { createCampaignReferenceSchema, createCampaignSchema } from "@umbra/shared";
import { addCampaignMember, createCampaign, createCampaignReference, deleteCampaignReference, fetchCampaigns, linkCampaignCharacter, removeCampaignMember, unlinkCampaignCharacter, updateCampaign, updateCampaignReference } from "../services/campaignService";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
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
        return { campaignId: null, sheetId: null };
    }
    const [, search = ""] = rawHash.split("?");
    const params = new URLSearchParams(search);
    return {
        campaignId: params.get("id"),
        sheetId: params.get("sheetId")
    };
}
function replaceCampaignHash(campaignId, sheetId) {
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
function formatDate(value) {
    return new Date(value).toLocaleString();
}
export function CampaignDashboardView({ user, ensureAccessToken }) {
    const initialHash = parseCampaignHash();
    const isDirector = user.role === "gm" || user.role === "superadmin";
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState(initialHash.campaignId);
    const [selectedSheetId, setSelectedSheetId] = useState(initialHash.sheetId);
    const [activeSection, setActiveSection] = useState(isDirector ? "dmNotes" : "sharedNotes");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
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
    const selectedCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null, [campaigns, selectedCampaignId]);
    const selectedSheetEntry = useMemo(() => selectedCampaign?.characters.find((entry) => entry.id === selectedSheetId) ?? null, [selectedCampaign, selectedSheetId]);
    const selectedReference = useMemo(() => selectedCampaign?.references.find((entry) => entry.id === selectedReferenceId) ?? null, [selectedCampaign, selectedReferenceId]);
    const linkableCharacters = useMemo(() => (selectedCampaign?.availableCharacters ?? []).filter((entry) => !entry.linked && (isDirector || entry.ownerId === user.id)), [isDirector, selectedCampaign, user.id]);
    useEffect(() => {
        void refresh();
    }, []);
    useEffect(() => {
        function syncSelectionFromHash() {
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
            if (activeSection === "sheet") {
                setActiveSection("characters");
            }
        }
    }, [activeSection, selectedCampaign, selectedCampaignId, selectedSheetId]);
    async function refresh() {
        setIsLoading(true);
        setError(null);
        try {
            const token = await ensureAccessToken();
            setCampaigns(await fetchCampaigns(token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar las campanas");
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
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const created = await createCampaign(createCampaignSchema.parse(campaignForm), token);
            upsertCampaign(created);
            setCampaignForm(emptyCampaignForm);
            setIsCreateCampaignModalOpen(false);
            setActiveSection("dmNotes");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear la campana");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveCampaignDetails() {
        if (!selectedCampaign) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaign(selectedCampaign.id, {
                name: draft.name,
                summary: draft.summary,
                setting: draft.setting
            }, token));
            setIsCampaignDetailsModalOpen(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron guardar los detalles");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveDmNotes() {
        if (!selectedCampaign) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaign(selectedCampaign.id, { notes: draft.notes }, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron guardar las notas del DJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveSharedNotes() {
        if (!selectedCampaign) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaign(selectedCampaign.id, { sharedNotes: draft.sharedNotes }, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron guardar las notas compartidas");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleAddMember() {
        if (!selectedCampaign || !memberEmail.trim()) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await addCampaignMember(selectedCampaign.id, { email: memberEmail.trim() }, token));
            setMemberEmail("");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo agregar el miembro");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleRemoveMember(memberId) {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await removeCampaignMember(memberId, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo quitar el miembro");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleLinkCharacter() {
        if (!selectedCampaign || !selectedAvailableCharacterId) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await linkCampaignCharacter(selectedCampaign.id, selectedAvailableCharacterId, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo vincular el personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleUnlinkCharacter(linkId) {
        setError(null);
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
            setError(err instanceof Error ? err.message : "No se pudo desvincular el personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleCreateReference() {
        if (!selectedCampaign) {
            return;
        }
        setError(null);
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
            setIsReferenceCreateModalOpen(false);
            setIsReferenceDetailModalOpen(Boolean(createdReference));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear la referencia");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveReference() {
        if (!selectedReference) {
            return;
        }
        setError(null);
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
            setError(err instanceof Error ? err.message : "No se pudo guardar la referencia");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleDeleteReference(referenceId) {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const updated = await deleteCampaignReference(referenceId, token);
            upsertCampaign(updated);
            setSelectedReferenceId(null);
            setIsReferenceDetailModalOpen(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo eliminar la referencia");
        }
        finally {
            setIsSaving(false);
        }
    }
    function handlePrepareNewReference() {
        setSelectedReferenceId(null);
        setReferenceForm(emptyReferenceForm);
        setReferenceAliasesText("");
        setIsReferenceDetailModalOpen(false);
        setIsReferenceCreateModalOpen(true);
    }
    function openReferenceDetail(referenceId) {
        setSelectedReferenceId(referenceId);
        setIsReferenceCreateModalOpen(false);
        setIsReferenceDetailModalOpen(true);
    }
    return (_jsxs("main", { className: "campaign-dashboard", children: [!selectedCampaign ? (_jsxs("section", { className: "panel campaign-list-panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h1", { children: "Campanas" }), _jsx("p", { className: "section-help", children: "Notas compartidas, notas del DJ y personajes vinculados." })] }), _jsxs("div", { className: "toolbar", children: [isDirector ? (_jsx("button", { type: "button", onClick: () => setIsCreateCampaignModalOpen(true), children: "Nueva campana" })) : null, _jsx("button", { type: "button", disabled: isLoading, onClick: () => void refresh(), children: "Recargar" })] })] }), error ? _jsx("p", { className: "error-text", children: error }) : null, isLoading ? _jsx("p", { children: "Cargando campanas..." }) : null, _jsxs("div", { className: "campaign-list", children: [campaigns.map((campaign) => (_jsxs("button", { type: "button", className: `campaign-list-item${selectedCampaignId === campaign.id ? " is-active" : ""}`, onClick: () => {
                                    setSelectedCampaignId(campaign.id);
                                    setSelectedSheetId(null);
                                    setActiveSection(isDirector ? "dmNotes" : "sharedNotes");
                                }, children: [_jsx("strong", { children: campaign.name }), _jsx("span", { children: campaign.setting || campaign.summary || "Sin ambientacion" }), _jsxs("span", { children: [campaign.members.length, " miembros"] }), _jsxs("span", { children: [campaign.characters.length, " personajes vinculados"] })] }, campaign.id))), !isLoading && campaigns.length === 0 ? (_jsx("p", { className: "section-help", children: "Aun no hay campanas accesibles." })) : null] })] })) : null, selectedCampaign ? (_jsxs("section", { className: "campaign-main", children: [_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h2", { children: selectedCampaign.name }), selectedCampaign.summary ? _jsx("p", { className: "section-help", children: selectedCampaign.summary }) : null] }), _jsxs("div", { className: "campaign-header-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                                    setSelectedCampaignId(null);
                                                    setSelectedSheetId(null);
                                                    setActiveSection(isDirector ? "dmNotes" : "sharedNotes");
                                                }, children: "Volver a campanas" }), isDirector ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsCampaignDetailsModalOpen(true), children: "Detalles" })) : null] })] }), _jsxs("div", { className: "toolbar campaign-section-nav", children: [isDirector ? (_jsx("button", { type: "button", className: activeSection === "dmNotes" ? "is-active" : "", onClick: () => setActiveSection("dmNotes"), children: "Notas DJ" })) : null, _jsx("button", { type: "button", className: activeSection === "sharedNotes" ? "is-active" : "", onClick: () => setActiveSection("sharedNotes"), children: "Notas compartidas" }), _jsx("button", { type: "button", className: activeSection === "wiki" ? "is-active" : "", onClick: () => setActiveSection("wiki"), children: "Wiki" }), _jsx("button", { type: "button", className: activeSection === "members" ? "is-active" : "", onClick: () => setActiveSection("members"), children: "Miembros" }), _jsx("button", { type: "button", className: activeSection === "characters" ? "is-active" : "", onClick: () => setActiveSection("characters"), children: "Personajes" }), isDirector && selectedSheetEntry?.sheet ? (_jsx("button", { type: "button", className: activeSection === "sheet" ? "is-active" : "", onClick: () => setActiveSection("sheet"), children: "Hoja abierta" })) : null] })] }), isDirector && activeSection === "dmNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Notas privadas del DJ" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveDmNotes(), children: isSaving ? "Guardando..." : "Guardar" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Apuntes privados de campana" }), _jsx("textarea", { rows: 14, value: draft.notes, onChange: (event) => setDraft((current) => ({ ...current, notes: event.target.value })), placeholder: "Notas privadas para el director de juego" })] })] })) : null, activeSection === "sharedNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Notas compartidas" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveSharedNotes(), children: isSaving ? "Guardando..." : "Guardar" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas visibles para los miembros de la campana" }), _jsx("textarea", { rows: 14, value: draft.sharedNotes, onChange: (event) => setDraft((current) => ({ ...current, sharedNotes: event.target.value })), placeholder: "Apuntes de sesion, acuerdos del grupo, pistas, recordatorios..." })] })] })) : null, activeSection === "wiki" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Wiki de campana" }), _jsx("p", { className: "section-help", children: "Referencias internas para facciones, lugares, PNJ, tramas y cualquier termino reutilizable." })] }), isDirector ? (_jsx("button", { type: "button", disabled: isSaving, onClick: handlePrepareNewReference, children: "Nueva referencia" })) : null] }), _jsxs("div", { className: "campaign-reference-list", children: [selectedCampaign.references.map((reference) => (_jsxs("button", { type: "button", className: "campaign-list-item", onClick: () => openReferenceDetail(reference.id), children: [_jsx("strong", { children: reference.name }), _jsx("span", { children: reference.label }), _jsx("span", { children: reference.summary || "Sin resumen breve" }), reference.aliases.length > 0 ? _jsxs("span", { children: ["Alias: ", reference.aliases.join(", ")] }) : null, _jsx("span", { children: reference.isPublic ? "Visible para jugadores" : "Solo DJ" })] }, reference.id))), selectedCampaign.references.length === 0 ? (_jsx("p", { className: "section-help", children: "Aun no hay referencias en esta campana." })) : null] })] })) : null, activeSection === "members" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Miembros" }), isDirector ? (_jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Email del jugador" }), _jsx("input", { value: memberEmail, onChange: (event) => setMemberEmail(event.target.value) })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleAddMember(), children: "Agregar" })] })) : null] }), _jsx("div", { className: "cards", children: selectedCampaign.members.map((member) => (_jsxs("article", { className: "card", children: [_jsx("strong", { children: member.email }), _jsx("span", { children: member.role === "gm" ? "Director" : "Jugador" }), _jsxs("span", { children: ["Alta: ", new Date(member.joinedAt).toLocaleDateString()] }), isDirector && member.role !== "gm" ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleRemoveMember(member.id), children: "Quitar" })) : null] }, member.id))) })] })) : null, activeSection === "characters" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Personajes vinculados" }), _jsx("p", { className: "section-help", children: "El director puede revisar todas las hojas vinculadas desde aqui. Los jugadores pueden vincular sus propios personajes." })] }), _jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Personaje disponible" }), _jsxs("select", { value: selectedAvailableCharacterId, onChange: (event) => setSelectedAvailableCharacterId(event.target.value), children: [linkableCharacters.length === 0 ? _jsx("option", { value: "", children: "Sin personajes disponibles" }) : null, linkableCharacters.map((entry) => (_jsxs("option", { value: entry.characterId, children: [entry.name, " - ", entry.ownerEmail] }, entry.characterId)))] })] }), _jsx("button", { type: "button", disabled: isSaving || !selectedAvailableCharacterId, onClick: () => void handleLinkCharacter(), children: "Vincular" })] })] }), _jsxs("div", { className: "cards", children: [selectedCampaign.characters.map((entry) => {
                                        const canManageLink = isDirector || entry.ownerId === user.id;
                                        return (_jsxs("article", { className: "card", children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.ownerEmail }), _jsxs("span", { children: ["PX total: ", entry.experienceTotal, " \u00B7 PX gastada: ", entry.experienceSpent] }), _jsxs("span", { children: ["Actualizado: ", formatDate(entry.updatedAt)] }), _jsxs("div", { className: "card-actions", children: [isDirector && entry.sheet ? (_jsx("button", { type: "button", onClick: () => {
                                                                setSelectedSheetId(entry.id);
                                                                setActiveSection("sheet");
                                                            }, children: "Abrir hoja" })) : null, canManageLink ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleUnlinkCharacter(entry.id), children: "Desvincular" })) : null] })] }, entry.id));
                                    }), selectedCampaign.characters.length === 0 ? (_jsx("p", { className: "section-help", children: "Todavia no hay personajes vinculados." })) : null] })] })) : null, isDirector && activeSection === "sheet" && selectedSheetEntry?.sheet ? (_jsx("section", { className: "campaign-sheet-shell", children: _jsx(UnifiedCharacterSheet, { title: selectedSheetEntry.name, subtitle: `${selectedSheetEntry.ownerEmail} · Hoja vinculada a campana`, sheet: selectedSheetEntry.sheet, editable: false, busy: isSaving, onBack: () => {
                                setSelectedSheetId(null);
                                setActiveSection("characters");
                            } }) })) : null] })) : null, isCreateCampaignModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => !isSaving && setIsCreateCampaignModalOpen(false), children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Nueva campana" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleCreateCampaign(), children: "Crear" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsCreateCampaignModalOpen(false), children: "Cerrar" })] })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: campaignForm.name, onChange: (event) => setCampaignForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ambientacion" }), _jsx("input", { value: campaignForm.setting, onChange: (event) => setCampaignForm((current) => ({ ...current, setting: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 3, value: campaignForm.summary, onChange: (event) => setCampaignForm((current) => ({ ...current, summary: event.target.value })) })] })] }) })) : null, isDirector && isCampaignDetailsModalOpen && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => !isSaving && setIsCampaignDetailsModalOpen(false), children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Detalles de campana" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveCampaignDetails(), children: "Guardar" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsCampaignDetailsModalOpen(false), children: "Cerrar" })] })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: draft.name, onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ambientacion" }), _jsx("input", { value: draft.setting, onChange: (event) => setDraft((current) => ({ ...current, setting: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 4, value: draft.summary, onChange: (event) => setDraft((current) => ({ ...current, summary: event.target.value })) })] })] }) })) : null, isDirector && isReferenceCreateModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => !isSaving && setIsReferenceCreateModalOpen(false), children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Nueva referencia" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleCreateReference(), children: isSaving ? "Creando..." : "Crear" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsReferenceCreateModalOpen(false), children: "Cerrar" })] })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: referenceForm.name, onChange: (event) => setReferenceForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categoria" }), _jsx("input", { value: referenceForm.label, onChange: (event) => setReferenceForm((current) => ({ ...current, label: event.target.value })), placeholder: "PNJ, lugar, faccion, trama..." })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("input", { value: referenceForm.summary, onChange: (event) => setReferenceForm((current) => ({ ...current, summary: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Alias" }), _jsx("input", { value: referenceAliasesText, onChange: (event) => setReferenceAliasesText(event.target.value), placeholder: "Nombres alternativos separados por comas" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 12, value: referenceForm.content, onChange: (event) => setReferenceForm((current) => ({ ...current, content: event.target.value })), placeholder: "Detalle extenso de la referencia, usos, relaciones, pistas..." })] }), _jsxs("label", { className: "checkbox-field", children: [_jsx("input", { type: "checkbox", checked: referenceForm.isPublic, onChange: (event) => setReferenceForm((current) => ({ ...current, isPublic: event.target.checked })) }), _jsx("span", { children: "Visible para los jugadores" })] })] }) })) : null, isReferenceDetailModalOpen && selectedReference ? (_jsx("section", { className: "modal-backdrop", onClick: () => !isSaving && setIsReferenceDetailModalOpen(false), children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: selectedReference.name }), _jsx("p", { className: "section-help", children: selectedReference.label })] }), _jsxs("div", { className: "toolbar", children: [isDirector ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveReference(), children: isSaving ? "Guardando..." : "Guardar" }), _jsx("button", { type: "button", className: "danger-button", disabled: isSaving, onClick: () => void handleDeleteReference(selectedReference.id), children: "Eliminar" })] })) : null, _jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsReferenceDetailModalOpen(false), children: "Cerrar" })] })] }), isDirector ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: referenceForm.name, onChange: (event) => setReferenceForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categoria" }), _jsx("input", { value: referenceForm.label, onChange: (event) => setReferenceForm((current) => ({ ...current, label: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("input", { value: referenceForm.summary, onChange: (event) => setReferenceForm((current) => ({ ...current, summary: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Alias" }), _jsx("input", { value: referenceAliasesText, onChange: (event) => setReferenceAliasesText(event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 12, value: referenceForm.content, onChange: (event) => setReferenceForm((current) => ({ ...current, content: event.target.value })) })] }), _jsxs("label", { className: "checkbox-field", children: [_jsx("input", { type: "checkbox", checked: referenceForm.isPublic, onChange: (event) => setReferenceForm((current) => ({ ...current, isPublic: event.target.checked })) }), _jsx("span", { children: "Visible para los jugadores" })] })] })) : (_jsxs("div", { className: "campaign-reference-preview", children: [selectedReference.summary ? _jsx("p", { children: selectedReference.summary }) : null, _jsx("p", { children: selectedReference.content || "Sin contenido detallado." }), selectedReference.aliases.length > 0 ? _jsxs("p", { children: ["Alias: ", selectedReference.aliases.join(", ")] }) : null] }))] }) })) : null] }));
}
