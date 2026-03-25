import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { buildRollRequest, createCampaignNpcSchema, deriveCharacterActions, executeCharacterAction, createCampaignReferenceSchema, createCampaignSchema, createCampaignSessionSchema } from "@umbra/shared";
import { addCampaignMember, assignCampaignSessionExperience, createCampaign, createCampaignNpc, createCampaignNpcSheet, createCampaignReference, createCampaignSession, deleteCampaignNpc, deleteCampaignReference, deleteCampaignSession, fetchCampaigns, generateCampaignNpc, grantCampaignExperience, linkCampaignCharacter, removeCampaignMember, unlinkCampaignCharacter, updateCampaign, updateCampaignCharacterSheet, updateCampaignNpc, updateCampaignNpcSheet, updateCampaignReference, updateCampaignSession } from "../services/campaignService";
import { dispatchRoll20Request } from "../services/rollTransport";
const emptyCampaignForm = { name: "", summary: "", setting: "", notes: "", sharedNotes: "" };
const emptyNpcForm = {
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
const emptySessionForm = {
    title: "",
    scheduledFor: new Date().toISOString(),
    location: "",
    summary: "",
    publicNotes: "",
    dmNotes: "",
    status: "planned"
};
const emptyReferenceForm = {
    name: "",
    label: "",
    aliases: [],
    summary: "",
    content: "",
    isPublic: false
};
const referenceFieldLabels = {
    name: "Nombre",
    label: "Etiqueta",
    aliases: "Alias",
    summary: "Resumen corto",
    content: "Contenido"
};
function toLocalDateTimeValue(value) {
    const date = new Date(value);
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
function fromLocalDateTimeValue(value) {
    return new Date(value).toISOString();
}
function makeDefaultSessionForm() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(20, 0, 0, 0);
    return { ...emptySessionForm, scheduledFor: date.toISOString() };
}
function parseCampaignHash() {
    const rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash.startsWith("campaigns")) {
        return { campaignId: null, sessionId: null, sheetKind: null, sheetId: null };
    }
    const [, search = ""] = rawHash.split("?");
    const params = new URLSearchParams(search);
    const rawSheetKind = params.get("sheetKind");
    const sheetKind = rawSheetKind === "character" || rawSheetKind === "npc" ? rawSheetKind : null;
    return {
        campaignId: params.get("id"),
        sessionId: params.get("session"),
        sheetKind,
        sheetId: params.get("sheetId")
    };
}
function replaceCampaignHash(campaignId, sessionId, sheetTarget) {
    const params = new URLSearchParams();
    if (campaignId) {
        params.set("id", campaignId);
    }
    if (sessionId) {
        params.set("session", sessionId);
    }
    if (sheetTarget?.kind === "character") {
        params.set("sheetKind", "character");
        params.set("sheetId", sheetTarget.linkId);
    }
    else if (sheetTarget?.kind === "npc") {
        params.set("sheetKind", "npc");
        params.set("sheetId", sheetTarget.npcId);
    }
    const nextHash = params.toString() ? `#campaigns?${params.toString()}` : "#campaigns";
    if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash);
    }
}
function getMatchingSessionId(campaign, draft) {
    const matches = campaign.sessions.filter((session) => {
        return (session.title === draft.title &&
            session.scheduledFor === draft.scheduledFor &&
            session.location === draft.location &&
            session.summary === draft.summary &&
            session.publicNotes === draft.publicNotes &&
            session.dmNotes === draft.dmNotes &&
            session.status === draft.status);
    });
    return matches[0]?.id ?? campaign.sessions[0]?.id ?? null;
}
function aliasesToInput(value) {
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function aliasesToText(value) {
    return value.join(", ");
}
function formatReferenceValidationIssues(issues) {
    return issues.map((issue) => {
        const rawField = typeof issue.path[0] === "string" ? issue.path[0] : "field";
        const field = referenceFieldLabels[rawField] ?? rawField;
        if (issue.code === "too_small" && issue.type === "string" && issue.minimum === 2) {
            return `${field}: debe contener al menos 2 caracteres.`;
        }
        if (issue.code === "too_big" && issue.type === "string") {
            return `${field}: no puede superar ${issue.maximum} caracteres.`;
        }
        if (rawField === "aliases" && issue.code === "too_big") {
            return "Alias: no puede haber m?s de 20 alias.";
        }
        return `${field}: ${issue.message}.`;
    });
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getReferenceTerms(references) {
    const seen = new Set();
    const terms = [];
    for (const reference of references) {
        for (const rawTerm of [reference.name, ...reference.aliases]) {
            const term = rawTerm.trim();
            const key = term.toLocaleLowerCase();
            if (!term || seen.has(key)) {
                continue;
            }
            seen.add(key);
            terms.push({ referenceId: reference.id, term });
        }
    }
    return terms.sort((left, right) => right.term.length - left.term.length);
}
function renderLinkedText(text, references, onOpenReference) {
    if (!text.trim() || references.length === 0) {
        return text;
    }
    const terms = getReferenceTerms(references);
    if (terms.length === 0) {
        return text;
    }
    const pattern = terms.map((entry) => escapeRegExp(entry.term)).join("|");
    if (!pattern) {
        return text;
    }
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, "giu");
    const lookup = new Map(terms.map((entry) => [entry.term.toLocaleLowerCase(), entry.referenceId]));
    const nodes = [];
    let lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
        const start = match.index;
        const end = start + match[0].length;
        const referenceId = lookup.get(match[0].toLocaleLowerCase());
        if (start > lastIndex) {
            nodes.push(text.slice(lastIndex, start));
        }
        if (referenceId) {
            nodes.push(_jsx("button", { type: "button", className: "campaign-reference-link", onClick: () => onOpenReference(referenceId), children: match[0] }, `${referenceId}-${start}`));
        }
        else {
            nodes.push(match[0]);
        }
        lastIndex = end;
        match = regex.exec(text);
    }
    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }
    return nodes.length > 0 ? nodes.map((node, index) => _jsx(Fragment, { children: node }, index)) : text;
}
function renderActionRollGroup(title, rolls, keyPrefix) {
    return (_jsxs("div", { className: "campaign-roll-group", children: [_jsx("strong", { children: title }), _jsx("div", { className: "campaign-roll-group-lines", children: rolls.map((roll, index) => (_jsxs("span", { children: [roll.label, ": ", roll.formula, " = ", roll.total, typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "éxito" : "fallo"}` : ""] }, `${keyPrefix}-${index}`))) })] }, keyPrefix));
}
function renderActionRolls(rolls, keyPrefix) {
    const attackRolls = rolls.filter((roll) => roll.kind === "attack_check");
    const checkRolls = rolls.filter((roll) => roll.kind === "attribute_check");
    const damageRolls = rolls.filter((roll) => roll.kind === "damage");
    const blocks = [];
    if (attackRolls.length > 0) {
        blocks.push(renderActionRollGroup("Ataque", attackRolls, `${keyPrefix}-attack`));
    }
    if (checkRolls.length > 0) {
        blocks.push(renderActionRollGroup("Prueba", checkRolls, `${keyPrefix}-check`));
    }
    if (damageRolls.length > 0) {
        blocks.push(renderActionRollGroup("Daño", damageRolls, `${keyPrefix}-damage`));
    }
    if (blocks.length > 0) {
        return blocks;
    }
    return rolls.map((roll, index) => (_jsxs("span", { children: [roll.label, ": ", roll.formula, " = ", roll.total, typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "éxito" : "fallo"}` : ""] }, `${keyPrefix}-${index}`)));
}
function getActionPhaseLabel(action, phase) {
    if (phase === "damage") {
        return "Tirar daño";
    }
    return action.sourceType === "weapon" ? "Tirar ataque" : "Tirar prueba";
}
export function CampaignDashboardView({ user, ensureAccessToken }) {
    const initialHashState = parseCampaignHash();
    const isDirector = user.role === "gm" || user.role === "superadmin";
    const rootRef = useRef(null);
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState(initialHashState.campaignId);
    const [selectedSessionId, setSelectedSessionId] = useState(initialHashState.sessionId);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
    const [draft, setDraft] = useState(emptyCampaignForm);
    const [memberEmail, setMemberEmail] = useState("");
    const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
    const [npcForm, setNpcForm] = useState(emptyNpcForm);
    const [xpForm, setXpForm] = useState({ characterId: "", amount: 1, reason: "" });
    const [sessionForm, setSessionForm] = useState(makeDefaultSessionForm());
    const [sessionXpDraft, setSessionXpDraft] = useState({});
    const [referenceForm, setReferenceForm] = useState(emptyReferenceForm);
    const [referenceAliasesText, setReferenceAliasesText] = useState("");
    const [referenceValidationErrors, setReferenceValidationErrors] = useState([]);
    const [selectedReferenceId, setSelectedReferenceId] = useState(null);
    const [isReferenceEditorOpen, setIsReferenceEditorOpen] = useState(false);
    const [isReferenceDetailOpen, setIsReferenceDetailOpen] = useState(false);
    const [selectedSheetTarget, setSelectedSheetTarget] = useState(initialHashState.sheetKind === "character" && initialHashState.sheetId
        ? { kind: "character", linkId: initialHashState.sheetId }
        : initialHashState.sheetKind === "npc" && initialHashState.sheetId
            ? { kind: "npc", npcId: initialHashState.sheetId }
            : null);
    const [activeSection, setActiveSection] = useState("wiki");
    const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
    const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
    const [isSessionEditorOpen, setIsSessionEditorOpen] = useState(false);
    const [isSessionCloseModalOpen, setIsSessionCloseModalOpen] = useState(false);
    useEffect(() => {
        const root = rootRef.current;
        if (!root) {
            return;
        }
        const fields = root.querySelectorAll("input, textarea, select");
        fields.forEach((field) => {
            field.setAttribute("data-bwignore", "true");
            field.setAttribute("data-1p-ignore", "true");
            field.setAttribute("data-lpignore", "true");
            if (!field.getAttribute("autocomplete")) {
                field.setAttribute("autocomplete", "off");
            }
        });
    });
    const selectedCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null, [campaigns, selectedCampaignId]);
    const selectedSession = useMemo(() => selectedCampaign?.sessions.find((session) => session.id === selectedSessionId) ?? null, [selectedCampaign, selectedSessionId]);
    const selectedReference = useMemo(() => selectedCampaign?.references.find((reference) => reference.id === selectedReferenceId) ?? null, [selectedCampaign, selectedReferenceId]);
    const selectedCharacterSheetEntry = useMemo(() => selectedSheetTarget?.kind === "character"
        ? (selectedCampaign?.characters.find((entry) => entry.id === selectedSheetTarget.linkId) ?? null)
        : null, [selectedCampaign, selectedSheetTarget]);
    const selectedNpcSheetEntry = useMemo(() => selectedSheetTarget?.kind === "npc"
        ? (selectedCampaign?.npcs.find((entry) => entry.id === selectedSheetTarget.npcId) ?? null)
        : null, [selectedCampaign, selectedSheetTarget]);
    const availableUnlinkedCharacters = useMemo(() => selectedCampaign?.availableCharacters.filter((entry) => !entry.linked) ?? [], [selectedCampaign]);
    useEffect(() => {
        void refresh();
    }, []);
    useEffect(() => {
        function syncSelectionFromHash() {
            const { campaignId, sessionId, sheetKind, sheetId } = parseCampaignHash();
            setSelectedCampaignId(campaignId);
            setSelectedSessionId(sessionId);
            setSelectedSheetTarget(sheetKind === "character" && sheetId
                ? { kind: "character", linkId: sheetId }
                : sheetKind === "npc" && sheetId
                    ? { kind: "npc", npcId: sheetId }
                    : null);
        }
        syncSelectionFromHash();
        window.addEventListener("hashchange", syncSelectionFromHash);
        return () => window.removeEventListener("hashchange", syncSelectionFromHash);
    }, []);
    useEffect(() => {
        if (isLoading) {
            return;
        }
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
        const fallbackCampaignId = hashState.campaignId && campaigns.some((campaign) => campaign.id === hashState.campaignId)
            ? hashState.campaignId
            : null;
        setSelectedCampaignId(fallbackCampaignId);
    }, [campaigns, isLoading, selectedCampaignId]);
    useEffect(() => {
        if (isLoading) {
            return;
        }
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
        const fallbackSessionId = hashState.sessionId && selectedCampaign.sessions.some((session) => session.id === hashState.sessionId)
            ? hashState.sessionId
            : selectedCampaign.sessions[0]?.id ?? null;
        setSelectedSessionId(fallbackSessionId);
    }, [isLoading, selectedCampaign, selectedSessionId]);
    useEffect(() => {
        replaceCampaignHash(selectedCampaignId, selectedSessionId, selectedSheetTarget);
    }, [selectedCampaignId, selectedSessionId, selectedSheetTarget]);
    useEffect(() => {
        if (!selectedCampaign) {
            setDraft(emptyCampaignForm);
            setSelectedAvailableCharacterId("");
            setXpForm({ characterId: "", amount: 1, reason: "" });
            setSessionForm(makeDefaultSessionForm());
            setSessionXpDraft({});
            setReferenceForm(emptyReferenceForm);
            setReferenceAliasesText("");
            setReferenceValidationErrors([]);
            setSelectedReferenceId(null);
            setSelectedSheetTarget(null);
            return;
        }
        setDraft((current) => {
            const next = {
                name: selectedCampaign.name,
                summary: selectedCampaign.summary,
                setting: selectedCampaign.setting,
                notes: selectedCampaign.notes,
                sharedNotes: selectedCampaign.sharedNotes
            };
            return current.name === next.name &&
                current.summary === next.summary &&
                current.setting === next.setting &&
                current.notes === next.notes &&
                current.sharedNotes === next.sharedNotes
                ? current
                : next;
        });
        setSelectedAvailableCharacterId((current) => {
            const next = availableUnlinkedCharacters[0]?.characterId ?? "";
            return current === next ? current : next;
        });
        setXpForm((prev) => ({
            characterId: selectedCampaign.characters.some((entry) => entry.characterId === prev.characterId)
                ? prev.characterId
                : (selectedCampaign.characters[0]?.characterId ?? ""),
            amount: prev.amount,
            reason: prev.reason
        }));
        setSelectedReferenceId((current) => current && selectedCampaign.references.some((reference) => reference.id === current)
            ? current
            : (selectedCampaign.references[0]?.id ?? null));
    }, [availableUnlinkedCharacters, isDirector, selectedCampaign, user.id]);
    useEffect(() => {
        if (!selectedSheetTarget || !selectedCampaign) {
            return;
        }
        if (selectedSheetTarget.kind === "character") {
            if (!selectedCampaign.characters.some((entry) => entry.id === selectedSheetTarget.linkId)) {
                setSelectedSheetTarget(null);
            }
            return;
        }
        if (!selectedCampaign.npcs.some((entry) => entry.id === selectedSheetTarget.npcId)) {
            setSelectedSheetTarget(null);
        }
    }, [selectedCampaign, selectedSheetTarget]);
    useEffect(() => {
        if (!selectedCampaign) {
            if (activeSection !== "wiki") {
                setActiveSection("wiki");
            }
            return;
        }
        if (selectedSheetTarget) {
            if (activeSection !== "sheet") {
                setActiveSection("sheet");
            }
            return;
        }
        if (activeSection === "sheet") {
            setActiveSection("characters");
        }
    }, [activeSection, selectedCampaign, selectedSheetTarget]);
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
        setReferenceAliasesText(aliasesToText(selectedReference.aliases));
    }, [selectedReference]);
    async function refresh() {
        setIsLoading(true);
        setError(null);
        try {
            const token = await ensureAccessToken();
            setCampaigns(await fetchCampaigns(token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar las campañas");
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
    function openReference(referenceId) {
        setSelectedReferenceId(referenceId);
        setActiveSection("wiki");
        setIsReferenceDetailOpen(true);
    }
    function openCreateReferenceEditor() {
        setSelectedReferenceId(null);
        setReferenceForm(emptyReferenceForm);
        setReferenceAliasesText("");
        setReferenceValidationErrors([]);
        setIsReferenceDetailOpen(false);
        setIsReferenceEditorOpen(true);
    }
    function openEditReferenceEditor(referenceId) {
        setSelectedReferenceId(referenceId);
        setReferenceValidationErrors([]);
        setIsReferenceDetailOpen(false);
        setIsReferenceEditorOpen(true);
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear la campaña");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveCampaign() {
        if (!selectedCampaign) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaign(selectedCampaign.id, draft, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar la campaña");
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
            setError(err instanceof Error ? err.message : "No se pudo agregar el jugador");
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo desvincular el personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveCharacterSheet(linkId, sheet) {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaignCharacterSheet(linkId, { sheet }, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar la hoja del personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleCreateNpc() {
        if (!selectedCampaign) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await createCampaignNpc(selectedCampaign.id, createCampaignNpcSchema.parse(npcForm), token));
            setNpcForm(emptyNpcForm);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear el PNJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleGenerateNpc() {
        if (!selectedCampaign) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await generateCampaignNpc(selectedCampaign.id, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo generar el PNJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleUpdateNpc(npcId, payload) {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaignNpc(npcId, payload, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo actualizar el PNJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleDeleteNpc(npcId) {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await deleteCampaignNpc(npcId, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo eliminar el PNJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleGrantXp() {
        if (!selectedCampaign || !xpForm.characterId || !xpForm.reason.trim()) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await grantCampaignExperience(selectedCampaign.id, {
                characterId: xpForm.characterId,
                amount: Number(xpForm.amount),
                reason: xpForm.reason.trim()
            }, token));
            setXpForm((prev) => ({ ...prev, reason: "" }));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo otorgar PX");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleCreateSession() {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear la sesión");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveSession() {
        if (!selectedSession) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaignSession(selectedSession.id, { ...sessionForm }, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar la sesión");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleDeleteSession(sessionId) {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const updated = await deleteCampaignSession(sessionId, token);
            upsertCampaign(updated);
            setIsSessionEditorOpen(false);
            setSelectedSessionId(updated.sessions[0]?.id ?? null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo eliminar la sesión");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleCloseSession() {
        if (!selectedSession || !selectedCampaign) {
            return;
        }
        const awards = selectedCampaign.characters
            .map((entry) => ({
            characterId: entry.characterId,
            amount: Number(sessionXpDraft[entry.characterId] || 0)
        }))
            .filter((entry) => entry.amount > 0);
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            let updated = await updateCampaignSession(selectedSession.id, { status: "completed" }, token);
            if (awards.length > 0) {
                updated = await assignCampaignSessionExperience(selectedSession.id, { awards }, token);
            }
            upsertCampaign(updated);
            setSelectedSessionId(selectedSession.id);
            setSessionXpDraft(Object.fromEntries(updated.characters.map((entry) => [entry.characterId, 0])));
            setIsSessionCloseModalOpen(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cerrar la sesión");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleAssignSessionXp() {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo asignar PX de sesión");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleCreateNpcSheet(npcId) {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await createCampaignNpcSheet(npcId, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear la hoja del PNJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleSaveNpcSheet(npcId, sheet) {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaignNpcSheet(npcId, { sheet }, token));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar la hoja del PNJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleCreateReference() {
        if (!selectedCampaign) {
            return;
        }
        const parsedInput = createCampaignReferenceSchema.safeParse({
            ...referenceForm,
            aliases: aliasesToInput(referenceAliasesText)
        });
        if (!parsedInput.success) {
            setReferenceValidationErrors(formatReferenceValidationIssues(parsedInput.error.issues));
            return;
        }
        setReferenceValidationErrors([]);
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const parsed = parsedInput.data;
            const updated = await createCampaignReference(selectedCampaign.id, parsed, token);
            upsertCampaign(updated);
            setReferenceForm(emptyReferenceForm);
            setReferenceAliasesText("");
            const createdReferenceId = updated.references.find((reference) => reference.name === parsed.name &&
                reference.label === parsed.label &&
                reference.summary === parsed.summary &&
                reference.content === parsed.content)?.id ?? updated.references[0]?.id ?? null;
            setSelectedReferenceId(createdReferenceId);
            setIsReferenceEditorOpen(false);
            setIsReferenceDetailOpen(createdReferenceId !== null);
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
        const parsedInput = createCampaignReferenceSchema.safeParse({
            ...referenceForm,
            aliases: aliasesToInput(referenceAliasesText)
        });
        if (!parsedInput.success) {
            setReferenceValidationErrors(formatReferenceValidationIssues(parsedInput.error.issues));
            return;
        }
        setReferenceValidationErrors([]);
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const parsed = parsedInput.data;
            const updated = await updateCampaignReference(selectedReference.id, parsed, token);
            upsertCampaign(updated);
            setSelectedReferenceId(selectedReference.id);
            setIsReferenceEditorOpen(false);
            setIsReferenceDetailOpen(true);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar la referencia");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleDeleteReference() {
        if (!selectedReference) {
            return;
        }
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const deletedId = selectedReference.id;
            const updated = await deleteCampaignReference(deletedId, token);
            upsertCampaign(updated);
            setSelectedReferenceId(updated.references.find((reference) => reference.id !== deletedId)?.id ?? updated.references[0]?.id ?? null);
            setIsReferenceEditorOpen(false);
            setIsReferenceDetailOpen(false);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo eliminar la referencia");
        }
        finally {
            setIsSaving(false);
        }
    }
    return (_jsxs("section", { className: "campaigns-module", ref: rootRef, children: [!selectedCampaign ? (_jsxs("section", { className: "panel campaign-hero", children: [_jsx("h2", { children: "Gestor de Campa\u00F1as" }), _jsx("p", { children: "Centraliza miembros, personajes vinculados, sesiones del DJ, PNJs y reparto de experiencia." })] })) : null, error ? (_jsx("section", { className: "panel error-list", children: _jsx("p", { children: error }) })) : null, !selectedCampaign ? (_jsxs("section", { className: "panel campaign-list-page", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Campa\u00F1as" }), _jsxs("div", { className: "toolbar", children: [isDirector ? (_jsx("button", { type: "button", onClick: () => {
                                            setCampaignForm(emptyCampaignForm);
                                            setIsCreateCampaignModalOpen(true);
                                        }, children: "Nueva campa\u00F1a" })) : null, _jsx("button", { disabled: isLoading, onClick: () => void refresh(), children: "Recargar" })] })] }), isLoading ? _jsx("p", { children: "Cargando campa\u00F1as..." }) : null, _jsxs("div", { className: "campaign-list", children: [campaigns.map((campaign) => (_jsxs("button", { className: "campaign-list-item", onClick: () => {
                                    setSelectedCampaignId(campaign.id);
                                    setSelectedSessionId(null);
                                    setSelectedSheetTarget(null);
                                    setActiveSection("wiki");
                                }, children: [_jsx("strong", { children: campaign.name }), _jsx("span", { children: campaign.setting || "Sin ambientación" }), _jsxs("span", { children: [campaign.members.length, " miembros"] }), _jsxs("span", { children: [campaign.sessions.length, " sesiones"] })] }, campaign.id))), !isLoading && campaigns.length === 0 ? (_jsx("p", { className: "section-help", children: "A\u00FAn no hay campa\u00F1as accesibles." })) : null] })] })) : (_jsxs("section", { className: "campaign-main", children: [_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("button", { className: "subtle-button", onClick: () => {
                                                    replaceCampaignHash(null, null, null);
                                                    setSelectedCampaignId(null);
                                                    setSelectedSessionId(null);
                                                    setSelectedReferenceId(null);
                                                    setSelectedSheetTarget(null);
                                                    setActiveSection("wiki");
                                                }, children: "Volver a campa\u00F1as" }), _jsx("h2", { children: selectedCampaign.name }), _jsxs("p", { className: "meta-text", children: ["DJ: ", _jsx("strong", { children: selectedCampaign.gmEmail })] })] }), _jsx("div", { className: "campaign-header-actions", children: isDirector ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsCampaignDetailsModalOpen(true), children: "Detalles" })) : null })] }), _jsxs("div", { className: "toolbar campaign-section-nav", children: [_jsx("button", { type: "button", className: activeSection === "wiki" ? "is-active" : "", onClick: () => setActiveSection("wiki"), children: "Wiki" }), _jsx("button", { type: "button", className: activeSection === "sharedNotes" ? "is-active" : "", onClick: () => setActiveSection("sharedNotes"), children: "Notas compartidas" }), _jsx("button", { type: "button", className: activeSection === "members" ? "is-active" : "", onClick: () => setActiveSection("members"), children: "Miembros" }), _jsx("button", { type: "button", className: activeSection === "sessions" ? "is-active" : "", onClick: () => setActiveSection("sessions"), children: "Sesiones" }), _jsx("button", { type: "button", className: activeSection === "characters" ? "is-active" : "", onClick: () => setActiveSection("characters"), children: "Personajes" }), _jsx("button", { type: "button", className: activeSection === "npcs" ? "is-active" : "", onClick: () => setActiveSection("npcs"), children: "PNJ" }), _jsx("button", { type: "button", className: activeSection === "xp" ? "is-active" : "", onClick: () => setActiveSection("xp"), children: "PX" }), selectedSheetTarget ? (_jsx("button", { type: "button", className: activeSection === "sheet" ? "is-active" : "", onClick: () => setActiveSection("sheet"), children: "Hoja abierta" })) : null] })] }), activeSection === "wiki" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Wiki de campa\u00F1a" }), isDirector ? (_jsx("button", { disabled: isSaving, onClick: openCreateReferenceEditor, children: "Nueva referencia" })) : null] }), _jsxs("div", { className: "cards", children: [selectedCampaign.references.map((reference) => (_jsxs("article", { className: "card campaign-reference-card", children: [_jsx("strong", { children: reference.name }), _jsx("span", { children: reference.label || "Sin etiqueta" }), _jsx("span", { children: reference.isPublic ? "Visible para jugadores" : "Solo DJ" }), reference.summary ? _jsx("p", { children: reference.summary }) : null, _jsxs("div", { className: "card-actions", children: [_jsx("button", { type: "button", onClick: () => openReference(reference.id), children: "Ver detalle" }), isDirector ? (_jsx("button", { type: "button", onClick: () => openEditReferenceEditor(reference.id), children: "Editar" })) : null] })] }, reference.id))), selectedCampaign.references.length === 0 ? (_jsx("p", { className: "section-help", children: "A\u00FAn no hay referencias creadas para esta campa\u00F1a." })) : null] })] })) : null, activeSection === "sharedNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Notas compartidas de campa\u00F1a" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveSharedNotes(), children: isSaving ? "Guardando..." : "Guardar notas compartidas" })] }), _jsxs("div", { className: "campaign-wiki-shared-notes", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas compartidas de campa\u00F1a" }), _jsx("textarea", { rows: 10, value: draft.sharedNotes, onChange: (event) => setDraft((prev) => ({ ...prev, sharedNotes: event.target.value })), placeholder: "Apuntes comunes de la campa\u00F1a para jugadores y DJ" })] }), _jsx("p", { className: "section-help", children: "Estas notas son visibles y editables por todos los miembros de la campa\u00F1a." }), _jsx(CampaignLinkedTextBlock, { title: "Vista enlazada de notas compartidas", text: draft.sharedNotes, references: selectedCampaign?.references ?? [], onOpenReference: openReference })] })] })) : null, isReferenceEditorOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                            if (!isSaving) {
                                setIsReferenceEditorOpen(false);
                            }
                        }, children: _jsxs("div", { className: "panel modal-panel campaign-reference-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: selectedReference ? "Editar referencia" : "Crear referencia" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { disabled: isSaving, onClick: () => void (selectedReference ? handleSaveReference() : handleCreateReference()), children: selectedReference ? "Guardar referencia" : "Crear referencia" }), selectedReference ? (_jsx("button", { className: "danger", disabled: isSaving, onClick: () => void handleDeleteReference(), children: "Eliminar referencia" })) : null, _jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsReferenceEditorOpen(false), children: "Cerrar" })] })] }), referenceValidationErrors.length > 0 ? (_jsx("div", { className: "error-list", children: referenceValidationErrors.map((message) => (_jsx("p", { children: message }, message))) })) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: referenceForm.name, onChange: (event) => { setReferenceValidationErrors([]); setReferenceForm((prev) => ({ ...prev, name: event.target.value })); } })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Etiqueta" }), _jsx("input", { value: referenceForm.label, onChange: (event) => { setReferenceValidationErrors([]); setReferenceForm((prev) => ({ ...prev, label: event.target.value })); } })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Alias" }), _jsx("input", { value: referenceAliasesText, onChange: (event) => { setReferenceValidationErrors([]); setReferenceAliasesText(event.target.value); }, placeholder: "Bosque oscuro, Davokar oscuro" })] }), _jsxs("label", { className: "field checkbox-field", children: [_jsx("span", { children: "Visible para jugadores" }), _jsx("input", { type: "checkbox", checked: referenceForm.isPublic, onChange: (event) => setReferenceForm((prev) => ({ ...prev, isPublic: event.target.checked })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen corto" }), _jsx("textarea", { rows: 2, value: referenceForm.summary, onChange: (event) => { setReferenceValidationErrors([]); setReferenceForm((prev) => ({ ...prev, summary: event.target.value })); } })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 8, value: referenceForm.content, onChange: (event) => { setReferenceValidationErrors([]); setReferenceForm((prev) => ({ ...prev, content: event.target.value })); } })] }), _jsx(CampaignReferencePreview, { reference: { ...referenceForm, id: selectedReference?.id ?? "draft", aliases: aliasesToInput(referenceAliasesText), createdAt: "", updatedAt: "" } })] }) })) : null, isReferenceDetailOpen && selectedReference ? (_jsx("section", { className: "modal-backdrop", onClick: () => setIsReferenceDetailOpen(false), children: _jsxs("div", { className: "panel modal-panel campaign-reference-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Detalle de referencia" }), _jsxs("div", { className: "toolbar", children: [isDirector ? (_jsx("button", { type: "button", onClick: () => openEditReferenceEditor(selectedReference.id), children: "Editar" })) : null, _jsx("button", { type: "button", onClick: () => setIsReferenceDetailOpen(false), children: "Cerrar" })] })] }), _jsx(CampaignReferencePreview, { reference: selectedReference })] }) })) : null, activeSection === "members" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Miembros" }), isDirector ? (_jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Email del jugador" }), _jsx("input", { value: memberEmail, onChange: (event) => setMemberEmail(event.target.value) })] }), _jsx("button", { disabled: isSaving, onClick: () => void handleAddMember(), children: "Agregar" })] })) : null] }), _jsx("div", { className: "cards", children: selectedCampaign.members.map((member) => (_jsxs("article", { className: "card", children: [_jsx("strong", { children: member.email }), _jsx("span", { children: member.role === "gm" ? "Director" : "Jugador" }), _jsxs("span", { children: ["Alta: ", new Date(member.joinedAt).toLocaleDateString()] }), isDirector && member.role !== "gm" ? (_jsx("button", { disabled: isSaving, onClick: () => void handleRemoveMember(member.id), children: "Quitar" })) : null] }, member.id))) })] })) : null, activeSection === "sessions" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Sesiones" }), isDirector ? (_jsx("button", { disabled: isSaving, onClick: () => {
                                            setSelectedSessionId(null);
                                            setSessionForm(makeDefaultSessionForm());
                                            setIsSessionEditorOpen(true);
                                        }, children: "Nueva sesi\u00F3n" })) : null] }), _jsxs("div", { className: "campaign-session-layout", children: [_jsxs("div", { className: "campaign-session-list", children: [selectedCampaign.sessions.map((session) => (_jsxs("article", { className: `card${selectedSessionId === session.id ? " card-selected" : ""}`, children: [_jsx("strong", { children: session.title }), _jsx("span", { children: new Date(session.scheduledFor).toLocaleString() }), _jsx("span", { children: session.status }), _jsxs("div", { className: "card-actions", children: [_jsx("button", { type: "button", onClick: () => {
                                                                    setSelectedSessionId(session.id);
                                                                    setSessionForm({
                                                                        title: session.title,
                                                                        scheduledFor: session.scheduledFor,
                                                                        location: session.location,
                                                                        summary: session.summary,
                                                                        publicNotes: session.publicNotes,
                                                                        dmNotes: session.dmNotes,
                                                                        status: session.status
                                                                    });
                                                                    setIsSessionEditorOpen(true);
                                                                }, children: "Detalles" }), isDirector ? (_jsxs(_Fragment, { children: [session.status !== "completed" ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                                            setSelectedSessionId(session.id);
                                                                            setSessionXpDraft(Object.fromEntries(selectedCampaign.characters.map((entry) => [entry.characterId, 0])));
                                                                            setIsSessionCloseModalOpen(true);
                                                                        }, children: "Cerrar sesi\u00F3n" })) : null, _jsx("button", { type: "button", className: "danger", disabled: isSaving, onClick: () => {
                                                                            if (window.confirm(`Esta acción eliminará la sesión "${session.title}". ¿Deseas continuar?`)) {
                                                                                void handleDeleteSession(session.id);
                                                                            }
                                                                        }, children: "Eliminar" })] })) : null] })] }, session.id))), selectedCampaign.sessions.length === 0 ? (_jsx("p", { className: "section-help", children: "A?n no hay sesiones programadas." })) : null] }), _jsx("div", { className: "campaign-session-detail", children: selectedSession ? (_jsxs(_Fragment, { children: [_jsx("h3", { children: selectedSession.title }), _jsxs("p", { className: "section-help", children: [new Date(selectedSession.scheduledFor).toLocaleString(), " ? ", selectedSession.status] }), selectedSession.location ? (_jsxs("div", { className: "campaign-session-meta", children: [_jsx("strong", { children: "Ubicaci\u00F3n:" }), " ", _jsx("span", { children: selectedSession.location })] })) : null, _jsx(CampaignLinkedTextBlock, { title: "Resumen", text: selectedSession.summary, references: selectedCampaign?.references ?? [], onOpenReference: openReference }), _jsx(CampaignLinkedTextBlock, { title: "Notas visibles", text: selectedSession.publicNotes, references: selectedCampaign?.references ?? [], onOpenReference: openReference })] })) : (_jsx("p", { className: "section-help", children: "Selecciona una sesi\u00F3n para ver sus detalles." })) })] })] })) : null, activeSection === "characters" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Personajes de la campa\u00F1a" }), isDirector ? (_jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Personaje disponible" }), _jsxs("select", { value: selectedAvailableCharacterId, onChange: (event) => setSelectedAvailableCharacterId(event.target.value), children: [availableUnlinkedCharacters.length === 0 ? _jsx("option", { value: "", children: "Sin personajes disponibles" }) : null, availableUnlinkedCharacters.map((entry) => (_jsxs("option", { value: entry.characterId, children: [entry.name, " - ", entry.ownerEmail] }, entry.characterId)))] })] }), _jsx("button", { disabled: isSaving || !selectedAvailableCharacterId, onClick: () => void handleLinkCharacter(), children: "Vincular" })] })) : null] }), _jsxs("div", { className: "cards", children: [selectedCampaign.characters.map((entry) => (_jsxs("article", { className: "card", children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.ownerEmail }), _jsxs("span", { children: ["PX total: ", entry.experienceTotal] }), _jsxs("span", { children: ["PX gastada: ", entry.experienceSpent] }), entry.sheet ? (_jsx("button", { type: "button", onClick: () => { setSelectedSheetTarget({ kind: "character", linkId: entry.id }); setActiveSection("sheet"); }, children: "Abrir hoja" })) : null, isDirector ? (_jsx("button", { disabled: isSaving, onClick: () => void handleUnlinkCharacter(entry.id), children: "Desvincular" })) : null] }, entry.id))), selectedCampaign.characters.length === 0 ? (_jsx("p", { className: "section-help", children: "Todav\u00EDa no hay personajes vinculados." })) : null] }), isDirector && selectedCampaign.characters.length > 0 ? (_jsxs("div", { className: "campaign-xp-panel", children: [_jsx("div", { className: "section-title", children: "Otorgar experiencia manual" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Personaje" }), _jsx("select", { value: xpForm.characterId, onChange: (event) => setXpForm((prev) => ({ ...prev, characterId: event.target.value })), children: selectedCampaign.characters.map((entry) => (_jsx("option", { value: entry.characterId, children: entry.name }, entry.characterId))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "PX" }), _jsx("input", { type: "number", min: 1, value: xpForm.amount, onChange: (event) => setXpForm((prev) => ({ ...prev, amount: Number(event.target.value || 1) })) })] }), _jsxs("label", { className: "field campaign-xp-reason", children: [_jsx("span", { children: "Motivo" }), _jsx("input", { value: xpForm.reason, onChange: (event) => setXpForm((prev) => ({ ...prev, reason: event.target.value })) })] }), _jsx("button", { disabled: isSaving, onClick: () => void handleGrantXp(), children: "Conceder PX" })] })] })) : null] })) : null, activeSection === "npcs" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "PNJs" }), isDirector ? (_jsx("button", { disabled: isSaving, onClick: () => void handleGenerateNpc(), children: "Generar PNJ" })) : null] }), isDirector ? (_jsxs("div", { className: "campaign-npc-form", children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: npcForm.name, onChange: (event) => setNpcForm((prev) => ({ ...prev, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Raza" }), _jsx("input", { value: npcForm.race, onChange: (event) => setNpcForm((prev) => ({ ...prev, race: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arquetipo" }), _jsx("input", { value: npcForm.archetype, onChange: (event) => setNpcForm((prev) => ({ ...prev, archetype: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ocupaci\u00F3n" }), _jsx("input", { value: npcForm.occupation, onChange: (event) => setNpcForm((prev) => ({ ...prev, occupation: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Amenaza" }), _jsx("input", { value: npcForm.threat, onChange: (event) => setNpcForm((prev) => ({ ...prev, threat: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 2, value: npcForm.summary, onChange: (event) => setNpcForm((prev) => ({ ...prev, summary: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Bloque r\u00E1pido" }), _jsx("textarea", { rows: 2, value: npcForm.statBlock, onChange: (event) => setNpcForm((prev) => ({ ...prev, statBlock: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas" }), _jsx("textarea", { rows: 3, value: npcForm.notes, onChange: (event) => setNpcForm((prev) => ({ ...prev, notes: event.target.value })) })] }), _jsx("button", { disabled: isSaving, onClick: () => void handleCreateNpc(), children: "Crear PNJ manual" })] })) : null, _jsxs("div", { className: "campaign-npc-list", children: [selectedCampaign.npcs.map((npc) => (_jsx(CampaignNpcEditor, { npc: npc, editable: isDirector, busy: isSaving, references: selectedCampaign?.references ?? [], onOpenReference: openReference, onSave: handleUpdateNpc, onDelete: handleDeleteNpc, onOpenSheet: () => { setSelectedSheetTarget({ kind: "npc", npcId: npc.id }); setActiveSection("sheet"); }, onCreateSheet: async (npcId) => {
                                            setSelectedSheetTarget({ kind: "npc", npcId });
                                            setActiveSection("sheet");
                                            await handleCreateNpcSheet(npcId);
                                        } }, npc.id))), selectedCampaign.npcs.length === 0 ? (_jsx("p", { className: "section-help", children: "Todav\u00EDa no hay PNJs registrados." })) : null] })] })) : null, activeSection === "sheet" && selectedCharacterSheetEntry?.sheet ? (_jsxs("section", { className: "panel campaign-sheet-shell", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Hoja de personaje" }), _jsx("button", { type: "button", onClick: () => { setSelectedSheetTarget(null); setActiveSection("characters"); }, children: "Cerrar hoja" })] }), _jsx(CampaignSheetEditor, { title: selectedCharacterSheetEntry.name, subtitle: `${selectedCharacterSheetEntry.ownerEmail} · Personaje de campaña`, sheet: selectedCharacterSheetEntry.sheet, rollDestination: "umbra", editable: false, allowActions: false, busy: isSaving, onSave: async (sheet) => handleSaveCharacterSheet(selectedCharacterSheetEntry.id, sheet) })] })) : null, activeSection === "sheet" && selectedSheetTarget?.kind === "npc" && selectedNpcSheetEntry ? (_jsxs("section", { className: "panel campaign-sheet-shell", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Hoja de PNJ" }), _jsx("button", { type: "button", onClick: () => { setSelectedSheetTarget(null); setActiveSection("npcs"); }, children: "Cerrar hoja" })] }), selectedNpcSheetEntry.sheet ? (_jsx(CampaignSheetEditor, { title: selectedNpcSheetEntry.name, subtitle: `${selectedNpcSheetEntry.race || "PNJ"} · ${selectedNpcSheetEntry.archetype || selectedNpcSheetEntry.occupation || "Sin arquetipo"}`, sheet: selectedNpcSheetEntry.sheet, rollDestination: "umbra", editable: isDirector, busy: isSaving, onSave: async (sheet) => handleSaveNpcSheet(selectedNpcSheetEntry.id, sheet) })) : (_jsxs("div", { className: "campaign-empty-sheet", children: [_jsx("p", { className: "section-help", children: "Este PNJ todav\u00EDa no tiene hoja de personaje. Puedes crearla y usarla para llevar equipo, corrupci\u00F3n, robustez y acciones." }), isDirector ? (_jsx("button", { disabled: isSaving, onClick: () => void handleCreateNpcSheet(selectedNpcSheetEntry.id), children: "Crear hoja de PNJ" })) : null] }))] })) : null, activeSection === "xp" ? (_jsxs("section", { className: "panel", children: [_jsx("h3", { children: "Historial de experiencia" }), _jsxs("div", { className: "campaign-log-list", children: [selectedCampaign.experienceLog.map((entry) => (_jsxs("article", { className: "card", children: [_jsxs("strong", { children: ["+", entry.amount, " PX para ", entry.characterName] }), _jsx("span", { children: entry.reason }), _jsxs("span", { children: [entry.grantedByEmail, " \u00B7 ", new Date(entry.createdAt).toLocaleString()] })] }, entry.id))), selectedCampaign.experienceLog.length === 0 ? (_jsx("p", { className: "section-help", children: "A\u00FAn no hay concesiones de experiencia registradas." })) : null] })] })) : null] })), isSessionEditorOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setIsSessionEditorOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel campaign-reference-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: selectedSession ? "Detalle de sesión" : "Crear sesión" }), _jsxs("div", { className: "toolbar", children: [isDirector ? (_jsxs(_Fragment, { children: [_jsx("button", { disabled: isSaving, onClick: () => void (selectedSession ? handleSaveSession() : handleCreateSession()), children: selectedSession ? "Guardar sesión" : "Programar sesión" }), selectedSession && selectedSession.status !== "completed" ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                        setSessionXpDraft(Object.fromEntries((selectedCampaign?.characters ?? []).map((entry) => [entry.characterId, 0])));
                                                        setIsSessionCloseModalOpen(true);
                                                    }, children: "Cerrar sesi\u00F3n" })) : null, selectedSession ? (_jsx("button", { type: "button", className: "danger", disabled: isSaving, onClick: () => {
                                                        if (window.confirm(`Esta acción eliminará la sesión "${selectedSession.title}". ¿Deseas continuar?`)) {
                                                            void handleDeleteSession(selectedSession.id);
                                                        }
                                                    }, children: "Eliminar" })) : null] })) : null, _jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsSessionEditorOpen(false), children: "Cerrar" })] })] }), isDirector ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "T?tulo" }), _jsx("input", { value: sessionForm.title, onChange: (event) => setSessionForm((prev) => ({ ...prev, title: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fecha y hora" }), _jsx("input", { type: "datetime-local", value: toLocalDateTimeValue(sessionForm.scheduledFor), onChange: (event) => setSessionForm((prev) => ({ ...prev, scheduledFor: fromLocalDateTimeValue(event.target.value) })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ubicaci?n" }), _jsx("input", { value: sessionForm.location, onChange: (event) => setSessionForm((prev) => ({ ...prev, location: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Estado" }), _jsxs("select", { value: sessionForm.status, onChange: (event) => setSessionForm((prev) => ({
                                                        ...prev,
                                                        status: event.target.value
                                                    })), children: [_jsx("option", { value: "planned", children: "Planificada" }), _jsx("option", { value: "completed", children: "Completada" }), _jsx("option", { value: "cancelled", children: "Cancelada" })] })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen para la mesa" }), _jsx("textarea", { rows: 2, value: sessionForm.summary, onChange: (event) => setSessionForm((prev) => ({ ...prev, summary: event.target.value })) })] }), _jsx(CampaignLinkedTextBlock, { title: "Vista enlazada del resumen de sesi\u00F3n", text: sessionForm.summary, references: selectedCampaign?.references ?? [], onOpenReference: openReference }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas visibles para la mesa" }), _jsx("textarea", { rows: 4, value: sessionForm.publicNotes, onChange: (event) => setSessionForm((prev) => ({ ...prev, publicNotes: event.target.value })) })] }), _jsx(CampaignLinkedTextBlock, { title: "Vista enlazada de notas p\u00FAblicas", text: sessionForm.publicNotes, references: selectedCampaign?.references ?? [], onOpenReference: openReference }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas secretas del DJ" }), _jsx("textarea", { rows: 4, value: sessionForm.dmNotes, onChange: (event) => setSessionForm((prev) => ({ ...prev, dmNotes: event.target.value })) })] }), _jsx(CampaignLinkedTextBlock, { title: "Vista enlazada de notas secretas", text: sessionForm.dmNotes, references: selectedCampaign?.references ?? [], onOpenReference: openReference })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "T\u00EDtulo" }), _jsx("input", { value: sessionForm.title, disabled: true })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fecha y hora" }), _jsx("input", { value: new Date(sessionForm.scheduledFor).toLocaleString(), disabled: true })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ubicaci\u00F3n" }), _jsx("input", { value: sessionForm.location || "Sin ubicación indicada", disabled: true })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Estado" }), _jsx("input", { value: sessionForm.status, disabled: true })] })] }), _jsx(CampaignLinkedTextBlock, { title: "Resumen para la mesa", text: sessionForm.summary, references: selectedCampaign?.references ?? [], onOpenReference: openReference }), _jsx(CampaignLinkedTextBlock, { title: "Notas compartidas de la sesi\u00F3n", text: sessionForm.publicNotes, references: selectedCampaign?.references ?? [], onOpenReference: openReference })] }))] }) })) : null, isSessionCloseModalOpen && selectedSession && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setIsSessionCloseModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel campaign-reference-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Cerrar sesi\u00F3n" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { disabled: isSaving, onClick: () => void handleCloseSession(), children: isSaving ? "Cerrando..." : "Cerrar sesión" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => setIsSessionCloseModalOpen(false), children: "Cancelar" })] })] }), _jsx("p", { className: "section-help", children: "Configura el PX que recibe cada personaje al cerrar la sesi\u00F3n. La sesi\u00F3n quedar\u00E1 marcada como completada." }), _jsx("div", { className: "cards", children: selectedCampaign.characters.map((entry) => (_jsxs("article", { className: "card", children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.ownerEmail }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "PX de esta sesi\u00F3n" }), _jsx("input", { type: "number", min: 0, value: sessionXpDraft[entry.characterId] ?? 0, onChange: (event) => setSessionXpDraft((prev) => ({
                                                    ...prev,
                                                    [entry.characterId]: Number(event.target.value || 0)
                                                })) })] })] }, entry.characterId))) })] }) })) : null, isCampaignDetailsModalOpen && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setIsCampaignDetailsModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel campaign-create-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h2", { children: "Detalles de campa\u00F1a" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { disabled: isSaving, onClick: () => void handleSaveCampaign(), children: isSaving ? "Guardando..." : "Guardar detalle" }), _jsx("button", { type: "button", onClick: () => setIsCampaignDetailsModalOpen(false), disabled: isSaving, children: "Cerrar" })] })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: draft.name, disabled: !isDirector, onChange: (event) => setDraft((prev) => ({ ...prev, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ambientaci?n" }), _jsx("input", { value: draft.setting, disabled: !isDirector, onChange: (event) => setDraft((prev) => ({ ...prev, setting: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 3, value: draft.summary, disabled: !isDirector, onChange: (event) => setDraft((prev) => ({ ...prev, summary: event.target.value })) })] }), _jsx(CampaignLinkedTextBlock, { title: "Vista enlazada del resumen", text: draft.summary, references: selectedCampaign?.references ?? [], onOpenReference: openReference }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas del director" }), _jsx("textarea", { rows: 5, value: draft.notes, disabled: !isDirector, onChange: (event) => setDraft((prev) => ({ ...prev, notes: event.target.value })) })] }), draft.notes ? (_jsx(CampaignLinkedTextBlock, { title: "Vista enlazada de notas", text: draft.notes, references: selectedCampaign?.references ?? [], onOpenReference: openReference })) : null, _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas compartidas" }), _jsx("textarea", { rows: 5, value: draft.sharedNotes, disabled: true, onChange: (event) => setDraft((prev) => ({ ...prev, sharedNotes: event.target.value })) })] })] }) })) : null, isCreateCampaignModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setIsCreateCampaignModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel campaign-create-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h2", { children: "Nueva campa\u00F1a" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { disabled: isSaving, onClick: () => void handleCreateCampaign(), children: isSaving ? "Creando..." : "Crear campaña" }), _jsx("button", { type: "button", onClick: () => setIsCreateCampaignModalOpen(false), disabled: isSaving, children: "Cerrar" })] })] }), _jsxs("div", { className: "campaign-create-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: campaignForm.name, onChange: (event) => setCampaignForm((prev) => ({ ...prev, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ambientaci\u00F3n" }), _jsx("input", { value: campaignForm.setting, onChange: (event) => setCampaignForm((prev) => ({ ...prev, setting: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 3, value: campaignForm.summary, onChange: (event) => setCampaignForm((prev) => ({ ...prev, summary: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas del director" }), _jsx("textarea", { rows: 6, value: campaignForm.notes, onChange: (event) => setCampaignForm((prev) => ({ ...prev, notes: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas compartidas" }), _jsx("textarea", { rows: 5, value: campaignForm.sharedNotes, onChange: (event) => setCampaignForm((prev) => ({ ...prev, sharedNotes: event.target.value })) })] })] })] }) })) : null] }));
}
function listToText(values) {
    return values.join("\n");
}
function textToList(value) {
    return value
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function CampaignSheetEditor({ title, subtitle, sheet, rollDestination, editable, allowActions = true, busy, onSave }) {
    const [draft, setDraft] = useState(sheet);
    const [equipmentText, setEquipmentText] = useState(listToText(sheet.equipo));
    const [contactsText, setContactsText] = useState(listToText(sheet.contactos));
    const [lastActionResult, setLastActionResult] = useState(null);
    const [rollTransportStatus, setRollTransportStatus] = useState(null);
    const [pendingRollConfirmation, setPendingRollConfirmation] = useState(null);
    const actions = useMemo(() => deriveCharacterActions(draft), [draft]);
    useEffect(() => {
        setDraft(sheet);
        setEquipmentText(listToText(sheet.equipo));
        setContactsText(listToText(sheet.contactos));
        setLastActionResult(null);
        setRollTransportStatus(null);
        setPendingRollConfirmation(null);
    }, [sheet]);
    function updateDraft(mutator) {
        setDraft((current) => mutator(current));
    }
    async function runActionWithCurrentDestination(action, phase) {
        try {
            if (rollDestination !== "umbra") {
                const request = buildRollRequest(draft, title, action.id, phase, rollDestination);
                const result = await dispatchRoll20Request(request, pendingRollConfirmation?.visibility ?? "public");
                setRollTransportStatus(result.status.message);
            }
            if (rollDestination === "roll20") {
                setLastActionResult(null);
                return;
            }
            setLastActionResult(executeCharacterAction(draft, action.id, phase));
        }
        catch (error) {
            setRollTransportStatus(error instanceof Error ? error.message : "No se pudo preparar la tirada");
        }
    }
    function handleRunAction(action, phase) {
        if (rollDestination === "umbra") {
            void runActionWithCurrentDestination(action, phase);
            return;
        }
        setPendingRollConfirmation({
            request: buildRollRequest(draft, title, action.id, phase, rollDestination),
            action,
            phase,
            runLocalAfterSend: rollDestination === "both",
            visibility: "public"
        });
    }
    async function handleConfirmRoll20Send() {
        if (!pendingRollConfirmation) {
            return;
        }
        try {
            const result = await dispatchRoll20Request(pendingRollConfirmation.request, pendingRollConfirmation.visibility);
            setRollTransportStatus(result.status.message);
            if (pendingRollConfirmation.runLocalAfterSend) {
                setLastActionResult(executeCharacterAction(draft, pendingRollConfirmation.action.id, pendingRollConfirmation.phase));
            }
            else {
                setLastActionResult(null);
            }
        }
        catch (error) {
            setRollTransportStatus(error instanceof Error ? error.message : "No se pudo preparar la tirada");
        }
        finally {
            setPendingRollConfirmation(null);
        }
    }
    function getActionsForSource(sourceName) {
        return actions.filter((action) => action.sourceName === sourceName);
    }
    return (_jsxs("div", { className: "campaign-sheet", children: [_jsxs("header", { className: "campaign-sheet-header", children: [_jsxs("div", { children: [_jsx("div", { className: "campaign-sheet-kicker", children: "Hoja de personaje" }), _jsx("h2", { children: title }), _jsx("p", { children: subtitle })] }), _jsxs("div", { className: "campaign-sheet-vitals", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Robustez actual" }), _jsx("input", { type: "number", min: 0, disabled: !editable, value: draft.combate.robustezActual, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            combate: { ...current.combate, robustezActual: Number(event.target.value || 0) }
                                        })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Corrupci\u00F3n temporal" }), _jsx("input", { type: "number", min: 0, disabled: !editable, value: draft.corrupcion.temporal, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            corrupcion: { ...current.corrupcion, temporal: Number(event.target.value || 0) }
                                        })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Corrupci\u00F3n permanente" }), _jsx("input", { type: "number", min: 0, disabled: !editable, value: draft.corrupcion.permanente, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            corrupcion: { ...current.corrupcion, permanente: Number(event.target.value || 0) }
                                        })) })] })] })] }), _jsxs("div", { className: "campaign-sheet-grid", children: [_jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Identidad" }), _jsxs("div", { className: "campaign-sheet-readonly", children: [_jsxs("span", { children: ["Raza: ", String(draft.identidad.raza)] }), _jsxs("span", { children: ["Cultura: ", String(draft.identidad.cultura)] }), _jsxs("span", { children: ["Arquetipo: ", String(draft.identidad.arquetipo)] }), _jsxs("span", { children: ["Profesi\u00F3n: ", draft.identidad.profesion || "Sin definir"] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Objetivo personal" }), _jsx("textarea", { rows: 3, disabled: !editable, value: draft.identidad.objetivoPersonal, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            identidad: { ...current.identidad, objetivoPersonal: event.target.value }
                                        })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas importantes" }), _jsx("textarea", { rows: 6, disabled: !editable, value: draft.notas, onChange: (event) => updateDraft((current) => ({ ...current, notas: event.target.value })) })] })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Combate y recursos" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Robustez m\u00E1xima" }), _jsx("input", { type: "number", min: 1, disabled: !editable, value: draft.combate.robustezMax, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    combate: { ...current.combate, robustezMax: Number(event.target.value || 1) }
                                                })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Umbral de dolor" }), _jsx("input", { type: "number", min: 0, disabled: !editable, value: draft.combate.umbralDolor, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    combate: { ...current.combate, umbralDolor: Number(event.target.value || 0) }
                                                })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Dinero" }), _jsx("input", { disabled: !editable, value: draft.recursos.dinero, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    recursos: { ...current.recursos, dinero: event.target.value }
                                                })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Otros recursos" }), _jsx("input", { disabled: !editable, value: draft.recursos.otros, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    recursos: { ...current.recursos, otros: event.target.value }
                                                })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Armadura" }), _jsx("input", { disabled: !editable, value: draft.combate.armadura, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            combate: { ...current.combate, armadura: event.target.value }
                                        })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Protecci\u00F3n" }), _jsx("input", { disabled: !editable, value: draft.combate.armaduraProteccion, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            combate: { ...current.combate, armaduraProteccion: event.target.value }
                                        })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas de corrupci\u00F3n" }), _jsx("textarea", { rows: 3, disabled: !editable, value: draft.corrupcion.notas, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            corrupcion: { ...current.corrupcion, notas: event.target.value }
                                        })) })] })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Equipo y contactos" }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Equipo" }), _jsx("textarea", { rows: 8, disabled: !editable, value: equipmentText, onChange: (event) => {
                                            const nextValue = event.target.value;
                                            setEquipmentText(nextValue);
                                            updateDraft((current) => ({ ...current, equipo: textToList(nextValue) }));
                                        } })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contactos" }), _jsx("textarea", { rows: 6, disabled: !editable, value: contactsText, onChange: (event) => {
                                            const nextValue = event.target.value;
                                            setContactsText(nextValue);
                                            updateDraft((current) => ({ ...current, contactos: textToList(nextValue) }));
                                        } })] })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Atributos" }), _jsx("div", { className: "campaign-sheet-attributes", children: Object.entries(draft.atributos).map(([key, value]) => (_jsxs("div", { className: "campaign-sheet-attribute", children: [_jsx("span", { children: formatAttributeLabel(key) }), _jsx("strong", { children: value })] }, key))) })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Armas preparadas" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Arma principal" }), _jsx("input", { disabled: !editable, value: draft.combate.armaPrincipal, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    combate: { ...current.combate, armaPrincipal: event.target.value }
                                                })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo" }), _jsx("input", { disabled: !editable, value: draft.combate.armaPrincipalAtributo, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    combate: { ...current.combate, armaPrincipalAtributo: event.target.value }
                                                })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o" }), _jsx("input", { disabled: !editable, value: draft.combate.danioPrincipal, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    combate: { ...current.combate, danioPrincipal: event.target.value }
                                                })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arma secundaria" }), _jsx("input", { disabled: !editable, value: draft.combate.armaSecundaria, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    combate: { ...current.combate, armaSecundaria: event.target.value }
                                                })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Atributo" }), _jsx("input", { disabled: !editable, value: draft.combate.armaSecundariaAtributo, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    combate: { ...current.combate, armaSecundariaAtributo: event.target.value }
                                                })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o" }), _jsx("input", { disabled: !editable, value: draft.combate.danioSecundaria, onChange: (event) => updateDraft((current) => ({
                                                    ...current,
                                                    combate: { ...current.combate, danioSecundaria: event.target.value }
                                                })) })] })] })] })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Capacidades y acciones" }), _jsxs("div", { className: "campaign-sheet-capability-columns", children: [_jsx(CapabilityColumn, { title: "Habilidades", entries: draft.habilidades, getActionsForSource: getActionsForSource, onRunAction: handleRunAction, allowActions: allowActions }), _jsx(CapabilityColumn, { title: "Poderes m\u00EDsticos", entries: draft.poderesMisticos, getActionsForSource: getActionsForSource, onRunAction: handleRunAction, allowActions: allowActions }), _jsx(CapabilityColumn, { title: "Rituales", entries: draft.rituales, getActionsForSource: getActionsForSource, onRunAction: handleRunAction, allowActions: allowActions })] })] }), _jsxs("div", { className: "campaign-sheet-grid", children: [_jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Grupo y contactos de hoja" }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del grupo" }), _jsx("input", { disabled: !editable, value: draft.grupo.nombre, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            grupo: { ...current.grupo, nombre: event.target.value }
                                        })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Objetivo del grupo" }), _jsx("textarea", { rows: 3, disabled: !editable, value: draft.grupo.objetivo, onChange: (event) => updateDraft((current) => ({
                                            ...current,
                                            grupo: { ...current.grupo, objetivo: event.target.value }
                                        })) })] }), _jsx("div", { className: "campaign-sheet-structured-list", children: draft.contactosHoja.map((contacto, index) => (_jsxs("article", { className: "campaign-structured-card", children: [_jsxs("strong", { children: ["Contacto ", index + 1] }), _jsx("input", { disabled: !editable, placeholder: "Nombre", value: contacto.nombre, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                contactosHoja: current.contactosHoja.map((item, itemIndex) => itemIndex === index ? { ...item, nombre: event.target.value } : item)
                                            })) }), _jsx("input", { disabled: !editable, placeholder: "Raza", value: contacto.raza, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                contactosHoja: current.contactosHoja.map((item, itemIndex) => itemIndex === index ? { ...item, raza: event.target.value } : item)
                                            })) }), _jsx("input", { disabled: !editable, placeholder: "Ocupaci\u00F3n", value: contacto.ocupacion, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                contactosHoja: current.contactosHoja.map((item, itemIndex) => itemIndex === index ? { ...item, ocupacion: event.target.value } : item)
                                            })) }), _jsx("input", { disabled: !editable, placeholder: "Jugador", value: contacto.jugador, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                contactosHoja: current.contactosHoja.map((item, itemIndex) => itemIndex === index ? { ...item, jugador: event.target.value } : item)
                                            })) })] }, `contacto-${index}`))) })] }), _jsxs("section", { className: "campaign-sheet-card", children: [_jsx("h4", { children: "Artefactos" }), _jsx("div", { className: "campaign-sheet-structured-list", children: draft.artefactos.map((artefacto, index) => (_jsxs("article", { className: "campaign-structured-card", children: [_jsxs("strong", { children: ["Artefacto ", index + 1] }), _jsx("input", { disabled: !editable, placeholder: "Nombre", value: artefacto.nombre, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                artefactos: current.artefactos.map((item, itemIndex) => itemIndex === index ? { ...item, nombre: event.target.value } : item)
                                            })) }), _jsx("textarea", { rows: 3, disabled: !editable, placeholder: "Poderes", value: artefacto.poderes, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                artefactos: current.artefactos.map((item, itemIndex) => itemIndex === index ? { ...item, poderes: event.target.value } : item)
                                            })) }), _jsx("input", { disabled: !editable, placeholder: "Corrupci\u00F3n", value: artefacto.corrupcion, onChange: (event) => updateDraft((current) => ({
                                                ...current,
                                                artefactos: current.artefactos.map((item, itemIndex) => itemIndex === index ? { ...item, corrupcion: event.target.value } : item)
                                            })) })] }, `artefacto-${index}`))) })] })] }), allowActions ? (_jsxs("section", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: "Acciones disponibles" }), editable ? (_jsx("button", { type: "button", disabled: busy, onClick: () => void onSave(draft), children: "Guardar hoja" })) : null] }), _jsxs("div", { className: "campaign-sheet-actions", children: [actions.map((action) => (_jsxs("div", { className: "campaign-action-button", children: [_jsx("strong", { children: action.label }), _jsx("span", { children: action.sourceName }), _jsxs("span", { children: [action.cost, action.rollAttribute ? ` · ${action.rollAttribute}` : "", action.damageFormula ? ` · ${action.damageFormula}` : ""] }), _jsxs("div", { className: "campaign-action-controls", children: [action.rollAttribute ? (_jsx("button", { type: "button", onClick: () => void handleRunAction(action, "attack"), children: getActionPhaseLabel(action, "attack") })) : null, action.damageFormula ? (_jsx("button", { type: "button", onClick: () => void handleRunAction(action, "damage"), children: getActionPhaseLabel(action, "damage") })) : null] })] }, action.id))), actions.length === 0 ? _jsx("p", { className: "section-help", children: "No hay acciones ejecutables con la configuraci?n actual de la hoja." }) : null] }), rollTransportStatus ? _jsx("p", { className: "meta-text campaign-roll-destination-feedback", children: rollTransportStatus }) : null, lastActionResult ? (_jsxs("div", { className: "campaign-sheet-roll-result", children: [_jsx("strong", { children: lastActionResult.action.label }), renderActionRolls(lastActionResult.rolls, lastActionResult.action.id), _jsx("p", { children: lastActionResult.action.effectSummary })] })) : null] })) : null, allowActions && pendingRollConfirmation ? (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "modal-panel", children: [_jsx("h3", { children: "Enviar tirada a Roll20" }), _jsxs("p", { className: "section-help", children: [pendingRollConfirmation.action.label, " \u00B7 ", getActionPhaseLabel(pendingRollConfirmation.action, pendingRollConfirmation.phase)] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Visibilidad" }), _jsxs("select", { value: pendingRollConfirmation.visibility, onChange: (event) => setPendingRollConfirmation((current) => current ? { ...current, visibility: event.target.value } : current), children: [_jsx("option", { value: "public", children: "P\u00FAblica (/r)" }), _jsx("option", { value: "gm", children: "Solo DJ (/gr)" })] })] }), _jsxs("div", { className: "row-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setPendingRollConfirmation(null), children: "Cancelar" }), _jsx("button", { type: "button", onClick: () => void handleConfirmRoll20Send(), children: "Enviar a Roll20" })] })] }) })) : null] }));
}
function formatAttributeLabel(attribute) {
    switch (attribute) {
        case "agil":
            return "Agil";
        case "atento":
            return "Atento";
        case "discreto":
            return "Discreto";
        case "diestro":
            return "Diestro";
        case "fuerte":
            return "Fuerte";
        case "inteligente":
            return "Inteligente";
        case "persuasivo":
            return "Persuasivo";
        case "tenaz":
            return "Tenaz";
        default:
            return attribute;
    }
}
function CapabilityColumn({ title, entries, getActionsForSource, onRunAction, allowActions }) {
    return (_jsxs("div", { className: "campaign-capability-column", children: [_jsx("h5", { children: title }), entries.map((entry) => {
                const entryActions = getActionsForSource(entry.nombre);
                return (_jsxs("article", { className: "campaign-capability-entry", children: [_jsx("strong", { children: entry.nombre }), _jsx("span", { children: entry.nivel }), entry.efecto ? _jsx("p", { children: entry.efecto }) : null, allowActions && entryActions.length > 0 ? (_jsx("div", { className: "campaign-capability-actions", children: entryActions.map((action) => (_jsxs("div", { className: "campaign-action-controls", children: [action.rollAttribute ? (_jsx("button", { type: "button", className: "subtle-button", onClick: () => onRunAction(action, "attack"), children: getActionPhaseLabel(action, "attack") })) : null, action.damageFormula ? (_jsx("button", { type: "button", className: "subtle-button", onClick: () => onRunAction(action, "damage"), children: getActionPhaseLabel(action, "damage") })) : null] }, action.id))) })) : null] }, `${title}-${entry.nombre}-${entry.nivel}`));
            }), entries.length === 0 ? _jsx("p", { className: "section-help", children: "Sin entradas." }) : null] }));
}
function CampaignNpcEditor({ npc, editable, busy, references, onOpenReference, onSave, onDelete, onOpenSheet, onCreateSheet }) {
    const [draft, setDraft] = useState(npc);
    useEffect(() => {
        setDraft(npc);
    }, [npc]);
    return (_jsxs("article", { className: "card campaign-npc-card", children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: draft.name ?? "", disabled: !editable, onChange: (event) => setDraft((prev) => ({ ...prev, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Raza" }), _jsx("input", { value: draft.race ?? "", disabled: !editable, onChange: (event) => setDraft((prev) => ({ ...prev, race: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arquetipo" }), _jsx("input", { value: draft.archetype ?? "", disabled: !editable, onChange: (event) => setDraft((prev) => ({ ...prev, archetype: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ocupaci\u00F3n" }), _jsx("input", { value: draft.occupation ?? "", disabled: !editable, onChange: (event) => setDraft((prev) => ({ ...prev, occupation: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Amenaza" }), _jsx("input", { value: draft.threat ?? "", disabled: !editable, onChange: (event) => setDraft((prev) => ({ ...prev, threat: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 2, value: draft.summary ?? "", disabled: !editable, onChange: (event) => setDraft((prev) => ({ ...prev, summary: event.target.value })) })] }), _jsx(CampaignLinkedTextBlock, { title: "Vista enlazada del resumen", text: draft.summary ?? "", references: references, onOpenReference: onOpenReference }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Bloque r?pido" }), _jsx("textarea", { rows: 2, value: draft.statBlock ?? "", disabled: !editable, onChange: (event) => setDraft((prev) => ({ ...prev, statBlock: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas" }), _jsx("textarea", { rows: 3, value: draft.notes ?? "", disabled: !editable, onChange: (event) => setDraft((prev) => ({ ...prev, notes: event.target.value })) })] }), _jsx(CampaignLinkedTextBlock, { title: "Vista enlazada de notas", text: draft.notes ?? "", references: references, onOpenReference: onOpenReference }), _jsxs("div", { className: "card-actions", children: [_jsx("span", { children: npc.isGenerated ? "Generado" : "Manual" }), _jsx("button", { type: "button", disabled: !npc.sheet && !editable, onClick: () => {
                            if (npc.sheet) {
                                onOpenSheet();
                                return;
                            }
                            void onCreateSheet(npc.id);
                        }, children: npc.sheet ? "Abrir hoja" : "Crear hoja" }), editable ? (_jsxs(_Fragment, { children: [_jsx("button", { disabled: busy, onClick: () => void onSave(npc.id, draft), children: "Guardar PNJ" }), _jsx("button", { className: "danger", disabled: busy, onClick: () => void onDelete(npc.id), children: "Eliminar PNJ" })] })) : null] })] }));
}
function CampaignLinkedTextBlock({ title, text, references, onOpenReference }) {
    if (!text.trim()) {
        return null;
    }
    return (_jsxs("div", { className: "campaign-linked-text", children: [_jsx("strong", { children: title }), _jsx("p", { children: renderLinkedText(text, references, onOpenReference) })] }));
}
function CampaignReferencePreview({ reference }) {
    return (_jsxs("div", { className: "campaign-reference-preview", children: [_jsx("div", { className: "row-actions", children: _jsxs("div", { children: [_jsx("h3", { children: reference.name || "Referencia sin nombre" }), _jsxs("p", { className: "meta-text", children: [reference.label || "Sin etiqueta", " \u00B7 ", reference.isPublic ? "Visible para jugadores" : "Solo DJ"] })] }) }), reference.aliases.length > 0 ? (_jsxs("p", { className: "meta-text", children: ["Alias: ", reference.aliases.join(", ")] })) : null, reference.summary ? _jsx("p", { children: reference.summary }) : null, reference.content ? _jsx("p", { children: reference.content }) : _jsx("p", { className: "section-help", children: "Sin contenido detallado todav?a." })] }));
}
