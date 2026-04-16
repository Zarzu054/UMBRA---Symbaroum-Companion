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
    sharedNotes: "",
    sharedNoteEntries: []
};
const emptyReferenceForm = {
    name: "",
    label: "",
    aliases: [],
    summary: "",
    content: "",
    visibility: "campaign",
    sharedWithUserIds: []
};
function describeReferenceValidationError(error) {
    const issues = typeof error === "object" && error !== null && "issues" in error && Array.isArray(error.issues)
        ? error.issues
        : null;
    if (!issues) {
        return error instanceof Error ? error.message : "No se pudo crear la referencia";
    }
    const firstIssue = issues[0];
    if (!firstIssue) {
        return "Revisa los datos de la referencia.";
    }
    const field = String(firstIssue.path?.[0] ?? "");
    if (field === "name") {
        return "El nombre debe tener al menos 2 caracteres.";
    }
    if (field === "label") {
        return "La categoria no puede superar los 80 caracteres.";
    }
    if (field === "content") {
        return "El contenido no puede superar los 6000 caracteres.";
    }
    if (field === "summary") {
        return "El resumen no puede superar los 300 caracteres.";
    }
    if (field === "aliases") {
        return "Revisa los alias de la referencia.";
    }
    return "Revisa los datos de la referencia.";
}
function buildTimestampedNoteId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function sortSharedNoteEntries(entries) {
    return [...entries].sort((left, right) => {
        const leftDate = left.updatedAt || left.createdAt || "";
        const rightDate = right.updatedAt || right.createdAt || "";
        return rightDate.localeCompare(leftDate);
    });
}
function summarizeNoteContent(content) {
    const collapsed = content.replace(/\s+/g, " ").trim();
    if (!collapsed) {
        return "Sin contenido.";
    }
    return collapsed.length > 180 ? `${collapsed.slice(0, 177)}...` : collapsed;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeLookupValue(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}
function getReferenceTerms(reference) {
    return [reference.name, ...reference.aliases]
        .map((entry) => entry.trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);
}
function referenceMatchesText(reference, text) {
    if (!text.trim()) {
        return false;
    }
    const normalizedText = normalizeLookupValue(text);
    return getReferenceTerms(reference).some((term) => {
        const escaped = escapeRegExp(normalizeLookupValue(term));
        return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(normalizedText);
    });
}
function findReferenceForTerm(term, references) {
    return references.find((reference) => getReferenceTerms(reference).some((candidate) => candidate.localeCompare(term, undefined, { sensitivity: "base" }) === 0)) ?? null;
}
function renderHighlightedText(text, references, onOpenReference, keyPrefix = "highlight") {
    if (!text.trim() || references.length === 0) {
        return text;
    }
    const terms = references
        .flatMap((reference) => getReferenceTerms(reference))
        .map((term) => term.trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);
    if (terms.length === 0) {
        return text;
    }
    const matcher = new RegExp(`(${terms.map((term) => escapeRegExp(term)).join("|")})`, "gi");
    return text.split(matcher).map((part, index) => terms.some((term) => part.localeCompare(term, undefined, { sensitivity: "base" }) === 0)
        ? (() => {
            const reference = findReferenceForTerm(part, references);
            if (!reference) {
                return _jsx("mark", { className: "compendium-highlight", children: part }, `${keyPrefix}-${part}-${index}`);
            }
            return (_jsx("button", { type: "button", className: "compendium-highlight compendium-highlight-button", onClick: () => onOpenReference(reference.id), children: part }, `${keyPrefix}-${part}-${index}`));
        })()
        : part);
}
function renderMarkdownInline(text, references, onOpenReference, keyPrefix) {
    const nodes = [];
    const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const [fullMatch, , linkLabel, linkUrl, inlineCode, boldText, italicText] = match;
        if (match.index > lastIndex) {
            const textNodes = renderHighlightedText(text.slice(lastIndex, match.index), references, onOpenReference, `${keyPrefix}-text-${lastIndex}`);
            nodes.push(...(Array.isArray(textNodes) ? textNodes : [textNodes]));
        }
        if (linkLabel && linkUrl) {
            nodes.push(_jsx("a", { href: linkUrl, target: "_blank", rel: "noreferrer", children: linkLabel }, `${keyPrefix}-link-${match.index}`));
        }
        else if (inlineCode) {
            nodes.push(_jsx("code", { children: inlineCode }, `${keyPrefix}-code-${match.index}`));
        }
        else if (boldText) {
            nodes.push(_jsx("strong", { children: renderMarkdownInline(boldText, references, onOpenReference, `${keyPrefix}-bold-inner-${match.index}`) }, `${keyPrefix}-bold-${match.index}`));
        }
        else if (italicText) {
            nodes.push(_jsx("em", { children: renderMarkdownInline(italicText, references, onOpenReference, `${keyPrefix}-italic-inner-${match.index}`) }, `${keyPrefix}-italic-${match.index}`));
        }
        else {
            nodes.push(fullMatch);
        }
        lastIndex = match.index + fullMatch.length;
    }
    if (lastIndex < text.length) {
        const textNodes = renderHighlightedText(text.slice(lastIndex), references, onOpenReference, `${keyPrefix}-tail-${lastIndex}`);
        nodes.push(...(Array.isArray(textNodes) ? textNodes : [textNodes]));
    }
    return nodes;
}
function renderMarkdownBlocks(text, references, onOpenReference) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let index = 0;
    let codeBlockIndex = 0;
    while (index < lines.length) {
        const line = lines[index];
        const trimmed = line.trim();
        if (!trimmed) {
            index += 1;
            continue;
        }
        if (trimmed.startsWith("```")) {
            const codeLines = [];
            index += 1;
            while (index < lines.length && !lines[index].trim().startsWith("```")) {
                codeLines.push(lines[index]);
                index += 1;
            }
            if (index < lines.length)
                index += 1;
            blocks.push(_jsx("pre", { className: "campaign-markdown-code-block", children: _jsx("code", { children: codeLines.join("\n") }) }, `code-${codeBlockIndex}`));
            codeBlockIndex += 1;
            continue;
        }
        const headingMatch = trimmed.match(/^(#{1,4})(?:\s+(.*))?$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const content = headingMatch[2] ?? "";
            const headingNodes = renderMarkdownInline(content, references, onOpenReference, `heading-${index}`);
            if (level === 1) {
                blocks.push(_jsx("h3", { children: headingNodes }, `heading-${index}`));
            }
            else if (level === 2) {
                blocks.push(_jsx("h4", { children: headingNodes }, `heading-${index}`));
            }
            else if (level === 3) {
                blocks.push(_jsx("h5", { children: headingNodes }, `heading-${index}`));
            }
            else {
                blocks.push(_jsx("h6", { children: headingNodes }, `heading-${index}`));
            }
            index += 1;
            continue;
        }
        const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
        if (unorderedMatch) {
            const items = [];
            while (index < lines.length) {
                const itemMatch = lines[index].match(/^[-*]\s+(.+)$/);
                if (!itemMatch)
                    break;
                items.push(_jsx("li", { children: renderMarkdownInline(itemMatch[1], references, onOpenReference, `ul-${index}`) }, `ul-${index}`));
                index += 1;
            }
            blocks.push(_jsx("ul", { children: items }, `ul-block-${index}`));
            continue;
        }
        const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
        if (orderedMatch) {
            const items = [];
            while (index < lines.length) {
                const itemMatch = lines[index].match(/^\d+\.\s+(.+)$/);
                if (!itemMatch)
                    break;
                items.push(_jsx("li", { children: renderMarkdownInline(itemMatch[1], references, onOpenReference, `ol-${index}`) }, `ol-${index}`));
                index += 1;
            }
            blocks.push(_jsx("ol", { children: items }, `ol-block-${index}`));
            continue;
        }
        const quoteMatch = line.match(/^>\s+(.+)$/);
        if (quoteMatch) {
            const quoteLines = [];
            while (index < lines.length) {
                const itemMatch = lines[index].match(/^>\s+(.+)$/);
                if (!itemMatch)
                    break;
                quoteLines.push(itemMatch[1]);
                index += 1;
            }
            blocks.push(_jsx("blockquote", { children: quoteLines.map((quoteLine, quoteIndex) => (_jsx("p", { children: renderMarkdownInline(quoteLine, references, onOpenReference, `quote-${index}-${quoteIndex}`) }, `quote-line-${index}-${quoteIndex}`))) }, `quote-${index}`));
            continue;
        }
        const paragraphLines = [];
        while (index < lines.length && lines[index].trim()) {
            if (/^(#{1,4})\s+/.test(lines[index]) || /^[-*]\s+/.test(lines[index]) || /^\d+\.\s+/.test(lines[index]) || /^>\s+/.test(lines[index]) || lines[index].trim().startsWith("```")) {
                break;
            }
            paragraphLines.push(lines[index]);
            index += 1;
        }
        if (paragraphLines.length === 0) {
            index += 1;
            continue;
        }
        const paragraphText = paragraphLines.join("\n");
        const paragraphParts = paragraphText.split("\n");
        blocks.push(_jsx("p", { children: paragraphParts.map((part, partIndex) => (_jsxs("span", { children: [partIndex > 0 ? _jsx("br", {}) : null, renderMarkdownInline(part, references, onOpenReference, `paragraph-${index}-${partIndex}`)] }, `paragraph-part-${index}-${partIndex}`))) }, `paragraph-${index}`));
    }
    return blocks;
}
function describeReferenceVisibility(reference) {
    if (reference.visibility === "campaign") {
        return "Visible para toda la campaña";
    }
    if (reference.visibility === "selected_players") {
        return reference.sharedWithEmails.length > 0
            ? `Compartida con ${reference.sharedWithEmails.length} jugador(es)`
            : "Compartida con jugadores concretos";
    }
    return "Solo DJ";
}
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
    const [referenceCreateError, setReferenceCreateError] = useState(null);
    const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
    const [draft, setDraft] = useState(emptyCampaignForm);
    const [memberEmail, setMemberEmail] = useState("");
    const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
    const [selectedReferenceId, setSelectedReferenceId] = useState(null);
    const [referenceForm, setReferenceForm] = useState(emptyReferenceForm);
    const [referenceAliasesText, setReferenceAliasesText] = useState("");
    const [isReferenceCreateModalOpen, setIsReferenceCreateModalOpen] = useState(false);
    const [selectedSharedNoteId, setSelectedSharedNoteId] = useState(null);
    const [sharedNoteEditor, setSharedNoteEditor] = useState(null);
    const [sharedNoteError, setSharedNoteError] = useState(null);
    const [isReferenceDetailModalOpen, setIsReferenceDetailModalOpen] = useState(false);
    const [isReferenceEditMode, setIsReferenceEditMode] = useState(false);
    const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
    const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
    const [isBurdenSummaryModalOpen, setIsBurdenSummaryModalOpen] = useState(false);
    const [pendingUnlinkCharacter, setPendingUnlinkCharacter] = useState(null);
    const selectedCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null, [campaigns, selectedCampaignId]);
    const selectedSheetEntry = useMemo(() => selectedCampaign?.characters.find((entry) => entry.id === selectedSheetId) ?? null, [selectedCampaign, selectedSheetId]);
    const selectedReference = useMemo(() => selectedCampaign?.references.find((entry) => entry.id === selectedReferenceId) ?? null, [selectedCampaign, selectedReferenceId]);
    const sortedSharedNotes = useMemo(() => sortSharedNoteEntries(selectedCampaign?.sharedNoteEntries ?? []), [selectedCampaign]);
    const selectedSharedNote = useMemo(() => sortedSharedNotes.find((entry) => entry.id === selectedSharedNoteId) ?? null, [selectedSharedNoteId, sortedSharedNotes]);
    const canEditSelectedReference = isDirector || selectedReference?.authorId === user.id;
    const shareableMembers = useMemo(() => (selectedCampaign?.members ?? []).filter((member) => member.role === "player"), [selectedCampaign]);
    const linkableCharacters = useMemo(() => (selectedCampaign?.availableCharacters ?? []).filter((entry) => !entry.linked && (isDirector || entry.ownerId === user.id)), [isDirector, selectedCampaign, user.id]);
    const selectedSharedNoteReferenceHighlights = useMemo(() => selectedSharedNote ? (selectedCampaign?.references ?? []).filter((reference) => referenceMatchesText(reference, selectedSharedNote.content)) : [], [selectedCampaign, selectedSharedNote]);
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
        Boolean(selectedSharedNoteId) ||
        Boolean(sharedNoteEditor) ||
        isReferenceCreateModalOpen ||
        isReferenceDetailModalOpen ||
        isBurdenSummaryModalOpen ||
        Boolean(pendingUnlinkCharacter) ||
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
            setSelectedSharedNoteId(null);
            setSharedNoteEditor(null);
            setSharedNoteError(null);
            setPendingUnlinkCharacter(null);
            setReferenceCreateError(null);
            setIsReferenceCreateModalOpen(false);
            setIsReferenceEditMode(false);
            setIsReferenceDetailModalOpen(false);
            return;
        }
        setDraft({
            name: selectedCampaign.name,
            summary: selectedCampaign.summary,
            setting: selectedCampaign.setting,
            notes: selectedCampaign.notes,
            sharedNotes: selectedCampaign.sharedNotes,
            sharedNoteEntries: selectedCampaign.sharedNoteEntries
        });
    }, [selectedCampaign]);
    useEffect(() => {
        if (selectedReferenceId && !selectedCampaign?.references.some((entry) => entry.id === selectedReferenceId)) {
            setSelectedReferenceId(null);
            setIsReferenceEditMode(false);
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
            visibility: selectedReference.visibility,
            sharedWithUserIds: selectedReference.sharedWithUserIds
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
    function buildSharedNoteDraft(entry) {
        const now = new Date().toISOString();
        return {
            id: entry?.id ?? buildTimestampedNoteId("campaign-note"),
            title: entry?.title ?? "",
            content: entry?.content ?? "",
            authorId: entry?.authorId || user.id,
            authorEmail: entry?.authorEmail || user.email,
            createdAt: entry?.createdAt || now,
            updatedAt: entry?.updatedAt || now
        };
    }
    async function persistSharedNotes(nextEntries) {
        if (!selectedCampaign) {
            return null;
        }
        const token = await ensureAccessToken();
        const updated = await updateCampaign(selectedCampaign.id, {
            sharedNoteEntries: sortSharedNoteEntries(nextEntries)
        }, token);
        upsertCampaign(updated);
        return updated;
    }
    async function handleSaveSharedNote() {
        if (!selectedCampaign || !sharedNoteEditor) {
            return;
        }
        const trimmedTitle = sharedNoteEditor.note.title.trim();
        const trimmedContent = sharedNoteEditor.note.content.trim();
        if (trimmedTitle.length < 2) {
            setSharedNoteError("El titulo debe tener al menos 2 caracteres.");
            return;
        }
        setSharedNoteError(null);
        setFormError(null);
        setIsSaving(true);
        try {
            const now = new Date().toISOString();
            const normalized = {
                ...sharedNoteEditor.note,
                title: trimmedTitle,
                content: trimmedContent,
                updatedAt: now,
                createdAt: sharedNoteEditor.note.createdAt || now,
                authorId: sharedNoteEditor.note.authorId || user.id,
                authorEmail: sharedNoteEditor.note.authorEmail || user.email
            };
            const nextEntries = sharedNoteEditor.mode === "create"
                ? [normalized, ...sortedSharedNotes]
                : sortedSharedNotes.map((entry) => entry.id === normalized.id ? normalized : entry);
            await persistSharedNotes(nextEntries);
            setSelectedSharedNoteId(normalized.id);
            setSharedNoteEditor(null);
        }
        catch (err) {
            setSharedNoteError(err instanceof Error ? err.message : "No se pudo guardar la nota compartida");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleDeleteSharedNote(noteId) {
        setSharedNoteError(null);
        setFormError(null);
        setIsSaving(true);
        try {
            await persistSharedNotes(sortedSharedNotes.filter((entry) => entry.id !== noteId));
            if (selectedSharedNoteId === noteId) {
                setSelectedSharedNoteId(null);
            }
            setSharedNoteEditor(null);
        }
        catch (err) {
            setSharedNoteError(err instanceof Error ? err.message : "No se pudo eliminar la nota compartida");
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
            setPendingUnlinkCharacter(null);
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
        setReferenceCreateError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const aliases = referenceAliasesText
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean);
            const payload = createCampaignReferenceSchema.parse({
                ...referenceForm,
                label: referenceForm.label.trim(),
                aliases
            });
            const updated = await createCampaignReference(selectedCampaign.id, payload, token);
            upsertCampaign(updated);
            const createdReference = updated.references.find((entry) => entry.name === payload.name && entry.label === payload.label && entry.content === payload.content);
            setSelectedReferenceId(createdReference?.id ?? null);
            setReferenceCreateError(null);
            setIsReferenceCreateModalOpen(false);
            setIsReferenceDetailModalOpen(Boolean(createdReference));
        }
        catch (err) {
            setReferenceCreateError(describeReferenceValidationError(err));
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
                label: referenceForm.label.trim(),
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
        setReferenceCreateError(null);
        setSelectedReferenceId(null);
        setReferenceForm(emptyReferenceForm);
        setReferenceAliasesText("");
        setIsReferenceEditMode(false);
        setIsReferenceDetailModalOpen(false);
        setIsReferenceCreateModalOpen(true);
    }
    function openReferenceDetail(referenceId) {
        setFormError(null);
        setReferenceCreateError(null);
        setSelectedReferenceId(referenceId);
        setIsReferenceEditMode(false);
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
                                                }, children: "Detalles" })) : null] })] }), formError && !selectedSharedNoteId && !sharedNoteEditor && !isCampaignDetailsModalOpen && !isReferenceCreateModalOpen && !isReferenceDetailModalOpen ? (_jsx("p", { className: "error-text", children: formError })) : null, _jsxs("div", { className: "toolbar campaign-section-nav", children: [isDirector ? (_jsx("button", { type: "button", className: activeSection === "dmNotes" ? "is-active" : "", onClick: () => setActiveSection("dmNotes"), children: "Notas DJ" })) : null, _jsx("button", { type: "button", className: activeSection === "sharedNotes" ? "is-active" : "", onClick: () => setActiveSection("sharedNotes"), children: "Notas compartidas" }), _jsx("button", { type: "button", className: activeSection === "wiki" ? "is-active" : "", onClick: () => setActiveSection("wiki"), children: "Wiki" }), _jsx("button", { type: "button", className: activeSection === "members" ? "is-active" : "", onClick: () => setActiveSection("members"), children: "Miembros" }), _jsx("button", { type: "button", className: activeSection === "characters" ? "is-active" : "", onClick: () => setActiveSection("characters"), children: "Personajes" })] })] }), isDirector && activeSection === "dmNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Notas privadas del DJ" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveDmNotes(), children: isSaving ? "Guardando..." : "Guardar" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Apuntes privados de campana" }), _jsx("textarea", { rows: 14, value: draft.notes, onChange: (event) => setDraft((current) => ({ ...current, notes: event.target.value })), placeholder: "Notas privadas para el director de juego" })] })] })) : null, activeSection === "sharedNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Notas compartidas" }), _jsx("p", { className: "section-help", children: "Entradas ordenadas en Markdown, visibles para toda la campa\u00F1a y con enlaces a la wiki detectados dentro de cada nota." })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                            setSharedNoteError(null);
                                            setSharedNoteEditor({ mode: "create", note: buildSharedNoteDraft() });
                                        }, children: "Nueva nota" })] }), _jsxs("div", { className: "campaign-reference-list", children: [sortedSharedNotes.map((note) => (_jsxs("button", { type: "button", className: "campaign-list-item", onClick: () => {
                                            setSharedNoteError(null);
                                            setSelectedSharedNoteId(note.id);
                                        }, children: [_jsx("strong", { children: note.title }), _jsx("span", { children: summarizeNoteContent(note.content) }), _jsx("span", { children: note.authorEmail ? `Autor: ${note.authorEmail}` : "Nota compartida" }), _jsxs("span", { children: ["Actualizada: ", formatDate(note.updatedAt || note.createdAt)] })] }, note.id))), sortedSharedNotes.length === 0 ? (_jsx("p", { className: "section-help", children: "Aun no hay notas compartidas registradas." })) : null] })] })) : null, activeSection === "wiki" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Wiki de campana" }), _jsx("p", { className: "section-help", children: "Jugadores pueden aportar entradas visibles para toda la campa\u00F1a. El DJ puede mantener entradas privadas o compartirlas con jugadores concretos." })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: handlePrepareNewReference, children: "Nueva referencia" })] }), _jsxs("div", { className: "campaign-reference-list", children: [selectedCampaign.references.map((reference) => (_jsxs("button", { type: "button", className: "campaign-list-item", onClick: () => openReferenceDetail(reference.id), children: [_jsx("strong", { children: reference.name }), _jsx("span", { children: reference.label }), _jsx("span", { children: reference.summary || "Sin resumen breve" }), reference.aliases.length > 0 ? _jsxs("span", { children: ["Alias: ", reference.aliases.join(", ")] }) : null, _jsx("span", { children: describeReferenceVisibility(reference) }), _jsxs("span", { children: ["Autor: ", reference.authorEmail] })] }, reference.id))), selectedCampaign.references.length === 0 ? (_jsx("p", { className: "section-help", children: "Aun no hay referencias en esta campana." })) : null] })] })) : null, activeSection === "members" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Miembros" }), isDirector ? (_jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Email del jugador" }), _jsx("input", { value: memberEmail, onChange: (event) => setMemberEmail(event.target.value) })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleAddMember(), children: "Agregar" })] })) : null] }), _jsx("div", { className: "cards", children: selectedCampaign.members.map((member) => (_jsxs("article", { className: "card", children: [_jsx("strong", { children: member.email }), _jsx("span", { children: member.role === "gm" ? "Director" : "Jugador" }), _jsxs("span", { children: ["Alta: ", new Date(member.joinedAt).toLocaleDateString()] }), isDirector && member.role !== "gm" ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleRemoveMember(member.id), children: "Quitar" })) : null] }, member.id))) })] })) : null, activeSection === "characters" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Personajes vinculados" }), _jsx("p", { className: "section-help", children: "El director puede revisar todas las hojas vinculadas desde aqui. Los jugadores pueden vincular sus propios personajes." })] }), _jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Personaje disponible" }), _jsxs("select", { value: selectedAvailableCharacterId, onChange: (event) => setSelectedAvailableCharacterId(event.target.value), children: [linkableCharacters.length === 0 ? _jsx("option", { value: "", children: "Sin personajes disponibles" }) : null, linkableCharacters.map((entry) => (_jsxs("option", { value: entry.characterId, children: [entry.name, " - ", entry.ownerEmail] }, entry.characterId)))] })] }), _jsx("button", { type: "button", disabled: isSaving || !selectedAvailableCharacterId, onClick: () => void handleLinkCharacter(), children: "Vincular" }), isDirector ? (_jsx("button", { type: "button", className: "subtle-button", onClick: () => setIsBurdenSummaryModalOpen(true), children: "Resumen de cargas" })) : null] })] }), _jsxs("div", { className: "cards", children: [selectedCampaign.characters.map((entry) => {
                                        const canManageLink = isDirector || entry.ownerId === user.id;
                                        return (_jsxs("article", { className: "card", children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.ownerEmail }), _jsxs("span", { children: ["PX total: ", entry.experienceTotal, " | PX gastada: ", entry.experienceSpent] }), _jsxs("span", { children: ["Actualizado: ", formatDate(entry.updatedAt)] }), _jsxs("div", { className: "card-actions", children: [isDirector && entry.sheet ? (_jsx("button", { type: "button", onClick: () => {
                                                                setSelectedSheetId(entry.id);
                                                            }, children: "Abrir hoja" })) : null, canManageLink ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                                setFormError(null);
                                                                setPendingUnlinkCharacter(entry);
                                                            }, children: "Desvincular" })) : null] })] }, entry.id));
                                    }), selectedCampaign.characters.length === 0 ? (_jsx("p", { className: "section-help", children: "Todavia no hay personajes vinculados." })) : null] })] })) : null, selectedSheetEntry && false ? (_jsx("section", { className: "campaign-sheet-shell", children: _jsx(UnifiedCharacterSheet, { title: campaignSheetModalEntry?.name ?? "", subtitle: `${selectedSheetEntry?.ownerEmail ?? ""} · Hoja vinculada a campana`, sheet: selectedSheetEntry.sheet, editable: false, busy: isSaving, onBack: () => {
                                setSelectedSheetId(null);
                                setActiveSection("characters");
                            } }) })) : null] })) : null, selectedSharedNote && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setSharedNoteError(null);
                        setSelectedSharedNoteId(null);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel campaign-shared-notes-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: selectedSharedNote.title }), _jsxs("p", { className: "section-help", children: [selectedSharedNote.authorEmail ? `${selectedSharedNote.authorEmail} · ` : "", "Actualizada ", formatDate(selectedSharedNote.updatedAt || selectedSharedNote.createdAt)] })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setSharedNoteError(null);
                                                setSharedNoteEditor({ mode: "edit", note: buildSharedNoteDraft(selectedSharedNote) });
                                            }, children: "Editar" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setSharedNoteError(null);
                                                setSelectedSharedNoteId(null);
                                            }, children: "Cerrar" })] })] }), selectedSharedNoteReferenceHighlights.length > 0 ? (_jsx("div", { className: "compendium-tags", children: selectedSharedNoteReferenceHighlights.map((reference) => (_jsx("button", { type: "button", className: "compendium-chip", onClick: () => openReferenceDetail(reference.id), children: reference.name }, reference.id))) })) : null, _jsx("div", { className: "campaign-markdown", children: renderMarkdownBlocks(selectedSharedNote.content || "Sin contenido detallado.", selectedSharedNoteReferenceHighlights, openReferenceDetail) })] }) })) : null, sharedNoteEditor && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setSharedNoteEditor(null);
                        setSharedNoteError(null);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel campaign-shared-notes-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: sharedNoteEditor.mode === "create" ? "Nueva nota compartida" : "Editar nota compartida" }), _jsx("p", { className: "section-help", children: "La nota acepta Markdown y sera visible para los miembros de la campa\u00F1a." })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveSharedNote(), children: isSaving ? "Guardando..." : "Guardar" }), sharedNoteEditor.mode === "edit" ? (_jsx("button", { type: "button", className: "danger-button", disabled: isSaving, onClick: () => void handleDeleteSharedNote(sharedNoteEditor.note.id), children: "Eliminar" })) : null, _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setSharedNoteEditor(null);
                                                setSharedNoteError(null);
                                            }, children: "Cerrar" })] })] }), sharedNoteError ? _jsx("p", { className: "error-text", children: sharedNoteError }) : null, _jsx("div", { className: "form-grid", children: _jsxs("label", { className: "field", children: [_jsx("span", { children: "Titulo" }), _jsx("input", { value: sharedNoteEditor.note.title, onChange: (event) => setSharedNoteEditor((current) => current ? {
                                            ...current,
                                            note: { ...current.note, title: event.target.value }
                                        } : null) })] }) }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 16, value: sharedNoteEditor.note.content, onChange: (event) => setSharedNoteEditor((current) => current ? {
                                        ...current,
                                        note: { ...current.note, content: event.target.value }
                                    } : null), placeholder: "Apuntes de sesion, acuerdos del grupo, pistas, recordatorios..." })] })] }) })) : null, pendingUnlinkCharacter ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setPendingUnlinkCharacter(null);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Confirmar desvinculacion" }), _jsxs("p", { className: "section-help", children: ["Vas a desvincular a ", pendingUnlinkCharacter.name, " de esta campana. Su ficha no se borra, pero dejara de aparecer aqui."] })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                        setPendingUnlinkCharacter(null);
                                    }, children: "Cerrar" })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsx("div", { className: "toolbar", children: _jsx("button", { type: "button", className: "danger-button", disabled: isSaving, onClick: () => void handleUnlinkCharacter(pendingUnlinkCharacter.id), children: isSaving ? "Desvinculando..." : "Confirmar desvinculacion" }) })] }) })) : null, campaignSheetModalEntry ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    setSelectedSheetId(null);
                }, children: _jsxs("div", { className: "panel modal-panel campaign-character-sheet-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions campaign-character-sheet-modal-header", children: [_jsxs("div", { children: [_jsx("h3", { children: campaignSheetModalEntry.name }), _jsxs("p", { className: "section-help", children: [campaignSheetModalEntry.ownerEmail, " | Hoja vinculada a campana"] })] }), _jsx("button", { type: "button", onClick: () => setSelectedSheetId(null), children: "Cerrar" })] }), _jsx("div", { className: "campaign-character-sheet-modal-body", children: _jsx(UnifiedCharacterSheet, { title: campaignSheetModalEntry.name, subtitle: `${campaignSheetModalEntry.ownerEmail} | Hoja vinculada a campana`, sheet: campaignSheetModalEntry.sheet, editable: false, busy: isSaving }) })] }) })) : null, isDirector && isBurdenSummaryModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
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
                                            }, children: "Cerrar" })] })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: draft.name, onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ambientacion" }), _jsx("input", { value: draft.setting, onChange: (event) => setDraft((current) => ({ ...current, setting: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 4, value: draft.summary, onChange: (event) => setDraft((current) => ({ ...current, summary: event.target.value })) })] })] }) })) : null, isReferenceCreateModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setReferenceCreateError(null);
                        setIsReferenceCreateModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Nueva referencia" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleCreateReference(), children: isSaving ? "Creando..." : "Crear" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setReferenceCreateError(null);
                                                setIsReferenceCreateModalOpen(false);
                                            }, children: "Cerrar" })] })] }), referenceCreateError ? _jsx("p", { className: "error-text", children: referenceCreateError }) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: referenceForm.name, onChange: (event) => setReferenceForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categoria (opcional)" }), _jsx("input", { value: referenceForm.label, onChange: (event) => setReferenceForm((current) => ({ ...current, label: event.target.value })), placeholder: "PNJ, lugar, faccion, trama..." })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("input", { value: referenceForm.summary, onChange: (event) => setReferenceForm((current) => ({ ...current, summary: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Alias" }), _jsx("input", { value: referenceAliasesText, onChange: (event) => setReferenceAliasesText(event.target.value), placeholder: "Nombres alternativos separados por comas" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 12, value: referenceForm.content, onChange: (event) => setReferenceForm((current) => ({ ...current, content: event.target.value })), placeholder: "Detalle extenso de la referencia, usos, relaciones, pistas..." })] }), isDirector ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Visibilidad" }), _jsxs("select", { value: referenceForm.visibility, onChange: (event) => setReferenceForm((current) => ({
                                                ...current,
                                                visibility: event.target.value,
                                                sharedWithUserIds: event.target.value === "selected_players" ? current.sharedWithUserIds : []
                                            })), children: [_jsx("option", { value: "campaign", children: "Toda la campa\u00F1a" }), _jsx("option", { value: "selected_players", children: "Jugadores concretos" }), _jsx("option", { value: "gm_only", children: "Solo DJ" })] })] }), referenceForm.visibility === "selected_players" ? (_jsxs("div", { className: "field", children: [_jsx("span", { children: "Jugadores con acceso" }), _jsx("div", { className: "cards", children: shareableMembers.map((member) => (_jsxs("label", { className: "checkbox-field", children: [_jsx("input", { type: "checkbox", checked: referenceForm.sharedWithUserIds.includes(member.userId), onChange: (event) => setReferenceForm((current) => ({
                                                            ...current,
                                                            sharedWithUserIds: event.target.checked
                                                                ? [...current.sharedWithUserIds, member.userId]
                                                                : current.sharedWithUserIds.filter((entry) => entry !== member.userId)
                                                        })) }), _jsx("span", { children: member.email })] }, member.id))) })] })) : null] })) : (_jsx("p", { className: "section-help", children: "Las entradas creadas por jugadores siempre se comparten con toda la campa\u00F1a." }))] }) })) : null, isReferenceDetailModalOpen && selectedReference ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setFormError(null);
                        setIsReferenceDetailModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: selectedReference.name }), _jsxs("p", { className: "section-help", children: [selectedReference.label, " \u00B7 ", describeReferenceVisibility(selectedReference)] })] }), _jsxs("div", { className: "toolbar", children: [canEditSelectedReference && isReferenceEditMode ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveReference(), children: isSaving ? "Guardando..." : "Guardar" }), _jsx("button", { type: "button", className: "danger-button", disabled: isSaving, onClick: () => void handleDeleteReference(selectedReference.id), children: "Eliminar" })] })) : null, canEditSelectedReference && !isReferenceEditMode ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setFormError(null);
                                                setIsReferenceEditMode(true);
                                            }, children: "Editar" })) : null, canEditSelectedReference && isReferenceEditMode ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setFormError(null);
                                                setIsReferenceEditMode(false);
                                                if (selectedReference) {
                                                    setReferenceForm({
                                                        name: selectedReference.name,
                                                        label: selectedReference.label,
                                                        aliases: selectedReference.aliases,
                                                        summary: selectedReference.summary,
                                                        content: selectedReference.content,
                                                        visibility: selectedReference.visibility,
                                                        sharedWithUserIds: selectedReference.sharedWithUserIds
                                                    });
                                                    setReferenceAliasesText(selectedReference.aliases.join(", "));
                                                }
                                            }, children: "Cancelar" })) : null, _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setFormError(null);
                                                setIsReferenceEditMode(false);
                                                setIsReferenceDetailModalOpen(false);
                                            }, children: "Cerrar" })] })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, canEditSelectedReference && isReferenceEditMode ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: referenceForm.name, onChange: (event) => setReferenceForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categoria" }), _jsx("input", { value: referenceForm.label, onChange: (event) => setReferenceForm((current) => ({ ...current, label: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("input", { value: referenceForm.summary, onChange: (event) => setReferenceForm((current) => ({ ...current, summary: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Alias" }), _jsx("input", { value: referenceAliasesText, onChange: (event) => setReferenceAliasesText(event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 12, value: referenceForm.content, onChange: (event) => setReferenceForm((current) => ({ ...current, content: event.target.value })) })] }), isDirector ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Visibilidad" }), _jsxs("select", { value: referenceForm.visibility, onChange: (event) => setReferenceForm((current) => ({
                                                        ...current,
                                                        visibility: event.target.value,
                                                        sharedWithUserIds: event.target.value === "selected_players" ? current.sharedWithUserIds : []
                                                    })), children: [_jsx("option", { value: "campaign", children: "Toda la campa\u00F1a" }), _jsx("option", { value: "selected_players", children: "Jugadores concretos" }), _jsx("option", { value: "gm_only", children: "Solo DJ" })] })] }), referenceForm.visibility === "selected_players" ? (_jsxs("div", { className: "field", children: [_jsx("span", { children: "Jugadores con acceso" }), _jsx("div", { className: "cards", children: shareableMembers.map((member) => (_jsxs("label", { className: "checkbox-field", children: [_jsx("input", { type: "checkbox", checked: referenceForm.sharedWithUserIds.includes(member.userId), onChange: (event) => setReferenceForm((current) => ({
                                                                    ...current,
                                                                    sharedWithUserIds: event.target.checked
                                                                        ? [...current.sharedWithUserIds, member.userId]
                                                                        : current.sharedWithUserIds.filter((entry) => entry !== member.userId)
                                                                })) }), _jsx("span", { children: member.email })] }, member.id))) })] })) : null] })) : (_jsx("p", { className: "section-help", children: "Tu entrada sigue siendo visible para toda la campa\u00F1a." }))] })) : (_jsxs("article", { className: "campaign-reference-detail-card", children: [_jsxs("div", { className: "campaign-reference-detail-header", children: [_jsxs("div", { children: [_jsx("p", { className: "campaign-reference-detail-kicker", children: "Entrada de wiki" }), _jsx("h4", { children: selectedReference.name })] }), _jsxs("div", { className: "campaign-reference-detail-meta", children: [_jsx("span", { className: "compendium-chip", children: selectedReference.label }), _jsx("span", { className: "compendium-chip", children: describeReferenceVisibility(selectedReference) })] })] }), _jsxs("div", { className: "campaign-reference-detail-grid", children: [_jsxs("article", { className: "campaign-reference-preview", children: [_jsx("span", { className: "meta-text", children: "Resumen" }), _jsx("p", { children: selectedReference.summary || "Sin resumen breve." })] }), _jsxs("article", { className: "campaign-reference-preview", children: [_jsx("span", { className: "meta-text", children: "Autor" }), _jsx("p", { children: selectedReference.authorEmail })] })] }), selectedReference.aliases.length > 0 ? (_jsxs("article", { className: "campaign-reference-preview", children: [_jsx("span", { className: "meta-text", children: "Alias" }), _jsx("div", { className: "compendium-tags", children: selectedReference.aliases.map((alias) => (_jsx("span", { className: "compendium-chip", children: alias }, `${selectedReference.id}-${alias}`))) })] })) : null, _jsxs("article", { className: "campaign-reference-preview campaign-reference-preview--content", children: [_jsx("span", { className: "meta-text", children: "Contenido" }), _jsx("div", { className: "campaign-markdown", children: renderMarkdownBlocks(selectedReference.content || "Sin contenido detallado.", [selectedReference], openReferenceDetail) })] })] }))] }) })) : null] }));
}
