import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { createCampaignReferenceSchema, createCampaignSchema } from "@umbra/shared";
import { acceptCampaignInvitation, createCampaign, createCampaignReference, deleteCampaignReference, decideProfessionRequest, fetchCampaigns, fetchCampaignInvitations, linkCampaignCharacter, removeCampaignMember, dismissCampaignInvitation, sendCampaignInvitation, unlinkCampaignCharacter, grantCampaignExperience, updateCampaignCharacterSheet, updateCampaign, updateCampaignReference } from "../services/campaignService";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
import { CharacterChangeLogModal } from "../components/CharacterChangeLogModal";
import { leaveProfession } from "../services/characterService";
import { CharacterBuilderView } from "./CharacterBuilderView";
import { MysticArtifactEditorWizard } from "../components/MysticArtifactEditorWizard";
import { MysticArtifactDetailsModal } from "../components/MysticArtifactDetailsModal";
import { assignMysticArtifactOwner, bindMysticArtifact, bindNpcMysticArtifact, createCampaignMysticArtifact, deleteCampaignMysticArtifact, fetchMysticArtifactPresets, fetchMysticArtifactSource, unbindMysticArtifact, updateCampaignMysticArtifact, updateMysticArtifactResource, useMysticArtifactAbility } from "../services/mysticArtifactService";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ALL_ENTRIES } from "../models/compendiumEntries";
import { buildPdfViewerUrl } from "../services/pdfViewer";
import { CampaignCombatView } from "../components/CampaignCombatView";
const emptyCampaignForm = {
    name: "",
    summary: "",
    setting: "",
    notes: "",
    dmNoteEntries: [],
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
const EMPTY_ARTIFACT_DEFINITION = {
    name: "Nuevo artefacto",
    description: "",
    kind: "object",
    sourceTitle: "Creación de campaña",
    bindingCosts: [{ paymentType: "xp", amount: 1 }],
    abilities: [],
    resources: []
};
function editableArtifactDefinition(artifact) {
    return {
        name: artifact.name,
        description: artifact.description,
        kind: artifact.kind,
        sourceTitle: artifact.sourceTitle,
        sourcePage: artifact.sourcePage,
        bindingCosts: artifact.bindingCosts,
        weapon: artifact.weapon,
        armor: artifact.armor,
        abilities: artifact.abilities.map(({ id: _id, locked: _locked, lockReason: _lockReason, rolls, requirements, ...ability }) => ({
            ...ability,
            rolls: rolls.map(({ id: _rollId, ...roll }) => roll),
            requirements: requirements.map(({ id: _requirementId, ...requirement }) => requirement)
        })),
        resources: artifact.resources.map(({ id: _id, ...resource }) => resource)
    };
}
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
function getSharedNoteSortPreferenceKey(userId) {
    return `umbra:campaign-shared-notes-sort:${userId}`;
}
function readSharedNoteSortPreference(userId) {
    if (typeof window === "undefined") {
        return "updated_desc";
    }
    const storedValue = window.localStorage.getItem(getSharedNoteSortPreferenceKey(userId));
    if (storedValue === "updated_desc" ||
        storedValue === "updated_asc" ||
        storedValue === "title_asc" ||
        storedValue === "title_desc") {
        return storedValue;
    }
    return "updated_desc";
}
function sortSharedNoteEntries(entries, sortOption) {
    return [...entries].sort((left, right) => {
        if (sortOption === "title_asc" || sortOption === "title_desc") {
            const direction = sortOption === "title_asc" ? 1 : -1;
            const titleOrder = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
            if (titleOrder !== 0) {
                return titleOrder * direction;
            }
        }
        const leftDate = left.updatedAt || left.createdAt || "";
        const rightDate = right.updatedAt || right.createdAt || "";
        const dateOrder = rightDate.localeCompare(leftDate);
        if (dateOrder !== 0) {
            if (sortOption === "updated_asc") {
                return -dateOrder;
            }
            if (sortOption === "updated_desc") {
                return dateOrder;
            }
        }
        const fallbackTitleOrder = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
        if (fallbackTitleOrder !== 0) {
            return fallbackTitleOrder;
        }
        return left.id.localeCompare(right.id);
    });
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
        return { campaignId: null, sheetId: null, section: null, invitationId: null };
    }
    const [, search = ""] = rawHash.split("?");
    const params = new URLSearchParams(search);
    const rawSection = params.get("section");
    const section = rawSection === "dmNotes" ||
        rawSection === "sharedNotes" ||
        rawSection === "wiki" ||
        rawSection === "members" ||
        rawSection === "characters" ||
        rawSection === "artifacts" ||
        rawSection === "combat"
        ? rawSection
        : null;
    return {
        campaignId: params.get("id"),
        sheetId: params.get("sheetId"),
        section,
        invitationId: params.get("invitation")
    };
}
function replaceCampaignHash(campaignId, sheetId, section, invitationId = null) {
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
    if (invitationId) {
        params.set("invitation", invitationId);
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
    const [invitations, setInvitations] = useState([]);
    const [focusedInvitationId, setFocusedInvitationId] = useState(initialHash.invitationId);
    const [selectedCampaignId, setSelectedCampaignId] = useState(initialHash.campaignId);
    const [selectedSheetId, setSelectedSheetId] = useState(initialHash.sheetId);
    const [campaignCharacterView, setCampaignCharacterView] = useState("sheet");
    const [changeLogCharacterId, setChangeLogCharacterId] = useState(null);
    const [experienceHistoryCharacterId, setExperienceHistoryCharacterId] = useState(null);
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
    const [selectedDmNoteId, setSelectedDmNoteId] = useState(null);
    const [dmNoteEditor, setDmNoteEditor] = useState(null);
    const [dmNoteError, setDmNoteError] = useState(null);
    const [dmNoteSearch, setDmNoteSearch] = useState("");
    const [dmNoteSort, setDmNoteSort] = useState("updated_desc");
    const [selectedSharedNoteId, setSelectedSharedNoteId] = useState(null);
    const [sharedNoteEditor, setSharedNoteEditor] = useState(null);
    const [sharedNoteError, setSharedNoteError] = useState(null);
    const [sharedNoteSearch, setSharedNoteSearch] = useState("");
    const [sharedNoteSort, setSharedNoteSort] = useState(() => readSharedNoteSortPreference(user.id));
    const [isReferenceDetailModalOpen, setIsReferenceDetailModalOpen] = useState(false);
    const [isReferenceEditMode, setIsReferenceEditMode] = useState(false);
    const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
    const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
    const [isBurdenSummaryModalOpen, setIsBurdenSummaryModalOpen] = useState(false);
    const [isProfessionRequestsModalOpen, setIsProfessionRequestsModalOpen] = useState(false);
    const [pendingUnlinkCharacter, setPendingUnlinkCharacter] = useState(null);
    const [experienceGrantDraft, setExperienceGrantDraft] = useState(null);
    const [experienceGrantError, setExperienceGrantError] = useState(null);
    const [artifactPresets, setArtifactPresets] = useState([]);
    const [artifactSearch, setArtifactSearch] = useState("");
    const [artifactSourceFilter, setArtifactSourceFilter] = useState("");
    const [isArtifactAddModalOpen, setIsArtifactAddModalOpen] = useState(false);
    const [selectedPresetId, setSelectedPresetId] = useState("");
    const [presetResourceMaximums, setPresetResourceMaximums] = useState({});
    const [artifactEditor, setArtifactEditor] = useState(null);
    const [artifactDetails, setArtifactDetails] = useState(null);
    const [artifactError, setArtifactError] = useState(null);
    const selectedCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null, [campaigns, selectedCampaignId]);
    const focusedInvitation = useMemo(() => invitations.find((invitation) => invitation.id === focusedInvitationId) ?? null, [focusedInvitationId, invitations]);
    const experienceLogByCharacterId = useMemo(() => {
        const groupedEntries = new Map();
        for (const entry of selectedCampaign?.experienceLog ?? []) {
            const characterEntries = groupedEntries.get(entry.characterId) ?? [];
            characterEntries.push(entry);
            groupedEntries.set(entry.characterId, characterEntries);
        }
        return groupedEntries;
    }, [selectedCampaign]);
    const experienceHistoryCharacter = useMemo(() => selectedCampaign?.characters.find((entry) => entry.characterId === experienceHistoryCharacterId) ?? null, [experienceHistoryCharacterId, selectedCampaign]);
    const selectedExperienceHistory = useMemo(() => experienceHistoryCharacter ? experienceLogByCharacterId.get(experienceHistoryCharacter.characterId) ?? [] : [], [experienceHistoryCharacter, experienceLogByCharacterId]);
    const selectedSheetEntry = useMemo(() => selectedCampaign?.characters.find((entry) => entry.id === selectedSheetId) ?? null, [selectedCampaign, selectedSheetId]);
    const selectedReference = useMemo(() => selectedCampaign?.references.find((entry) => entry.id === selectedReferenceId) ?? null, [selectedCampaign, selectedReferenceId]);
    const allSortedDmNotes = useMemo(() => sortSharedNoteEntries(selectedCampaign?.dmNoteEntries ?? [], dmNoteSort), [dmNoteSort, selectedCampaign]);
    const sortedDmNotes = useMemo(() => {
        const normalizedSearch = normalizeLookupValue(dmNoteSearch);
        return allSortedDmNotes.filter((entry) => !normalizedSearch || normalizeLookupValue(entry.title).includes(normalizedSearch));
    }, [allSortedDmNotes, dmNoteSearch]);
    const selectedDmNote = useMemo(() => allSortedDmNotes.find((entry) => entry.id === selectedDmNoteId) ?? null, [allSortedDmNotes, selectedDmNoteId]);
    const allSortedSharedNotes = useMemo(() => sortSharedNoteEntries(selectedCampaign?.sharedNoteEntries ?? [], sharedNoteSort), [selectedCampaign, sharedNoteSort]);
    const filteredSharedNotes = useMemo(() => {
        const normalizedSearch = normalizeLookupValue(sharedNoteSearch);
        return allSortedSharedNotes.filter((entry) => !normalizedSearch || normalizeLookupValue(entry.title).includes(normalizedSearch));
    }, [allSortedSharedNotes, sharedNoteSearch]);
    const sortedSharedNotes = filteredSharedNotes;
    const selectedSharedNote = useMemo(() => allSortedSharedNotes.find((entry) => entry.id === selectedSharedNoteId) ?? null, [allSortedSharedNotes, selectedSharedNoteId]);
    const canEditSelectedReference = isDirector || selectedReference?.authorId === user.id;
    const shareableMembers = useMemo(() => (selectedCampaign?.members ?? []).filter((member) => member.role === "player"), [selectedCampaign]);
    const linkableCharacters = useMemo(() => (selectedCampaign?.availableCharacters ?? []).filter((entry) => !entry.linked && (isDirector || entry.ownerId === user.id)), [isDirector, selectedCampaign, user.id]);
    const artifactSources = useMemo(() => Array.from(new Set((selectedCampaign?.mysticArtifacts ?? []).map((artifact) => artifact.sourceTitle).filter(Boolean))).sort(), [selectedCampaign]);
    const visibleCampaignArtifacts = useMemo(() => {
        const query = normalizeLookupValue(artifactSearch);
        return (selectedCampaign?.mysticArtifacts ?? []).filter((artifact) => (!query || normalizeLookupValue(`${artifact.name} ${artifact.description} ${artifact.ownerName ?? ""}`).includes(query)) &&
            (!artifactSourceFilter || artifact.sourceTitle === artifactSourceFilter));
    }, [artifactSearch, artifactSourceFilter, selectedCampaign]);
    const selectedPreset = useMemo(() => artifactPresets.find((artifact) => artifact.id === selectedPresetId) ?? null, [artifactPresets, selectedPresetId]);
    const selectedSharedNoteReferenceHighlights = useMemo(() => selectedSharedNote ? (selectedCampaign?.references ?? []).filter((reference) => referenceMatchesText(reference, selectedSharedNote.content)) : [], [selectedCampaign, selectedSharedNote]);
    const selectedDmNoteReferenceHighlights = useMemo(() => selectedDmNote ? (selectedCampaign?.references ?? []).filter((reference) => referenceMatchesText(reference, selectedDmNote.content)) : [], [selectedCampaign, selectedDmNote]);
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
    const campaignBuilderCharacter = useMemo(() => {
        if (!campaignSheetModalEntry?.sheet)
            return null;
        const sheet = campaignSheetModalEntry.sheet;
        return {
            id: campaignSheetModalEntry.characterId,
            name: campaignSheetModalEntry.name,
            archetype: String(sheet.identidad.arquetipo),
            race: String(sheet.identidad.raza),
            culture: String(sheet.identidad.cultura),
            profession: sheet.identidad.profesion,
            level: 1,
            sheet,
            mysticArtifacts: (selectedCampaign?.mysticArtifacts ?? [])
                .filter((artifact) => artifact.ownerType === "character" && artifact.ownerId === campaignSheetModalEntry.id)
                .map((artifact) => ({ ...artifact, campaignName: selectedCampaign?.name ?? "Campaña" })),
            artifactBindingXpSpent: (selectedCampaign?.mysticArtifacts ?? [])
                .filter((artifact) => artifact.ownerType === "character" && artifact.ownerId === campaignSheetModalEntry.id && artifact.bindingPaymentType === "xp")
                .reduce((total, artifact) => total + (artifact.bindingPaymentAmount ?? 0), 0),
            unreadChangeCount: campaignSheetModalEntry.unreadChangeCount ?? 0,
            professionMemberships: campaignSheetModalEntry.professionMemberships,
            createdAt: campaignSheetModalEntry.updatedAt,
            updatedAt: campaignSheetModalEntry.updatedAt
        };
    }, [campaignSheetModalEntry, selectedCampaign]);
    const isSheetModalOpen = Boolean(campaignSheetModalEntry);
    const isAnyModalOpen = isCreateCampaignModalOpen ||
        isCampaignDetailsModalOpen ||
        Boolean(selectedDmNoteId) ||
        Boolean(dmNoteEditor) ||
        Boolean(selectedSharedNoteId) ||
        Boolean(sharedNoteEditor) ||
        isReferenceCreateModalOpen ||
        isReferenceDetailModalOpen ||
        isBurdenSummaryModalOpen ||
        isProfessionRequestsModalOpen ||
        Boolean(pendingUnlinkCharacter) ||
        Boolean(experienceGrantDraft) ||
        isArtifactAddModalOpen ||
        Boolean(artifactEditor) ||
        isSheetModalOpen ||
        Boolean(changeLogCharacterId) ||
        Boolean(experienceHistoryCharacterId) ||
        Boolean(focusedInvitation);
    useBodyScrollLock(isAnyModalOpen);
    useEffect(() => {
        void refresh();
    }, []);
    useEffect(() => {
        if (!isDirector)
            return;
        void (async () => {
            try {
                const token = await ensureAccessToken();
                const presets = await fetchMysticArtifactPresets(token);
                setArtifactPresets(presets);
                setSelectedPresetId((current) => current || presets[0]?.id || "");
            }
            catch (err) {
                setArtifactError(err instanceof Error ? err.message : "No se pudo cargar el catálogo de artefactos");
            }
        })();
    }, [ensureAccessToken, isDirector]);
    useEffect(() => {
        if (!selectedPreset) {
            setPresetResourceMaximums({});
            return;
        }
        setPresetResourceMaximums(Object.fromEntries(selectedPreset.resources.map((resource) => {
            const parsed = Number.parseInt(resource.suggestedMaxFormula, 10);
            return [resource.key, resource.maximum ?? (Number.isFinite(parsed) ? parsed : 1)];
        })));
    }, [selectedPreset]);
    useEffect(() => {
        function syncSelectionFromHash() {
            const next = parseCampaignHash();
            setSelectedCampaignId(next.campaignId);
            setSelectedSheetId(next.sheetId);
            setFocusedInvitationId(next.invitationId);
            setActiveSection(next.section && (isDirector || next.section !== "dmNotes") ? next.section : defaultSection);
        }
        syncSelectionFromHash();
        window.addEventListener("hashchange", syncSelectionFromHash);
        return () => window.removeEventListener("hashchange", syncSelectionFromHash);
    }, [defaultSection, isDirector]);
    useEffect(() => {
        replaceCampaignHash(selectedCampaignId, selectedSheetId, selectedCampaignId ? activeSection : null, focusedInvitationId);
    }, [activeSection, focusedInvitationId, selectedCampaignId, selectedSheetId]);
    useEffect(() => {
        if (!isDirector && activeSection === "dmNotes") {
            setActiveSection("sharedNotes");
        }
    }, [activeSection, isDirector]);
    useEffect(() => {
        setSharedNoteSort(readSharedNoteSortPreference(user.id));
    }, [user.id]);
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem(getSharedNoteSortPreferenceKey(user.id), sharedNoteSort);
    }, [sharedNoteSort, user.id]);
    useEffect(() => {
        if (!selectedCampaign) {
            setDraft(emptyCampaignForm);
            setSelectedAvailableCharacterId("");
            setSelectedSheetId(null);
            setSelectedReferenceId(null);
            setReferenceForm(emptyReferenceForm);
            setReferenceAliasesText("");
            setSelectedDmNoteId(null);
            setDmNoteEditor(null);
            setDmNoteError(null);
            setDmNoteSearch("");
            setSelectedSharedNoteId(null);
            setSharedNoteEditor(null);
            setSharedNoteError(null);
            setSharedNoteSearch("");
            setPendingUnlinkCharacter(null);
            setExperienceGrantDraft(null);
            setExperienceGrantError(null);
            setExperienceHistoryCharacterId(null);
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
            dmNoteEntries: selectedCampaign.dmNoteEntries,
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
            setExperienceHistoryCharacterId(null);
            return;
        }
        if (selectedSheetId && !selectedCampaign.characters.some((entry) => entry.id === selectedSheetId)) {
            setSelectedSheetId(null);
        }
        if (experienceHistoryCharacterId && !selectedCampaign.characters.some((entry) => entry.characterId === experienceHistoryCharacterId)) {
            setExperienceHistoryCharacterId(null);
        }
    }, [activeSection, experienceHistoryCharacterId, isLoading, selectedCampaign, selectedCampaignId, selectedSheetId]);
    async function refresh() {
        setIsLoading(true);
        setLoadError(null);
        try {
            const token = await ensureAccessToken();
            const [nextCampaigns, nextInvitations] = await Promise.all([
                fetchCampaigns(token),
                fetchCampaignInvitations(token)
            ]);
            setCampaigns(nextCampaigns);
            setInvitations(nextInvitations);
            if (focusedInvitationId && !nextInvitations.some((invitation) => invitation.id === focusedInvitationId)) {
                setFocusedInvitationId(null);
                setFormError("La invitación del enlace ya no está disponible o ya fue respondida.");
            }
        }
        catch (err) {
            setLoadError(err instanceof Error ? err.message : "No se pudieron cargar las campañas");
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
            setFormError(err instanceof Error ? err.message : "No se pudo crear la campaña");
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
    function buildDmNoteDraft(entry) {
        const now = new Date().toISOString();
        return {
            id: entry?.id ?? buildTimestampedNoteId("dm-note"),
            title: entry?.title ?? "",
            content: entry?.content ?? "",
            authorId: entry?.authorId || user.id,
            authorEmail: entry?.authorEmail || user.email,
            createdAt: entry?.createdAt || now,
            updatedAt: entry?.updatedAt || now
        };
    }
    async function persistDmNotes(nextEntries) {
        if (!selectedCampaign)
            return null;
        const token = await ensureAccessToken();
        const updated = await updateCampaign(selectedCampaign.id, {
            dmNoteEntries: sortSharedNoteEntries(nextEntries, "updated_desc")
        }, token);
        upsertCampaign(updated);
        return updated;
    }
    async function handleSaveDmNote() {
        if (!selectedCampaign || !dmNoteEditor)
            return;
        const trimmedTitle = dmNoteEditor.note.title.trim();
        const trimmedContent = dmNoteEditor.note.content.trim();
        if (trimmedTitle.length < 2) {
            setDmNoteError("El titulo debe tener al menos 2 caracteres.");
            return;
        }
        setDmNoteError(null);
        setFormError(null);
        setIsSaving(true);
        try {
            const now = new Date().toISOString();
            const normalized = {
                ...dmNoteEditor.note,
                title: trimmedTitle,
                content: trimmedContent,
                updatedAt: now,
                createdAt: dmNoteEditor.note.createdAt || now,
                authorId: dmNoteEditor.note.authorId || user.id,
                authorEmail: dmNoteEditor.note.authorEmail || user.email
            };
            const nextEntries = dmNoteEditor.mode === "create"
                ? [normalized, ...allSortedDmNotes]
                : allSortedDmNotes.map((entry) => entry.id === normalized.id ? normalized : entry);
            await persistDmNotes(nextEntries);
            setSelectedDmNoteId(normalized.id);
            setDmNoteEditor(null);
        }
        catch (err) {
            setDmNoteError(err instanceof Error ? err.message : "No se pudo guardar la nota privada");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleDeleteDmNote(noteId) {
        setDmNoteError(null);
        setFormError(null);
        setIsSaving(true);
        try {
            await persistDmNotes(allSortedDmNotes.filter((entry) => entry.id !== noteId));
            if (selectedDmNoteId === noteId)
                setSelectedDmNoteId(null);
            setDmNoteEditor(null);
        }
        catch (err) {
            setDmNoteError(err instanceof Error ? err.message : "No se pudo eliminar la nota privada");
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
            sharedNoteEntries: sortSharedNoteEntries(nextEntries, "updated_desc")
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
                ? [normalized, ...allSortedSharedNotes]
                : allSortedSharedNotes.map((entry) => entry.id === normalized.id ? normalized : entry);
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
            await persistSharedNotes(allSortedSharedNotes.filter((entry) => entry.id !== noteId));
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
    async function handleSendInvitation() {
        if (!selectedCampaign || !memberEmail.trim()) {
            return;
        }
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await sendCampaignInvitation(selectedCampaign.id, { email: memberEmail.trim() }, token));
            setMemberEmail("");
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo enviar la invitación");
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
    async function handleSaveCampaignCharacter(entry, sheet, editSource) {
        if (!sheet)
            return;
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await updateCampaignCharacterSheet(entry.id, { sheet, editSource }, token));
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo guardar el personaje");
            throw err;
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleAcceptInvitation(invitationId) {
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const campaign = await acceptCampaignInvitation(invitationId, token);
            setInvitations((current) => current.filter((entry) => entry.id !== invitationId));
            setFocusedInvitationId(null);
            upsertCampaign(campaign);
            setActiveSection("sharedNotes");
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo aceptar la invitación");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleDismissInvitation(invitationId, campaignId) {
        setFormError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            await dismissCampaignInvitation(invitationId, token);
            setInvitations((current) => current.filter((entry) => entry.id !== invitationId));
            setFocusedInvitationId((current) => current === invitationId ? null : current);
            if (campaignId) {
                setCampaigns((current) => current.map((campaign) => campaign.id === campaignId ? {
                    ...campaign,
                    pendingInvitations: (campaign.pendingInvitations ?? []).filter((entry) => entry.id !== invitationId)
                } : campaign));
            }
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo retirar la invitación");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleGrantExperience() {
        if (!selectedCampaign || !experienceGrantDraft) {
            return;
        }
        const amount = Number(experienceGrantDraft.amount);
        const reason = experienceGrantDraft.reason.trim();
        if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
            setExperienceGrantError("La cantidad debe ser un numero entero entre 1 y 1000 PX.");
            return;
        }
        if (reason.length < 2) {
            setExperienceGrantError("Indica el motivo de la concesion de experiencia.");
            return;
        }
        setExperienceGrantError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            upsertCampaign(await grantCampaignExperience(selectedCampaign.id, {
                characterId: experienceGrantDraft.characterId,
                amount,
                reason
            }, token));
            setExperienceGrantDraft(null);
        }
        catch (err) {
            setExperienceGrantError(err instanceof Error ? err.message : "No se pudo conceder la experiencia.");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleProfessionDecision(requestId, decision) {
        if (!selectedCampaign)
            return;
        const note = decision === "reject" ? window.prompt("Nota opcional para el jugador:", "") ?? "" : "";
        setIsSaving(true);
        setFormError(null);
        try {
            const token = await ensureAccessToken();
            await decideProfessionRequest(selectedCampaign.id, requestId, { decision, note }, token);
            await refresh();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo resolver la solicitud profesional.");
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
    async function runArtifactMutation(operation) {
        setArtifactError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            await operation(token);
            await refresh();
            return true;
        }
        catch (err) {
            setArtifactError(err instanceof Error ? err.message : "No se pudo actualizar el artefacto");
            return false;
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleClonePreset() {
        if (!selectedCampaign || !selectedPreset)
            return;
        const resources = selectedPreset.resources.map((resource) => {
            const maximum = Math.max(0, Math.floor(presetResourceMaximums[resource.key] ?? 0));
            return { key: resource.key, maximum, current: maximum };
        });
        const created = await runArtifactMutation((token) => createCampaignMysticArtifact(selectedCampaign.id, {
            mode: "preset",
            presetId: selectedPreset.id,
            resources
        }, token));
        if (created)
            setIsArtifactAddModalOpen(false);
    }
    async function handleSaveArtifactEditor(definition) {
        if (!selectedCampaign || !artifactEditor)
            return;
        setArtifactError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            if (artifactEditor.id) {
                await updateCampaignMysticArtifact(artifactEditor.id, definition, token);
            }
            else {
                await createCampaignMysticArtifact(selectedCampaign.id, { mode: "custom", artifact: definition }, token);
            }
            await refresh();
            setArtifactEditor(null);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo guardar el artefacto";
            setArtifactError(message);
            throw err instanceof Error ? err : new Error(message);
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleOpenArtifactSource(artifact) {
        setArtifactError(null);
        const opened = window.open("about:blank", "_blank");
        if (!opened) {
            setArtifactError("El navegador ha bloqueado la pestaña de la fuente");
            return;
        }
        opened.opener = null;
        try {
            const token = await ensureAccessToken();
            const source = await fetchMysticArtifactSource(artifact.id, token);
            opened.location.href = buildPdfViewerUrl(source.objectUrl, source.pdfPage);
            window.setTimeout(() => URL.revokeObjectURL(source.objectUrl), 60_000);
        }
        catch (error) {
            opened.close();
            setArtifactError(error instanceof Error ? error.message : "No se pudo abrir la fuente del artefacto");
        }
    }
    async function handleArtifactOwnerChange(artifact, value) {
        if (value === "none") {
            await runArtifactMutation((token) => assignMysticArtifactOwner(artifact.id, { ownerType: "none" }, token));
            return;
        }
        const [ownerType, ownerId] = value.split(":");
        if ((ownerType !== "character" && ownerType !== "npc") || !ownerId)
            return;
        await runArtifactMutation((token) => assignMysticArtifactOwner(artifact.id, { ownerType, ownerId }, token));
    }
    async function handleAdjustArtifactResource(artifact, resource) {
        const maximumText = window.prompt(`Máximo numérico de ${resource.name}`, String(resource.maximum ?? 0));
        if (maximumText === null)
            return;
        const currentText = window.prompt(`Valor actual de ${resource.name}`, String(resource.current ?? 0));
        if (currentText === null)
            return;
        const maximum = Number(maximumText);
        const current = Number(currentText);
        if (!Number.isInteger(maximum) || !Number.isInteger(current) || maximum < 0 || current < 0 || current > maximum) {
            setArtifactError("El medidor necesita enteros y el valor actual no puede superar el máximo.");
            return;
        }
        await runArtifactMutation((token) => updateMysticArtifactResource(artifact.id, resource.id, { maximum, current }, token));
    }
    return (_jsxs("main", { className: "campaign-dashboard", children: [!selectedCampaign ? (_jsxs(_Fragment, { children: [_jsx("header", { className: "panel module-sticky-header module-sticky-header--single-row campaign-module-header", children: _jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h1", { children: "Campa\u00F1as" }), _jsx("p", { className: "section-help", children: "Notas compartidas, notas del DJ y personajes vinculados." })] }), _jsxs("div", { className: "toolbar", children: [isDirector ? (_jsx("button", { type: "button", onClick: () => {
                                                setFormError(null);
                                                setIsCreateCampaignModalOpen(true);
                                            }, children: "Nueva campa\u00F1a" })) : null, _jsx("button", { type: "button", disabled: isLoading, onClick: () => void refresh(), children: "Recargar" })] })] }) }), _jsxs("section", { className: "panel campaign-list-panel", children: [loadError ? _jsx("p", { className: "error-text", children: loadError }) : null, formError ? _jsx("p", { className: "error-text", children: formError }) : null, isLoading ? _jsx("p", { children: "Cargando campa\u00F1as..." }) : null, invitations.length > 0 ? (_jsxs("section", { className: "campaign-invitations-section", "aria-labelledby": "campaign-invitations-title", children: [_jsxs("div", { children: [_jsx("h2", { id: "campaign-invitations-title", children: "Invitaciones pendientes" }), _jsx("p", { className: "section-help", children: "Solo entrar\u00E1s en una campa\u00F1a despu\u00E9s de aceptar su invitaci\u00F3n." })] }), _jsx("div", { className: "campaign-invite-grid", children: invitations.map((invitation) => (_jsxs("article", { className: "campaign-invite-item", children: [_jsxs("div", { className: "campaign-invite-copy", children: [_jsx("strong", { children: invitation.campaignName }), _jsxs("span", { children: ["Invitaci\u00F3n de ", invitation.gmEmail] }), _jsxs("span", { children: ["Enviada: ", formatDate(invitation.createdAt)] })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleAcceptInvitation(invitation.id), children: "Aceptar" }), _jsx("button", { type: "button", className: "subtle-button", disabled: isSaving, onClick: () => void handleDismissInvitation(invitation.id), children: "Rechazar" })] })] }, invitation.id))) })] })) : null, _jsxs("div", { className: "campaign-list", children: [campaigns.map((campaign) => (_jsxs("button", { type: "button", className: `campaign-list-item${selectedCampaignId === campaign.id ? " is-active" : ""}`, onClick: () => {
                                            setSelectedCampaignId(campaign.id);
                                            setSelectedSheetId(null);
                                            setActiveSection(isDirector ? "dmNotes" : "sharedNotes");
                                        }, children: [_jsx("strong", { children: campaign.name }), _jsx("span", { children: campaign.setting || campaign.summary || "Sin ambientacion" }), _jsxs("span", { children: [campaign.members.length, " miembros"] }), _jsxs("span", { children: [campaign.characters.length, " personajes vinculados"] })] }, campaign.id))), !isLoading && campaigns.length === 0 ? (_jsx("p", { className: "section-help", children: "Aun no hay campa\u00F1as accesibles." })) : null] })] })] })) : null, selectedCampaign ? (_jsxs("section", { className: "campaign-main", children: [_jsxs("header", { className: "panel module-sticky-header campaign-module-header", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h2", { children: selectedCampaign.name }), selectedCampaign.summary ? _jsx("p", { className: "section-help", children: selectedCampaign.summary }) : null] }), _jsxs("div", { className: "campaign-header-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                                    setSelectedCampaignId(null);
                                                    setSelectedSheetId(null);
                                                    setActiveSection(isDirector ? "dmNotes" : "sharedNotes");
                                                }, children: "Volver a campa\u00F1as" }), isDirector ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "subtle-button", onClick: () => setIsProfessionRequestsModalOpen(true), children: ["Solicitudes profesionales (", selectedCampaign.pendingProfessionRequests?.length ?? 0, ")"] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                            setFormError(null);
                                                            setIsCampaignDetailsModalOpen(true);
                                                        }, children: "Detalles" })] })) : null] })] }), formError && !selectedDmNoteId && !dmNoteEditor && !selectedSharedNoteId && !sharedNoteEditor && !isCampaignDetailsModalOpen && !isReferenceCreateModalOpen && !isReferenceDetailModalOpen ? (_jsx("p", { className: "error-text", children: formError })) : null, _jsxs("div", { className: "toolbar campaign-section-nav", children: [isDirector ? (_jsx("button", { type: "button", className: activeSection === "dmNotes" ? "is-active" : "", onClick: () => setActiveSection("dmNotes"), children: "Notas DJ" })) : null, _jsx("button", { type: "button", className: activeSection === "sharedNotes" ? "is-active" : "", onClick: () => setActiveSection("sharedNotes"), children: "Notas compartidas" }), _jsx("button", { type: "button", className: activeSection === "wiki" ? "is-active" : "", onClick: () => setActiveSection("wiki"), children: "Wiki" }), _jsx("button", { type: "button", className: activeSection === "members" ? "is-active" : "", onClick: () => setActiveSection("members"), children: "Miembros" }), _jsx("button", { type: "button", className: activeSection === "characters" ? "is-active" : "", onClick: () => setActiveSection("characters"), children: "Personajes" }), isDirector ? (_jsx("button", { type: "button", className: activeSection === "artifacts" ? "is-active" : "", onClick: () => setActiveSection("artifacts"), children: "Artefactos" })) : null, isDirector ? (_jsx("button", { type: "button", className: activeSection === "combat" ? "is-active" : "", onClick: () => setActiveSection("combat"), children: "Combate" })) : null] })] }), isDirector && activeSection === "dmNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Notas privadas del DJ" }), _jsx("p", { className: "section-help", children: "Entradas privadas en Markdown, visibles exclusivamente para el director de juego." })] }), _jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Buscar por titulo" }), _jsx("input", { value: dmNoteSearch, onChange: (event) => setDmNoteSearch(event.target.value), placeholder: "Nombre de la nota" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ordenar" }), _jsxs("select", { value: dmNoteSort, onChange: (event) => setDmNoteSort(event.target.value), children: [_jsx("option", { value: "updated_desc", children: "Mas recientes" }), _jsx("option", { value: "updated_asc", children: "Mas antiguas" }), _jsx("option", { value: "title_asc", children: "Titulo A-Z" }), _jsx("option", { value: "title_desc", children: "Titulo Z-A" })] })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                    setDmNoteError(null);
                                                    setDmNoteEditor({ mode: "create", note: buildDmNoteDraft() });
                                                }, children: "Nueva nota" })] })] }), _jsxs("div", { className: "campaign-reference-list", children: [sortedDmNotes.map((note) => (_jsxs("button", { type: "button", className: "campaign-list-item", onClick: () => {
                                            setDmNoteError(null);
                                            setSelectedDmNoteId(note.id);
                                        }, children: [_jsx("strong", { children: note.title }), _jsx("span", { children: "Nota privada del DJ" }), _jsxs("span", { children: ["Actualizada: ", note.updatedAt || note.createdAt ? formatDate(note.updatedAt || note.createdAt) : "Sin fecha registrada"] })] }, note.id))), sortedDmNotes.length === 0 ? (_jsx("p", { className: "section-help", children: dmNoteSearch.trim()
                                            ? "No hay notas privadas que coincidan con ese titulo."
                                            : "Aun no hay notas privadas registradas." })) : null] })] })) : null, activeSection === "sharedNotes" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Notas compartidas" }), _jsx("p", { className: "section-help", children: "Entradas en Markdown visibles para toda la campa\u00F1a, con busqueda por titulo y enlaces a la wiki detectados dentro de cada nota." })] }), _jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Buscar por titulo" }), _jsx("input", { value: sharedNoteSearch, onChange: (event) => setSharedNoteSearch(event.target.value), placeholder: "Nombre de la nota" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ordenar" }), _jsxs("select", { value: sharedNoteSort, onChange: (event) => setSharedNoteSort(event.target.value), children: [_jsx("option", { value: "updated_desc", children: "Mas recientes" }), _jsx("option", { value: "updated_asc", children: "Mas antiguas" }), _jsx("option", { value: "title_asc", children: "Titulo A-Z" }), _jsx("option", { value: "title_desc", children: "Titulo Z-A" })] })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                    setSharedNoteError(null);
                                                    setSharedNoteEditor({ mode: "create", note: buildSharedNoteDraft() });
                                                }, children: "Nueva nota" })] })] }), _jsxs("div", { className: "campaign-reference-list", children: [sortedSharedNotes.map((note) => (_jsxs("button", { type: "button", className: "campaign-list-item", onClick: () => {
                                            setSharedNoteError(null);
                                            setSelectedSharedNoteId(note.id);
                                        }, children: [_jsx("strong", { children: note.title }), _jsx("span", { children: note.authorEmail ? `Autor: ${note.authorEmail}` : "Nota compartida" }), _jsxs("span", { children: ["Actualizada: ", formatDate(note.updatedAt || note.createdAt)] })] }, note.id))), sortedSharedNotes.length === 0 ? (_jsx("p", { className: "section-help", children: sharedNoteSearch.trim()
                                            ? "No hay notas compartidas que coincidan con ese titulo."
                                            : "Aun no hay notas compartidas registradas." })) : null] })] })) : null, activeSection === "wiki" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Wiki de campa\u00F1a" }), _jsx("p", { className: "section-help", children: "Jugadores pueden aportar entradas visibles para toda la campa\u00F1a. El DJ puede mantener entradas privadas o compartirlas con jugadores concretos." })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: handlePrepareNewReference, children: "Nueva referencia" })] }), _jsxs("div", { className: "campaign-reference-list", children: [selectedCampaign.references.map((reference) => (_jsxs("button", { type: "button", className: "campaign-list-item", onClick: () => openReferenceDetail(reference.id), children: [_jsx("strong", { children: reference.name }), _jsx("span", { children: reference.label }), _jsx("span", { children: reference.summary || "Sin resumen breve" }), reference.aliases.length > 0 ? _jsxs("span", { children: ["Alias: ", reference.aliases.join(", ")] }) : null, _jsx("span", { children: describeReferenceVisibility(reference) }), _jsxs("span", { children: ["Autor: ", reference.authorEmail] })] }, reference.id))), selectedCampaign.references.length === 0 ? (_jsx("p", { className: "section-help", children: "Aun no hay referencias en esta campa\u00F1a." })) : null] })] })) : null, activeSection === "members" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Miembros" }), isDirector ? (_jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Email del jugador" }), _jsx("input", { type: "email", autoComplete: "email", value: memberEmail, onChange: (event) => setMemberEmail(event.target.value) })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSendInvitation(), children: "Enviar invitaci\u00F3n" })] })) : null] }), _jsx("div", { className: "cards", children: selectedCampaign.members.map((member) => (_jsxs("article", { className: "card", children: [_jsx("strong", { children: member.email }), _jsx("span", { children: member.role === "gm" ? "Director" : "Jugador" }), _jsxs("span", { children: ["Alta: ", new Date(member.joinedAt).toLocaleDateString()] }), isDirector && member.role !== "gm" ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleRemoveMember(member.id), children: "Quitar" })) : null] }, member.id))) }), isDirector && (selectedCampaign.pendingInvitations ?? []).length > 0 ? (_jsxs("div", { className: "campaign-pending-invitations", children: [_jsx("h4", { children: "Invitaciones pendientes" }), _jsx("div", { className: "campaign-invite-grid", children: (selectedCampaign.pendingInvitations ?? []).map((invitation) => (_jsxs("article", { className: "campaign-invite-item", children: [_jsxs("div", { className: "campaign-invite-copy", children: [_jsx("strong", { children: invitation.invitedEmail }), _jsx("span", { children: "Pendiente de aceptaci\u00F3n" }), _jsxs("span", { children: ["Enviada: ", formatDate(invitation.createdAt)] })] }), _jsx("button", { type: "button", className: "subtle-button", disabled: isSaving, onClick: () => void handleDismissInvitation(invitation.id, selectedCampaign.id), children: "Cancelar invitaci\u00F3n" })] }, invitation.id))) })] })) : null] })) : null, activeSection === "characters" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Personajes vinculados" }), _jsx("p", { className: "section-help", children: "El director concede la experiencia desde aqui. Los jugadores pueden invertirla desde el constructor de su personaje." })] }), _jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Personaje disponible" }), _jsxs("select", { value: selectedAvailableCharacterId, onChange: (event) => setSelectedAvailableCharacterId(event.target.value), children: [linkableCharacters.length === 0 ? _jsx("option", { value: "", children: "Sin personajes disponibles" }) : null, linkableCharacters.map((entry) => (_jsxs("option", { value: entry.characterId, children: [entry.name, " - ", entry.ownerEmail] }, entry.characterId)))] })] }), _jsx("button", { type: "button", disabled: isSaving || !selectedAvailableCharacterId, onClick: () => void handleLinkCharacter(), children: "Vincular" }), isDirector ? (_jsx("button", { type: "button", className: "subtle-button", onClick: () => setIsBurdenSummaryModalOpen(true), children: "Resumen de cargas" })) : null] })] }), _jsxs("div", { className: "cards", children: [selectedCampaign.characters.map((entry) => {
                                        const canManageLink = isDirector || entry.ownerId === user.id;
                                        const canViewChangeLog = entry.ownerId === user.id ||
                                            user.role === "superadmin" ||
                                            selectedCampaign.gmId === user.id;
                                        return (_jsxs("article", { className: "card campaign-character-card", "aria-label": `Personaje ${entry.name}`, children: [_jsx("strong", { children: entry.name }), _jsx("span", { children: entry.ownerEmail }), _jsxs("span", { children: ["PX total: ", entry.experienceTotal, " | Gastada: ", entry.experienceSpent, " | Disponible: ", Math.max(0, entry.experienceTotal - entry.experienceSpent)] }), _jsxs("span", { children: ["Actualizado: ", formatDate(entry.updatedAt)] }), entry.sheetLoadError ? _jsx("span", { className: "error-text", children: "La ficha necesita reparaci\u00F3n, pero la campa\u00F1a sigue disponible." }) : null, _jsxs("div", { className: "card-actions", children: [isDirector && entry.sheet ? (_jsx("button", { type: "button", onClick: () => {
                                                                setSelectedSheetId(entry.id);
                                                                setCampaignCharacterView("sheet");
                                                            }, children: "Abrir hoja" })) : null, isDirector && entry.sheet ? (_jsx("button", { type: "button", onClick: () => { setSelectedSheetId(entry.id); setCampaignCharacterView("builder"); }, children: "Constructor" })) : null, canViewChangeLog ? (_jsxs("button", { type: "button", className: "character-history-button", "aria-label": `Historial de cambios de ${entry.name}`, onClick: () => setChangeLogCharacterId(entry.characterId), children: ["Historial", (entry.unreadChangeCount ?? 0) > 0 ? _jsx("span", { className: "character-history-badge", "aria-label": `${entry.unreadChangeCount} cambios sin leer`, children: entry.unreadChangeCount }) : null] })) : null, _jsx("button", { type: "button", className: "subtle-button", onClick: () => setExperienceHistoryCharacterId(entry.characterId), children: "Historial de PX" }), isDirector ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                                setExperienceGrantError(null);
                                                                setExperienceGrantDraft({
                                                                    characterId: entry.characterId,
                                                                    characterName: entry.name,
                                                                    amount: "",
                                                                    reason: "Recompensa de campaña"
                                                                });
                                                            }, children: "Conceder PX" })) : null, canManageLink ? (_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                                setFormError(null);
                                                                setPendingUnlinkCharacter(entry);
                                                            }, children: "Desvincular" })) : null] })] }, entry.id));
                                    }), selectedCampaign.characters.length === 0 ? (_jsx("p", { className: "section-help", children: "Todavia no hay personajes vinculados." })) : null] })] })) : null, isDirector && activeSection === "combat" ? (_jsx(CampaignCombatView, { campaign: selectedCampaign, ensureAccessToken: ensureAccessToken, onCampaignRefresh: refresh, onOpenCharacter: (campaignCharacterId) => {
                            setSelectedSheetId(campaignCharacterId);
                            setCampaignCharacterView("sheet");
                        } })) : null, isDirector && activeSection === "artifacts" ? (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Artefactos m\u00EDsticos" }), _jsx("p", { className: "section-help", children: "Solo se muestran los artefactos que el DJ ha incluido en esta campa\u00F1a." })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                            setArtifactError(null);
                                            setIsArtifactAddModalOpen(true);
                                        }, children: "A\u00F1adir artefacto" })] }), artifactError ? _jsx("p", { className: "error-text", children: artifactError }) : null, _jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Buscar" }), _jsx("input", { value: artifactSearch, onChange: (event) => setArtifactSearch(event.target.value), placeholder: "Nombre, texto o poseedor" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Libro o aventura" }), _jsxs("select", { value: artifactSourceFilter, onChange: (event) => setArtifactSourceFilter(event.target.value), children: [_jsx("option", { value: "", children: "Todos" }), artifactSources.map((source) => _jsx("option", { value: source, children: source }, source))] })] })] }), _jsxs("div", { className: "cards", children: [visibleCampaignArtifacts.map((artifact) => {
                                        const ownerValue = artifact.ownerType && artifact.ownerId ? `${artifact.ownerType}:${artifact.ownerId}` : "none";
                                        return (_jsxs("article", { className: "card", children: [_jsx("strong", { children: artifact.name }), _jsxs("span", { children: [artifact.kind === "weapon" ? "Arma" : artifact.kind === "armor" ? "Armadura" : "Objeto", " \u00B7 ", artifact.sourceTitle || "Personalizado", artifact.sourcePage ? ` p.${artifact.sourcePage}` : ""] }), _jsx("span", { children: artifact.isBound ? `Vinculado (${artifact.bindingPaymentType === "xp" ? `${artifact.bindingPaymentAmount} PX` : artifact.bindingPaymentType === "permanent_corruption" ? `${artifact.bindingPaymentAmount} Corrupción permanente` : "narrativo"})` : "Sin vínculo" }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Poseedor" }), _jsxs("select", { value: ownerValue, disabled: isSaving || artifact.isBound, onChange: (event) => void handleArtifactOwnerChange(artifact, event.target.value), children: [_jsx("option", { value: "none", children: "Sin poseedor" }), selectedCampaign.characters.map((entry) => _jsxs("option", { value: `character:${entry.id}`, children: ["PJ \u00B7 ", entry.name] }, entry.id)), selectedCampaign.npcs.map((npc) => _jsxs("option", { value: `npc:${npc.id}`, children: ["PNJ \u00B7 ", npc.name] }, npc.id))] })] }), artifact.resources.map((resource) => (_jsxs("div", { className: "inline-row", children: [_jsxs("span", { children: [resource.name, ": ", resource.current ?? 0, "/", resource.maximum ?? 0, resource.suggestedMaxFormula ? ` (${resource.suggestedMaxFormula})` : ""] }), _jsx("button", { type: "button", disabled: isSaving || (resource.current ?? 0) <= 0, onClick: () => void runArtifactMutation((token) => updateMysticArtifactResource(artifact.id, resource.id, { maximum: resource.maximum ?? 0, current: Math.max(0, (resource.current ?? 0) - 1) }, token)), children: "\u2212" }), _jsx("button", { type: "button", disabled: isSaving || (resource.current ?? 0) >= (resource.maximum ?? 0), onClick: () => void runArtifactMutation((token) => updateMysticArtifactResource(artifact.id, resource.id, { maximum: resource.maximum ?? 0, current: Math.min(resource.maximum ?? 0, (resource.current ?? 0) + 1) }, token)), children: "+" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleAdjustArtifactResource(artifact, resource), children: "Ajustar" })] }, resource.id))), _jsxs("div", { className: "card-actions", children: [_jsx("button", { type: "button", onClick: () => setArtifactDetails(artifact), children: "Ver detalles" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                                setArtifactError(null);
                                                                setArtifactEditor({ id: artifact.id, definition: editableArtifactDefinition(artifact) });
                                                            }, children: "Editar artefacto" }), artifact.ownerType === "npc" && !artifact.isBound ? _jsx("button", { type: "button", disabled: isSaving, onClick: () => void runArtifactMutation((token) => bindNpcMysticArtifact(artifact.id, token)), children: "Vincular PNJ" }) : null, artifact.isBound ? _jsx("button", { type: "button", disabled: isSaving, onClick: () => void runArtifactMutation((token) => unbindMysticArtifact(artifact.id, token)), children: "Romper v\u00EDnculo" }) : null, !artifact.isBound && !artifact.ownerId ? _jsx("button", { type: "button", disabled: isSaving, onClick: () => void runArtifactMutation((token) => deleteCampaignMysticArtifact(artifact.id, token)), children: "Eliminar" }) : null] })] }, artifact.id));
                                    }), visibleCampaignArtifacts.length === 0 ? (_jsx("p", { className: "section-help", children: (selectedCampaign.mysticArtifacts ?? []).length === 0
                                            ? "Todavía no se han añadido artefactos a esta campaña."
                                            : "No hay artefactos que coincidan con los filtros." })) : null] })] })) : null, selectedSheetEntry && false ? (_jsx("section", { className: "campaign-sheet-shell", children: _jsx(UnifiedCharacterSheet, { title: campaignSheetModalEntry?.name ?? "", subtitle: `${selectedSheetEntry?.ownerEmail ?? ""} · Hoja vinculada a campaña`, sheet: selectedSheetEntry.sheet, editable: false, busy: isSaving, onUseArtifactAbility: async (artifactId, abilityId) => {
                                const token = await ensureAccessToken();
                                await useMysticArtifactAbility(artifactId, abilityId, token);
                                await refresh();
                            }, onBack: () => {
                                setSelectedSheetId(null);
                                setActiveSection("characters");
                            } }) })) : null] })) : null, isArtifactAddModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => !isSaving && setIsArtifactAddModalOpen(false), children: _jsxs("div", { className: "panel modal-panel campaign-artifact-add-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "A\u00F1adir artefacto" }), _jsx("p", { className: "section-help", children: "Elige una plantilla predefinida o crea un artefacto personalizado para esta campa\u00F1a." })] }), _jsx("button", { type: "button", className: "subtle-button", disabled: isSaving, onClick: () => setIsArtifactAddModalOpen(false), children: "Cerrar" })] }), artifactError ? _jsx("p", { className: "error-text", children: artifactError }) : null, _jsxs("section", { className: "campaign-artifact-add-modal__section", children: [_jsx("h4", { children: "Artefacto predefinido" }), artifactPresets.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Seleccionar artefacto" }), _jsx("select", { value: selectedPresetId, onChange: (event) => setSelectedPresetId(event.target.value), children: artifactPresets.map((preset) => (_jsxs("option", { value: preset.id, children: [preset.name, " \u00B7 ", preset.sourceTitle, preset.sourcePage ? ` p.${preset.sourcePage}` : ""] }, preset.id))) })] }), selectedPreset?.resources.map((resource) => (_jsxs("label", { className: "field", children: [_jsxs("span", { children: ["M\u00E1ximo de ", resource.name, resource.suggestedMaxFormula ? ` (${resource.suggestedMaxFormula})` : ""] }), _jsx("input", { type: "number", min: 0, max: 9999, value: presetResourceMaximums[resource.key] ?? 0, onChange: (event) => setPresetResourceMaximums((current) => ({ ...current, [resource.key]: Number(event.target.value) })) })] }, resource.key))), _jsxs("div", { className: "card-actions", children: [_jsx("button", { type: "button", disabled: !selectedPreset, onClick: () => selectedPreset && setArtifactDetails(selectedPreset), children: "Ver detalles" }), _jsx("button", { type: "button", className: "accent-button", disabled: isSaving || !selectedPreset, onClick: () => void handleClonePreset(), children: "A\u00F1adir predefinido" })] })] })) : _jsx("p", { className: "section-help", children: "No hay artefactos predefinidos disponibles." })] }), _jsxs("section", { className: "campaign-artifact-add-modal__section", children: [_jsx("h4", { children: "Artefacto personalizado" }), _jsx("p", { className: "section-help", children: "Define desde cero su descripci\u00F3n, v\u00EDnculo, recursos y capacidades." }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                        setArtifactError(null);
                                        setIsArtifactAddModalOpen(false);
                                        setArtifactEditor({ id: null, definition: structuredClone(EMPTY_ARTIFACT_DEFINITION) });
                                    }, children: "Crear personalizado" })] })] }) })) : null, artifactEditor ? (_jsx("section", { className: "modal-backdrop", onClick: () => !isSaving && setArtifactEditor(null), children: _jsx(MysticArtifactEditorWizard, { title: artifactEditor.id ? "Editar artefacto" : "Crear artefacto personalizado", initialValue: artifactEditor.definition, busy: isSaving, externalError: artifactError, onCancel: () => {
                        setArtifactError(null);
                        setArtifactEditor(null);
                    }, onSave: handleSaveArtifactEditor }) })) : null, artifactDetails ? (_jsx(MysticArtifactDetailsModal, { artifact: artifactDetails, busy: isSaving, onClose: () => setArtifactDetails(null), onOpenSource: handleOpenArtifactSource })) : null, isDirector && selectedDmNote && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setDmNoteError(null);
                        setSelectedDmNoteId(null);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel campaign-shared-notes-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: selectedDmNote.title }), _jsxs("p", { className: "section-help", children: ["Nota privada del DJ", selectedDmNote.updatedAt || selectedDmNote.createdAt ? ` · Actualizada ${formatDate(selectedDmNote.updatedAt || selectedDmNote.createdAt)}` : ""] })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setDmNoteError(null);
                                                setDmNoteEditor({ mode: "edit", note: buildDmNoteDraft(selectedDmNote) });
                                            }, children: "Editar" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setDmNoteError(null);
                                                setSelectedDmNoteId(null);
                                            }, children: "Cerrar" })] })] }), selectedDmNoteReferenceHighlights.length > 0 ? (_jsx("div", { className: "compendium-tags", children: selectedDmNoteReferenceHighlights.map((reference) => (_jsx("button", { type: "button", className: "compendium-chip", onClick: () => openReferenceDetail(reference.id), children: reference.name }, reference.id))) })) : null, _jsx("div", { className: "campaign-markdown", children: renderMarkdownBlocks(selectedDmNote.content || "Sin contenido detallado.", selectedDmNoteReferenceHighlights, openReferenceDetail) })] }) })) : null, isDirector && dmNoteEditor && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setDmNoteEditor(null);
                        setDmNoteError(null);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel campaign-shared-notes-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: dmNoteEditor.mode === "create" ? "Nueva nota privada" : "Editar nota privada" }), _jsx("p", { className: "section-help", children: "La nota acepta Markdown y solo sera visible para el director de juego." })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveDmNote(), children: isSaving ? "Guardando..." : "Guardar" }), dmNoteEditor.mode === "edit" ? (_jsx("button", { type: "button", className: "danger-button", disabled: isSaving, onClick: () => void handleDeleteDmNote(dmNoteEditor.note.id), children: "Eliminar" })) : null, _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setDmNoteEditor(null);
                                                setDmNoteError(null);
                                            }, children: "Cerrar" })] })] }), dmNoteError ? _jsx("p", { className: "error-text", children: dmNoteError }) : null, _jsx("div", { className: "form-grid", children: _jsxs("label", { className: "field", children: [_jsx("span", { children: "Titulo" }), _jsx("input", { value: dmNoteEditor.note.title, onChange: (event) => setDmNoteEditor((current) => current ? {
                                            ...current,
                                            note: { ...current.note, title: event.target.value }
                                        } : null) })] }) }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Contenido" }), _jsx("textarea", { rows: 16, value: dmNoteEditor.note.content, onChange: (event) => setDmNoteEditor((current) => current ? {
                                        ...current,
                                        note: { ...current.note, content: event.target.value }
                                    } : null), placeholder: "Secretos, pistas, planes de sesion y recordatorios privados..." })] })] }) })) : null, selectedSharedNote && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
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
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Confirmar desvinculacion" }), _jsxs("p", { className: "section-help", children: ["Vas a desvincular a ", pendingUnlinkCharacter.name, " de esta campa\u00F1a. Su ficha no se borra, pero dejara de aparecer aqui."] })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                        setPendingUnlinkCharacter(null);
                                    }, children: "Cerrar" })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsx("div", { className: "toolbar", children: _jsx("button", { type: "button", className: "danger-button", disabled: isSaving, onClick: () => void handleUnlinkCharacter(pendingUnlinkCharacter.id), children: isSaving ? "Desvinculando..." : "Confirmar desvinculacion" }) })] }) })) : null, isDirector && experienceGrantDraft ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setExperienceGrantDraft(null);
                        setExperienceGrantError(null);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Conceder experiencia" }), _jsxs("p", { className: "section-help", children: ["Los PX se sumaran al total actual de ", experienceGrantDraft.characterName, " y quedaran registrados en el historial."] })] }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                        setExperienceGrantDraft(null);
                                        setExperienceGrantError(null);
                                    }, children: "Cerrar" })] }), experienceGrantError ? _jsx("p", { className: "error-text", children: experienceGrantError }) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Cantidad de PX" }), _jsx("input", { type: "number", min: 1, max: 1000, step: 1, value: experienceGrantDraft.amount, onChange: (event) => setExperienceGrantDraft((current) => current ? { ...current, amount: event.target.value } : null), autoFocus: true })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Motivo" }), _jsx("input", { maxLength: 300, value: experienceGrantDraft.reason, onChange: (event) => setExperienceGrantDraft((current) => current ? { ...current, reason: event.target.value } : null) })] })] }), _jsx("div", { className: "toolbar", children: _jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleGrantExperience(), children: isSaving ? "Concediendo..." : "Confirmar concesion" }) })] }) })) : null, campaignSheetModalEntry ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    setSelectedSheetId(null);
                }, children: _jsxs("div", { className: "panel modal-panel campaign-character-sheet-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions campaign-character-sheet-modal-header", children: [_jsxs("div", { children: [_jsx("h3", { children: campaignSheetModalEntry.name }), _jsxs("p", { className: "section-help", children: [campaignSheetModalEntry.ownerEmail, " | Hoja vinculada a campa\u00F1a"] })] }), _jsx("button", { type: "button", onClick: () => setSelectedSheetId(null), children: "Cerrar" })] }), _jsx("div", { className: "campaign-character-sheet-modal-body", children: campaignCharacterView === "builder" && campaignBuilderCharacter ? (_jsx(CharacterBuilderView, { character: campaignBuilderCharacter, busy: isSaving, backLabel: "Cerrar", sheetLabel: "Abrir hoja", saveLabel: "Guardar cambios", professionRemovalLabel: "Revocar profesi\u00F3n", onBackToCharacters: () => setSelectedSheetId(null), onOpenSheet: () => setCampaignCharacterView("sheet"), onSave: (sheet) => handleSaveCampaignCharacter(campaignSheetModalEntry, sheet, "builder"), onBindMysticArtifact: async (artifactId, paymentType) => {
                                    const token = await ensureAccessToken();
                                    await bindMysticArtifact(artifactId, { paymentType }, token);
                                    await refresh();
                                }, onLeaveProfession: async (professionId) => {
                                    const token = await ensureAccessToken();
                                    await leaveProfession(campaignSheetModalEntry.characterId, professionId, token);
                                    await refresh();
                                } })) : (_jsx(UnifiedCharacterSheet, { title: campaignSheetModalEntry.name, subtitle: `${campaignSheetModalEntry.ownerEmail} | Hoja vinculada a campaña`, sheet: campaignSheetModalEntry.sheet, professionMemberships: campaignSheetModalEntry.professionMemberships, enforceProfessionRestrictions: true, editable: true, busy: isSaving, onOpenBuilder: () => setCampaignCharacterView("builder"), onSave: (sheet) => handleSaveCampaignCharacter(campaignSheetModalEntry, sheet, "sheet"), onUseArtifactAbility: async (artifactId, abilityId) => {
                                    const token = await ensureAccessToken();
                                    await useMysticArtifactAbility(artifactId, abilityId, token);
                                    await refresh();
                                } })) })] }) })) : null, changeLogCharacterId ? (() => {
                const entry = selectedCampaign?.characters.find((character) => character.characterId === changeLogCharacterId);
                const canViewChangeLog = Boolean(entry && selectedCampaign && (entry.ownerId === user.id ||
                    user.role === "superadmin" ||
                    selectedCampaign.gmId === user.id));
                return entry && canViewChangeLog ? (_jsx(CharacterChangeLogModal, { characterId: entry.characterId, characterName: entry.name, ensureAccessToken: ensureAccessToken, onClose: () => setChangeLogCharacterId(null), onRead: refresh })) : null;
            })() : null, experienceHistoryCharacter ? (_jsx("section", { className: "modal-backdrop", onClick: () => setExperienceHistoryCharacterId(null), children: _jsxs("div", { className: "panel modal-panel campaign-experience-history-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "campaign-experience-history-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "row-actions", children: [_jsxs("div", { children: [_jsxs("h2", { id: "campaign-experience-history-title", children: ["Historial de PX de ", experienceHistoryCharacter.name] }), _jsxs("p", { className: "section-help", children: ["Total: ", experienceHistoryCharacter.experienceTotal, " \u00B7 Gastada: ", experienceHistoryCharacter.experienceSpent, " \u00B7 Disponible: ", Math.max(0, experienceHistoryCharacter.experienceTotal - experienceHistoryCharacter.experienceSpent)] })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setExperienceHistoryCharacterId(null), children: "Cerrar" })] }), _jsx("div", { className: "campaign-experience-history-body", children: selectedExperienceHistory.length > 0 ? (_jsx("div", { className: "campaign-character-experience-list", children: selectedExperienceHistory.map((logEntry) => (_jsxs("article", { className: "campaign-character-experience-entry", children: [_jsxs("strong", { children: ["+", logEntry.amount, " PX"] }), _jsx("span", { children: logEntry.reason }), _jsxs("span", { children: [formatDate(logEntry.createdAt), " \u00B7 ", logEntry.grantedByEmail] })] }, logEntry.id))) })) : _jsx("p", { className: "section-help", children: "Todav\u00EDa no hay experiencia concedida a este personaje." }) })] }) })) : null, isDirector && isProfessionRequestsModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => setIsProfessionRequestsModalOpen(false), children: _jsxs("div", { className: "panel modal-panel profession-request-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Solicitudes de profesiones" }), _jsx("p", { className: "section-help", children: "Los requisitos se comprobar\u00E1n de nuevo al aprobar." })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setIsProfessionRequestsModalOpen(false), children: "Cerrar" })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsxs("div", { className: "profession-request-list", children: [(selectedCampaign?.pendingProfessionRequests ?? []).map((request) => (_jsxs("article", { className: "profession-request-card", children: [_jsxs("div", { children: [_jsx("strong", { children: request.professionName }), _jsxs("span", { children: [request.characterName, " \u00B7 ", request.ownerEmail] }), _jsxs("small", { children: ["Solicitada: ", request.requestedAt ? formatDate(request.requestedAt) : "Sin fecha"] })] }), _jsx("div", { className: "profession-requirement-list", children: request.eligibility.requirementResults.map((requirement) => (_jsxs("span", { className: requirement.met ? "is-met" : "is-pending", children: [requirement.met ? "✓" : "○", " ", requirement.label, requirement.hasMaster ? " · Maestro" : ""] }, requirement.id))) }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: isSaving, onClick: () => void handleProfessionDecision(request.id, "reject"), children: "Rechazar" }), _jsx("button", { type: "button", disabled: isSaving || !request.eligibility.eligible, onClick: () => void handleProfessionDecision(request.id, "approve"), children: "Aprobar" })] })] }, request.id))), (selectedCampaign?.pendingProfessionRequests?.length ?? 0) === 0 ? _jsx("p", { className: "section-help", children: "No hay solicitudes pendientes." }) : null] })] }) })) : null, isDirector && isBurdenSummaryModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    setIsBurdenSummaryModalOpen(false);
                }, children: _jsxs("div", { className: "panel modal-panel campaign-character-sheet-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions campaign-character-sheet-modal-header", children: [_jsxs("div", { children: [_jsx("h3", { children: "Resumen de cargas" }), _jsx("p", { className: "section-help", children: "Vista rapida para el DJ con las cargas activas de los personajes vinculados y su explicacion." })] }), _jsxs("div", { className: "toolbar", children: [_jsxs("span", { className: "meta-text", children: [campaignBurdenDigest.length, " registradas"] }), _jsx("button", { type: "button", onClick: () => setIsBurdenSummaryModalOpen(false), children: "Cerrar" })] })] }), _jsx("div", { className: "campaign-character-sheet-modal-body", children: _jsxs("div", { className: "cards", children: [campaignBurdenDigest.map((burden) => (_jsxs("article", { className: "campaign-structured-card app-card-accent app-card-accent--carga", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("strong", { children: burden.burdenName }), _jsxs("p", { className: "section-help", children: [burden.characterName, " \u00B7 ", burden.ownerEmail] })] }), _jsx("span", { className: "compendium-chip", children: "Carga" })] }), _jsx("p", { children: burden.summary }), _jsx("p", { className: "section-help", children: burden.detail }), _jsx("span", { className: "meta-text", children: burden.source })] }, burden.id))), campaignBurdenDigest.length === 0 ? (_jsx("p", { className: "section-help", children: "No hay cargas registradas en los personajes vinculados." })) : null] }) })] }) })) : null, isCreateCampaignModalOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setFormError(null);
                        setIsCreateCampaignModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Nueva campa\u00F1a" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleCreateCampaign(), children: "Crear" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                                                setFormError(null);
                                                setIsCreateCampaignModalOpen(false);
                                            }, children: "Cerrar" })] })] }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: campaignForm.name, onChange: (event) => setCampaignForm((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ambientacion" }), _jsx("input", { value: campaignForm.setting, onChange: (event) => setCampaignForm((current) => ({ ...current, setting: event.target.value })) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen" }), _jsx("textarea", { rows: 3, value: campaignForm.summary, onChange: (event) => setCampaignForm((current) => ({ ...current, summary: event.target.value })) })] })] }) })) : null, isDirector && isCampaignDetailsModalOpen && selectedCampaign ? (_jsx("section", { className: "modal-backdrop", onClick: () => {
                    if (!isSaving) {
                        setFormError(null);
                        setIsCampaignDetailsModalOpen(false);
                    }
                }, children: _jsxs("div", { className: "panel modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Detalles de campa\u00F1a" }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleSaveCampaignDetails(), children: "Guardar" }), _jsx("button", { type: "button", disabled: isSaving, onClick: () => {
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
                                                                })) }), _jsx("span", { children: member.email })] }, member.id))) })] })) : null] })) : (_jsx("p", { className: "section-help", children: "Tu entrada sigue siendo visible para toda la campa\u00F1a." }))] })) : (_jsxs("article", { className: "campaign-reference-detail-card", children: [_jsxs("div", { className: "campaign-reference-detail-header", children: [_jsxs("div", { children: [_jsx("p", { className: "campaign-reference-detail-kicker", children: "Entrada de wiki" }), _jsx("h4", { children: selectedReference.name })] }), _jsxs("div", { className: "campaign-reference-detail-meta", children: [_jsx("span", { className: "compendium-chip", children: selectedReference.label }), _jsx("span", { className: "compendium-chip", children: describeReferenceVisibility(selectedReference) })] })] }), _jsxs("div", { className: "campaign-reference-detail-grid", children: [_jsxs("article", { className: "campaign-reference-preview", children: [_jsx("span", { className: "meta-text", children: "Resumen" }), _jsx("p", { children: selectedReference.summary || "Sin resumen breve." })] }), _jsxs("article", { className: "campaign-reference-preview campaign-reference-preview--author", children: [_jsx("span", { className: "meta-text", children: "Autor" }), _jsx("p", { children: selectedReference.authorEmail })] })] }), selectedReference.aliases.length > 0 ? (_jsxs("article", { className: "campaign-reference-preview", children: [_jsx("span", { className: "meta-text", children: "Alias" }), _jsx("div", { className: "compendium-tags", children: selectedReference.aliases.map((alias) => (_jsx("span", { className: "compendium-chip", children: alias }, `${selectedReference.id}-${alias}`))) })] })) : null, _jsxs("article", { className: "campaign-reference-preview campaign-reference-preview--content", children: [_jsx("span", { className: "meta-text", children: "Contenido" }), _jsx("div", { className: "campaign-markdown", children: renderMarkdownBlocks(selectedReference.content || "Sin contenido detallado.", selectedCampaign?.references ?? [selectedReference], openReferenceDetail) })] })] }))] }) })) : null, focusedInvitation ? (_jsx("section", { className: "modal-backdrop", "aria-label": "Invitaci\u00F3n de campa\u00F1a", children: _jsxs("div", { className: "panel modal-panel campaign-invitation-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "campaign-invitation-modal-title", children: [_jsx("p", { className: "campaign-reference-detail-kicker", children: "Invitaci\u00F3n de campa\u00F1a" }), _jsx("h2", { id: "campaign-invitation-modal-title", children: focusedInvitation.campaignName }), _jsxs("p", { children: [_jsx("strong", { children: focusedInvitation.gmEmail }), " te invita a participar como jugador."] }), _jsx("p", { className: "section-help", children: "La campa\u00F1a solo aparecer\u00E1 entre tus campa\u00F1as despu\u00E9s de que aceptes." }), formError ? _jsx("p", { className: "error-text", children: formError }) : null, _jsxs("div", { className: "toolbar campaign-invitation-actions", children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => void handleAcceptInvitation(focusedInvitation.id), children: isSaving ? "Aceptando..." : "Aceptar invitación" }), _jsx("button", { type: "button", className: "subtle-button", disabled: isSaving, onClick: () => void handleDismissInvitation(focusedInvitation.id), children: "Rechazar" }), _jsx("button", { type: "button", className: "subtle-button", disabled: isSaving, onClick: () => setFocusedInvitationId(null), children: "Decidir m\u00E1s tarde" })] })] }) })) : null] }));
}
