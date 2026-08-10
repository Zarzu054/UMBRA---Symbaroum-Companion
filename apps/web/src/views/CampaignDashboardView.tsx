import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createCampaignReferenceSchema,
  createCampaignSchema,
  type AuthUser,
  type Campaign,
  type CampaignReference,
  type CreateCampaignReferenceInput,
  type CreateCampaignInput,
  type MysticArtifact,
  type MysticArtifactDefinitionInput
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
  grantCampaignExperience,
  updateCampaign,
  updateCampaignReference
} from "../services/campaignService";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
import { MysticArtifactEditorWizard } from "../components/MysticArtifactEditorWizard";
import { MysticArtifactDetailsModal } from "../components/MysticArtifactDetailsModal";
import {
  assignMysticArtifactOwner,
  bindNpcMysticArtifact,
  createCampaignMysticArtifact,
  deleteCampaignMysticArtifact,
  fetchMysticArtifactPresets,
  fetchMysticArtifactSource,
  unbindMysticArtifact,
  updateCampaignMysticArtifact,
  updateMysticArtifactResource,
  useMysticArtifactAbility
} from "../services/mysticArtifactService";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ALL_ENTRIES } from "../models/compendiumEntries";
import { buildPdfViewerUrl } from "../services/pdfViewer";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
};

type CampaignHashState = {
  campaignId: string | null;
  sheetId: string | null;
  section: CampaignSection | null;
};

type CampaignSection = "dmNotes" | "sharedNotes" | "wiki" | "members" | "characters" | "artifacts";
type CampaignSharedNoteEntry = Campaign["sharedNoteEntries"][number];
type CampaignDmNoteEntry = Campaign["dmNoteEntries"][number];
type SharedNoteSortOption = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";
type ExperienceGrantDraft = {
  characterId: string;
  characterName: string;
  amount: string;
  reason: string;
};

const emptyCampaignForm: CreateCampaignInput = {
  name: "",
  summary: "",
  setting: "",
  notes: "",
  dmNoteEntries: [],
  sharedNotes: "",
  sharedNoteEntries: []
};

const emptyReferenceForm: CreateCampaignReferenceInput = {
  name: "",
  label: "",
  aliases: [],
  summary: "",
  content: "",
  visibility: "campaign",
  sharedWithUserIds: []
};

const EMPTY_ARTIFACT_DEFINITION: MysticArtifactDefinitionInput = {
  name: "Nuevo artefacto",
  description: "",
  kind: "object",
  sourceTitle: "Creación de campaña",
  bindingCosts: [{ paymentType: "xp", amount: 1 }],
  abilities: [],
  resources: []
};

function editableArtifactDefinition(artifact: MysticArtifact): MysticArtifactDefinitionInput {
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

function describeReferenceValidationError(error: unknown): string {
  const issues = typeof error === "object" && error !== null && "issues" in error && Array.isArray((error as { issues?: unknown }).issues)
    ? (error as { issues: Array<{ path?: unknown[] }> }).issues
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

function buildTimestampedNoteId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSharedNoteSortPreferenceKey(userId: string): string {
  return `umbra:campaign-shared-notes-sort:${userId}`;
}

function readSharedNoteSortPreference(userId: string): SharedNoteSortOption {
  if (typeof window === "undefined") {
    return "updated_desc";
  }

  const storedValue = window.localStorage.getItem(getSharedNoteSortPreferenceKey(userId));
  if (
    storedValue === "updated_desc" ||
    storedValue === "updated_asc" ||
    storedValue === "title_asc" ||
    storedValue === "title_desc"
  ) {
    return storedValue;
  }

  return "updated_desc";
}

function sortSharedNoteEntries(entries: CampaignSharedNoteEntry[], sortOption: SharedNoteSortOption): CampaignSharedNoteEntry[] {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLookupValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getReferenceTerms(reference: CampaignReference): string[] {
  return [reference.name, ...reference.aliases]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
}

function referenceMatchesText(reference: CampaignReference, text: string): boolean {
  if (!text.trim()) {
    return false;
  }

  const normalizedText = normalizeLookupValue(text);
  return getReferenceTerms(reference).some((term) => {
    const escaped = escapeRegExp(normalizeLookupValue(term));
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(normalizedText);
  });
}

function findReferenceForTerm(term: string, references: CampaignReference[]): CampaignReference | null {
  return references.find((reference) =>
    getReferenceTerms(reference).some((candidate) => candidate.localeCompare(term, undefined, { sensitivity: "base" }) === 0)
  ) ?? null;
}

function renderHighlightedText(
  text: string,
  references: CampaignReference[],
  onOpenReference: (referenceId: string) => void,
  keyPrefix = "highlight"
): ReactNode[] | string {
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
  return text.split(matcher).map((part, index) =>
    terms.some((term) => part.localeCompare(term, undefined, { sensitivity: "base" }) === 0)
      ? (() => {
          const reference = findReferenceForTerm(part, references);
          if (!reference) {
            return <mark key={`${keyPrefix}-${part}-${index}`} className="compendium-highlight">{part}</mark>;
          }

          return (
            <button
              key={`${keyPrefix}-${part}-${index}`}
              type="button"
              className="compendium-highlight compendium-highlight-button"
              onClick={() => onOpenReference(reference.id)}
            >
              {part}
            </button>
          );
        })()
      : part
  );
}

function renderMarkdownInline(
  text: string,
  references: CampaignReference[],
  onOpenReference: (referenceId: string) => void,
  keyPrefix: string
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const [fullMatch, , linkLabel, linkUrl, inlineCode, boldText, italicText] = match;
    if (match.index > lastIndex) {
      const textNodes = renderHighlightedText(text.slice(lastIndex, match.index), references, onOpenReference, `${keyPrefix}-text-${lastIndex}`);
      nodes.push(...(Array.isArray(textNodes) ? textNodes : [textNodes]));
    }

    if (linkLabel && linkUrl) {
      nodes.push(
        <a key={`${keyPrefix}-link-${match.index}`} href={linkUrl} target="_blank" rel="noreferrer">
          {linkLabel}
        </a>
      );
    } else if (inlineCode) {
      nodes.push(<code key={`${keyPrefix}-code-${match.index}`}>{inlineCode}</code>);
    } else if (boldText) {
      nodes.push(<strong key={`${keyPrefix}-bold-${match.index}`}>{renderMarkdownInline(boldText, references, onOpenReference, `${keyPrefix}-bold-inner-${match.index}`)}</strong>);
    } else if (italicText) {
      nodes.push(<em key={`${keyPrefix}-italic-${match.index}`}>{renderMarkdownInline(italicText, references, onOpenReference, `${keyPrefix}-italic-inner-${match.index}`)}</em>);
    } else {
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

function renderMarkdownBlocks(
  text: string,
  references: CampaignReference[],
  onOpenReference: (referenceId: string) => void
): ReactNode {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
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
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`code-${codeBlockIndex}`} className="campaign-markdown-code-block">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      codeBlockIndex += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})(?:\s+(.*))?$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2] ?? "";
      const headingNodes = renderMarkdownInline(content, references, onOpenReference, `heading-${index}`);
      if (level === 1) {
        blocks.push(<h3 key={`heading-${index}`}>{headingNodes}</h3>);
      } else if (level === 2) {
        blocks.push(<h4 key={`heading-${index}`}>{headingNodes}</h4>);
      } else if (level === 3) {
        blocks.push(<h5 key={`heading-${index}`}>{headingNodes}</h5>);
      } else {
        blocks.push(<h6 key={`heading-${index}`}>{headingNodes}</h6>);
      }
      index += 1;
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^[-*]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(<li key={`ul-${index}`}>{renderMarkdownInline(itemMatch[1], references, onOpenReference, `ul-${index}`)}</li>);
        index += 1;
      }
      blocks.push(<ul key={`ul-block-${index}`}>{items}</ul>);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) break;
        items.push(<li key={`ol-${index}`}>{renderMarkdownInline(itemMatch[1], references, onOpenReference, `ol-${index}`)}</li>);
        index += 1;
      }
      blocks.push(<ol key={`ol-block-${index}`}>{items}</ol>);
      continue;
    }

    const quoteMatch = line.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^>\s+(.+)$/);
        if (!itemMatch) break;
        quoteLines.push(itemMatch[1]);
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={`quote-line-${index}-${quoteIndex}`}>{renderMarkdownInline(quoteLine, references, onOpenReference, `quote-${index}-${quoteIndex}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    const paragraphLines: string[] = [];
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
    blocks.push(
      <p key={`paragraph-${index}`}>
        {paragraphParts.map((part, partIndex) => (
          <span key={`paragraph-part-${index}-${partIndex}`}>
            {partIndex > 0 ? <br /> : null}
            {renderMarkdownInline(part, references, onOpenReference, `paragraph-${index}-${partIndex}`)}
          </span>
        ))}
      </p>
    );
  }

  return blocks;
}

function describeReferenceVisibility(reference: CampaignReference): string {
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
    rawSection === "characters" ||
    rawSection === "artifacts"
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
  const [referenceCreateError, setReferenceCreateError] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [draft, setDraft] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [referenceForm, setReferenceForm] = useState<CreateCampaignReferenceInput>(emptyReferenceForm);
  const [referenceAliasesText, setReferenceAliasesText] = useState("");
  const [isReferenceCreateModalOpen, setIsReferenceCreateModalOpen] = useState(false);
  const [selectedDmNoteId, setSelectedDmNoteId] = useState<string | null>(null);
  const [dmNoteEditor, setDmNoteEditor] = useState<{ mode: "create" | "edit"; note: CampaignDmNoteEntry } | null>(null);
  const [dmNoteError, setDmNoteError] = useState<string | null>(null);
  const [dmNoteSearch, setDmNoteSearch] = useState("");
  const [dmNoteSort, setDmNoteSort] = useState<SharedNoteSortOption>("updated_desc");
  const [selectedSharedNoteId, setSelectedSharedNoteId] = useState<string | null>(null);
  const [sharedNoteEditor, setSharedNoteEditor] = useState<{ mode: "create" | "edit"; note: CampaignSharedNoteEntry } | null>(null);
  const [sharedNoteError, setSharedNoteError] = useState<string | null>(null);
  const [sharedNoteSearch, setSharedNoteSearch] = useState("");
  const [sharedNoteSort, setSharedNoteSort] = useState<SharedNoteSortOption>(() => readSharedNoteSortPreference(user.id));
  const [isReferenceDetailModalOpen, setIsReferenceDetailModalOpen] = useState(false);
  const [isReferenceEditMode, setIsReferenceEditMode] = useState(false);
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
  const [isBurdenSummaryModalOpen, setIsBurdenSummaryModalOpen] = useState(false);
  const [pendingUnlinkCharacter, setPendingUnlinkCharacter] = useState<Campaign["characters"][number] | null>(null);
  const [experienceGrantDraft, setExperienceGrantDraft] = useState<ExperienceGrantDraft | null>(null);
  const [experienceGrantError, setExperienceGrantError] = useState<string | null>(null);
  const [artifactPresets, setArtifactPresets] = useState<MysticArtifact[]>([]);
  const [artifactSearch, setArtifactSearch] = useState("");
  const [artifactSourceFilter, setArtifactSourceFilter] = useState("");
  const [isArtifactAddModalOpen, setIsArtifactAddModalOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetResourceMaximums, setPresetResourceMaximums] = useState<Record<string, number>>({});
  const [artifactEditor, setArtifactEditor] = useState<{ id: string | null; definition: MysticArtifactDefinitionInput } | null>(null);
  const [artifactDetails, setArtifactDetails] = useState<MysticArtifact | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );
  const experienceLogByCharacterId = useMemo(() => {
    const groupedEntries = new Map<string, Campaign["experienceLog"]>();
    for (const entry of selectedCampaign?.experienceLog ?? []) {
      const characterEntries = groupedEntries.get(entry.characterId) ?? [];
      characterEntries.push(entry);
      groupedEntries.set(entry.characterId, characterEntries);
    }
    return groupedEntries;
  }, [selectedCampaign]);
  const selectedSheetEntry = useMemo(
    () => selectedCampaign?.characters.find((entry) => entry.id === selectedSheetId) ?? null,
    [selectedCampaign, selectedSheetId]
  );
  const selectedReference = useMemo(
    () => selectedCampaign?.references.find((entry) => entry.id === selectedReferenceId) ?? null,
    [selectedCampaign, selectedReferenceId]
  );
  const allSortedDmNotes = useMemo(
    () => sortSharedNoteEntries(selectedCampaign?.dmNoteEntries ?? [], dmNoteSort),
    [dmNoteSort, selectedCampaign]
  );
  const sortedDmNotes = useMemo(() => {
    const normalizedSearch = normalizeLookupValue(dmNoteSearch);
    return allSortedDmNotes.filter((entry) =>
      !normalizedSearch || normalizeLookupValue(entry.title).includes(normalizedSearch)
    );
  }, [allSortedDmNotes, dmNoteSearch]);
  const selectedDmNote = useMemo(
    () => allSortedDmNotes.find((entry) => entry.id === selectedDmNoteId) ?? null,
    [allSortedDmNotes, selectedDmNoteId]
  );
  const allSortedSharedNotes = useMemo(
    () => sortSharedNoteEntries(selectedCampaign?.sharedNoteEntries ?? [], sharedNoteSort),
    [selectedCampaign, sharedNoteSort]
  );
  const filteredSharedNotes = useMemo(() => {
    const normalizedSearch = normalizeLookupValue(sharedNoteSearch);
    return allSortedSharedNotes.filter((entry) =>
      !normalizedSearch || normalizeLookupValue(entry.title).includes(normalizedSearch)
    );
  }, [allSortedSharedNotes, sharedNoteSearch]);
  const sortedSharedNotes = filteredSharedNotes;
  const selectedSharedNote = useMemo(
    () => allSortedSharedNotes.find((entry) => entry.id === selectedSharedNoteId) ?? null,
    [allSortedSharedNotes, selectedSharedNoteId]
  );
  const canEditSelectedReference = isDirector || selectedReference?.authorId === user.id;
  const shareableMembers = useMemo(
    () => (selectedCampaign?.members ?? []).filter((member) => member.role === "player"),
    [selectedCampaign]
  );
  const linkableCharacters = useMemo(
    () =>
      (selectedCampaign?.availableCharacters ?? []).filter(
        (entry) => !entry.linked && (isDirector || entry.ownerId === user.id)
      ),
    [isDirector, selectedCampaign, user.id]
  );
  const artifactSources = useMemo(
    () => Array.from(new Set((selectedCampaign?.mysticArtifacts ?? []).map((artifact) => artifact.sourceTitle).filter(Boolean))).sort(),
    [selectedCampaign]
  );
  const visibleCampaignArtifacts = useMemo(() => {
    const query = normalizeLookupValue(artifactSearch);
    return (selectedCampaign?.mysticArtifacts ?? []).filter((artifact) =>
      (!query || normalizeLookupValue(`${artifact.name} ${artifact.description} ${artifact.ownerName ?? ""}`).includes(query)) &&
      (!artifactSourceFilter || artifact.sourceTitle === artifactSourceFilter)
    );
  }, [artifactSearch, artifactSourceFilter, selectedCampaign]);
  const selectedPreset = useMemo(
    () => artifactPresets.find((artifact) => artifact.id === selectedPresetId) ?? null,
    [artifactPresets, selectedPresetId]
  );
  const selectedSharedNoteReferenceHighlights = useMemo(
    () => selectedSharedNote ? (selectedCampaign?.references ?? []).filter((reference) => referenceMatchesText(reference, selectedSharedNote.content)) : [],
    [selectedCampaign, selectedSharedNote]
  );
  const selectedDmNoteReferenceHighlights = useMemo(
    () => selectedDmNote ? (selectedCampaign?.references ?? []).filter((reference) => referenceMatchesText(reference, selectedDmNote.content)) : [],
    [selectedCampaign, selectedDmNote]
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
    Boolean(selectedDmNoteId) ||
    Boolean(dmNoteEditor) ||
    Boolean(selectedSharedNoteId) ||
    Boolean(sharedNoteEditor) ||
    isReferenceCreateModalOpen ||
    isReferenceDetailModalOpen ||
    isBurdenSummaryModalOpen ||
    Boolean(pendingUnlinkCharacter) ||
    Boolean(experienceGrantDraft) ||
    isArtifactAddModalOpen ||
    Boolean(artifactEditor) ||
    isSheetModalOpen;

  useBodyScrollLock(isAnyModalOpen);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!isDirector) return;
    void (async () => {
      try {
        const token = await ensureAccessToken();
        const presets = await fetchMysticArtifactPresets(token);
        setArtifactPresets(presets);
        setSelectedPresetId((current) => current || presets[0]?.id || "");
      } catch (err) {
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
      return;
    }

    if (selectedSheetId && !selectedCampaign.characters.some((entry) => entry.id === selectedSheetId)) {
      setSelectedSheetId(null);
    }
  }, [activeSection, isLoading, selectedCampaign, selectedCampaignId, selectedSheetId]);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setLoadError(null);
    try {
      const token = await ensureAccessToken();
      setCampaigns(await fetchCampaigns(token));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudieron cargar las campañas");
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
      setFormError(err instanceof Error ? err.message : "No se pudo crear la campaña");
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

  function buildDmNoteDraft(entry?: CampaignDmNoteEntry): CampaignDmNoteEntry {
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

  async function persistDmNotes(nextEntries: CampaignDmNoteEntry[]): Promise<Campaign | null> {
    if (!selectedCampaign) return null;
    const token = await ensureAccessToken();
    const updated = await updateCampaign(selectedCampaign.id, {
      dmNoteEntries: sortSharedNoteEntries(nextEntries, "updated_desc")
    }, token);
    upsertCampaign(updated);
    return updated;
  }

  async function handleSaveDmNote(): Promise<void> {
    if (!selectedCampaign || !dmNoteEditor) return;

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
    } catch (err) {
      setDmNoteError(err instanceof Error ? err.message : "No se pudo guardar la nota privada");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteDmNote(noteId: string): Promise<void> {
    setDmNoteError(null);
    setFormError(null);
    setIsSaving(true);
    try {
      await persistDmNotes(allSortedDmNotes.filter((entry) => entry.id !== noteId));
      if (selectedDmNoteId === noteId) setSelectedDmNoteId(null);
      setDmNoteEditor(null);
    } catch (err) {
      setDmNoteError(err instanceof Error ? err.message : "No se pudo eliminar la nota privada");
    } finally {
      setIsSaving(false);
    }
  }

  function buildSharedNoteDraft(entry?: CampaignSharedNoteEntry): CampaignSharedNoteEntry {
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

  async function persistSharedNotes(nextEntries: CampaignSharedNoteEntry[]): Promise<Campaign | null> {
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

  async function handleSaveSharedNote(): Promise<void> {
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
    } catch (err) {
      setSharedNoteError(err instanceof Error ? err.message : "No se pudo guardar la nota compartida");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSharedNote(noteId: string): Promise<void> {
    setSharedNoteError(null);
    setFormError(null);
    setIsSaving(true);
    try {
      await persistSharedNotes(allSortedSharedNotes.filter((entry) => entry.id !== noteId));
      if (selectedSharedNoteId === noteId) {
        setSelectedSharedNoteId(null);
      }
      setSharedNoteEditor(null);
    } catch (err) {
      setSharedNoteError(err instanceof Error ? err.message : "No se pudo eliminar la nota compartida");
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
      setPendingUnlinkCharacter(null);
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
      const createdReference = updated.references.find(
        (entry) => entry.name === payload.name && entry.label === payload.label && entry.content === payload.content
      );
      setSelectedReferenceId(createdReference?.id ?? null);
      setReferenceCreateError(null);
      setIsReferenceCreateModalOpen(false);
      setIsReferenceDetailModalOpen(Boolean(createdReference));
    } catch (err) {
      setReferenceCreateError(describeReferenceValidationError(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGrantExperience(): Promise<void> {
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
    } catch (err) {
      setExperienceGrantError(err instanceof Error ? err.message : "No se pudo conceder la experiencia.");
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
        label: referenceForm.label.trim(),
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
    setReferenceCreateError(null);
    setSelectedReferenceId(null);
    setReferenceForm(emptyReferenceForm);
    setReferenceAliasesText("");
    setIsReferenceEditMode(false);
    setIsReferenceDetailModalOpen(false);
    setIsReferenceCreateModalOpen(true);
  }

  function openReferenceDetail(referenceId: string): void {
    setFormError(null);
    setReferenceCreateError(null);
    setSelectedReferenceId(referenceId);
    setIsReferenceEditMode(false);
    setIsReferenceCreateModalOpen(false);
    setIsReferenceDetailModalOpen(true);
  }

  async function runArtifactMutation(operation: (token: string) => Promise<unknown>): Promise<boolean> {
    setArtifactError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      await operation(token);
      await refresh();
      return true;
    } catch (err) {
      setArtifactError(err instanceof Error ? err.message : "No se pudo actualizar el artefacto");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClonePreset(): Promise<void> {
    if (!selectedCampaign || !selectedPreset) return;
    const resources = selectedPreset.resources.map((resource) => {
      const maximum = Math.max(0, Math.floor(presetResourceMaximums[resource.key] ?? 0));
      return { key: resource.key, maximum, current: maximum };
    });
    const created = await runArtifactMutation((token) => createCampaignMysticArtifact(selectedCampaign.id, {
      mode: "preset",
      presetId: selectedPreset.id,
      resources
    }, token));
    if (created) setIsArtifactAddModalOpen(false);
  }

  async function handleSaveArtifactEditor(definition: MysticArtifactDefinitionInput): Promise<void> {
    if (!selectedCampaign || !artifactEditor) return;
    setArtifactError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      if (artifactEditor.id) {
        await updateCampaignMysticArtifact(artifactEditor.id, definition, token);
      } else {
        await createCampaignMysticArtifact(selectedCampaign.id, { mode: "custom", artifact: definition }, token);
      }
      await refresh();
      setArtifactEditor(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el artefacto";
      setArtifactError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenArtifactSource(artifact: MysticArtifact): Promise<void> {
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
    } catch (error) {
      opened.close();
      setArtifactError(error instanceof Error ? error.message : "No se pudo abrir la fuente del artefacto");
    }
  }

  async function handleArtifactOwnerChange(artifact: MysticArtifact, value: string): Promise<void> {
    if (value === "none") {
      await runArtifactMutation((token) => assignMysticArtifactOwner(artifact.id, { ownerType: "none" }, token));
      return;
    }
    const [ownerType, ownerId] = value.split(":");
    if ((ownerType !== "character" && ownerType !== "npc") || !ownerId) return;
    await runArtifactMutation((token) => assignMysticArtifactOwner(artifact.id, { ownerType, ownerId }, token));
  }

  async function handleAdjustArtifactResource(artifact: MysticArtifact, resource: MysticArtifact["resources"][number]): Promise<void> {
    const maximumText = window.prompt(`Máximo numérico de ${resource.name}`, String(resource.maximum ?? 0));
    if (maximumText === null) return;
    const currentText = window.prompt(`Valor actual de ${resource.name}`, String(resource.current ?? 0));
    if (currentText === null) return;
    const maximum = Number(maximumText);
    const current = Number(currentText);
    if (!Number.isInteger(maximum) || !Number.isInteger(current) || maximum < 0 || current < 0 || current > maximum) {
      setArtifactError("El medidor necesita enteros y el valor actual no puede superar el máximo.");
      return;
    }
    await runArtifactMutation((token) => updateMysticArtifactResource(artifact.id, resource.id, { maximum, current }, token));
  }

  return (
    <main className="campaign-dashboard">
      {!selectedCampaign ? (
        <section className="panel campaign-list-panel">
          <div className="row-actions">
            <div>
              <h1>Campañas</h1>
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
                  Nueva campaña
                </button>
              ) : null}
              <button type="button" disabled={isLoading} onClick={() => void refresh()}>
                Recargar
              </button>
            </div>
          </div>

          {loadError ? <p className="error-text">{loadError}</p> : null}
          {isLoading ? <p>Cargando campañas...</p> : null}

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
              <p className="section-help">Aun no hay campañas accesibles.</p>
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
                  Volver a campañas
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

            {formError && !selectedDmNoteId && !dmNoteEditor && !selectedSharedNoteId && !sharedNoteEditor && !isCampaignDetailsModalOpen && !isReferenceCreateModalOpen && !isReferenceDetailModalOpen ? (
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
              {isDirector ? (
                <button
                  type="button"
                  className={activeSection === "artifacts" ? "is-active" : ""}
                  onClick={() => setActiveSection("artifacts")}
                >
                  Artefactos
                </button>
              ) : null}
            </div>
          </section>

          {isDirector && activeSection === "dmNotes" ? (
            <section className="panel">
              <div className="row-actions">
                <div>
                  <h3>Notas privadas del DJ</h3>
                  <p className="section-help">Entradas privadas en Markdown, visibles exclusivamente para el director de juego.</p>
                </div>
                <div className="inline-row campaign-inline-form">
                  <label className="field">
                    <span>Buscar por titulo</span>
                    <input
                      value={dmNoteSearch}
                      onChange={(event) => setDmNoteSearch(event.target.value)}
                      placeholder="Nombre de la nota"
                    />
                  </label>
                  <label className="field">
                    <span>Ordenar</span>
                    <select
                      value={dmNoteSort}
                      onChange={(event) => setDmNoteSort(event.target.value as SharedNoteSortOption)}
                    >
                      <option value="updated_desc">Mas recientes</option>
                      <option value="updated_asc">Mas antiguas</option>
                      <option value="title_asc">Titulo A-Z</option>
                      <option value="title_desc">Titulo Z-A</option>
                    </select>
                  </label>
                  <button type="button" disabled={isSaving} onClick={() => {
                    setDmNoteError(null);
                    setDmNoteEditor({ mode: "create", note: buildDmNoteDraft() });
                  }}>
                    Nueva nota
                  </button>
                </div>
              </div>
              <div className="campaign-reference-list">
                {sortedDmNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className="campaign-list-item"
                    onClick={() => {
                      setDmNoteError(null);
                      setSelectedDmNoteId(note.id);
                    }}
                  >
                    <strong>{note.title}</strong>
                    <span>Nota privada del DJ</span>
                    <span>Actualizada: {note.updatedAt || note.createdAt ? formatDate(note.updatedAt || note.createdAt) : "Sin fecha registrada"}</span>
                  </button>
                ))}
                {sortedDmNotes.length === 0 ? (
                  <p className="section-help">
                    {dmNoteSearch.trim()
                      ? "No hay notas privadas que coincidan con ese titulo."
                      : "Aun no hay notas privadas registradas."}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === "sharedNotes" ? (
            <section className="panel">
              <div className="row-actions">
                <div>
                  <h3>Notas compartidas</h3>
                  <p className="section-help">Entradas en Markdown visibles para toda la campaña, con busqueda por titulo y enlaces a la wiki detectados dentro de cada nota.</p>
                </div>
                <div className="inline-row campaign-inline-form">
                  <label className="field">
                    <span>Buscar por titulo</span>
                    <input
                      value={sharedNoteSearch}
                      onChange={(event) => setSharedNoteSearch(event.target.value)}
                      placeholder="Nombre de la nota"
                    />
                  </label>
                  <label className="field">
                    <span>Ordenar</span>
                    <select
                      value={sharedNoteSort}
                      onChange={(event) => setSharedNoteSort(event.target.value as SharedNoteSortOption)}
                    >
                      <option value="updated_desc">Mas recientes</option>
                      <option value="updated_asc">Mas antiguas</option>
                      <option value="title_asc">Titulo A-Z</option>
                      <option value="title_desc">Titulo Z-A</option>
                    </select>
                  </label>
                  <button type="button" disabled={isSaving} onClick={() => {
                    setSharedNoteError(null);
                    setSharedNoteEditor({ mode: "create", note: buildSharedNoteDraft() });
                  }}>
                    Nueva nota
                  </button>
                </div>
              </div>
              <div className="campaign-reference-list">
                {sortedSharedNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className="campaign-list-item"
                    onClick={() => {
                      setSharedNoteError(null);
                      setSelectedSharedNoteId(note.id);
                    }}
                  >
                    <strong>{note.title}</strong>
                    <span>{note.authorEmail ? `Autor: ${note.authorEmail}` : "Nota compartida"}</span>
                    <span>Actualizada: {formatDate(note.updatedAt || note.createdAt)}</span>
                  </button>
                ))}
                {sortedSharedNotes.length === 0 ? (
                  <p className="section-help">
                    {sharedNoteSearch.trim()
                      ? "No hay notas compartidas que coincidan con ese titulo."
                      : "Aun no hay notas compartidas registradas."}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === "wiki" ? (
            <section className="panel">
              <div className="row-actions">
                <div>
                  <h3>Wiki de campaña</h3>
                  <p className="section-help">Jugadores pueden aportar entradas visibles para toda la campaña. El DJ puede mantener entradas privadas o compartirlas con jugadores concretos.</p>
                </div>
                <button type="button" disabled={isSaving} onClick={handlePrepareNewReference}>
                  Nueva referencia
                </button>
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
                    <span>{describeReferenceVisibility(reference)}</span>
                    <span>Autor: {reference.authorEmail}</span>
                  </button>
                ))}
                {selectedCampaign.references.length === 0 ? (
                  <p className="section-help">Aun no hay referencias en esta campaña.</p>
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
                    El director concede la experiencia desde aqui. Los jugadores pueden invertirla desde el constructor de su personaje.
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
                  {isDirector ? (
                    <button
                      type="button"
                      className="subtle-button"
                      onClick={() => setIsBurdenSummaryModalOpen(true)}
                    >
                      Resumen de cargas
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="cards">
                {selectedCampaign.characters.map((entry) => {
                  const canManageLink = isDirector || entry.ownerId === user.id;
                  const characterExperienceLog = experienceLogByCharacterId.get(entry.characterId) ?? [];
                  return (
                    <article key={entry.id} className="card campaign-character-card" aria-label={`Personaje ${entry.name}`}>
                      <strong>{entry.name}</strong>
                      <span>{entry.ownerEmail}</span>
                      <span>PX total: {entry.experienceTotal} | Gastada: {entry.experienceSpent} | Disponible: {Math.max(0, entry.experienceTotal - entry.experienceSpent)}</span>
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
                        {isDirector ? (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              setExperienceGrantError(null);
                              setExperienceGrantDraft({
                                characterId: entry.characterId,
                                characterName: entry.name,
                                amount: "",
                                reason: "Recompensa de campaña"
                              });
                            }}
                          >
                            Conceder PX
                          </button>
                        ) : null}
                        {canManageLink ? (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              setFormError(null);
                              setPendingUnlinkCharacter(entry);
                            }}
                          >
                            Desvincular
                          </button>
                        ) : null}
                      </div>
                      <section className="campaign-character-experience" aria-label={`Historial de experiencia de ${entry.name}`}>
                        <h4>Historial de experiencia</h4>
                        {characterExperienceLog.length > 0 ? (
                          <div className="campaign-character-experience-list">
                            {characterExperienceLog.map((logEntry) => (
                              <article key={logEntry.id} className="campaign-character-experience-entry">
                                <strong>+{logEntry.amount} PX</strong>
                                <span>{logEntry.reason}</span>
                                <span>{formatDate(logEntry.createdAt)} · {logEntry.grantedByEmail}</span>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="section-help">Todavia no hay experiencia concedida a este personaje.</p>
                        )}
                      </section>
                    </article>
                  );
                })}
                {selectedCampaign.characters.length === 0 ? (
                  <p className="section-help">Todavia no hay personajes vinculados.</p>
                ) : null}
              </div>

            </section>
          ) : null}

          {isDirector && activeSection === "artifacts" ? (
            <section className="panel">
              <div className="row-actions">
                <div>
                  <h3>Artefactos místicos</h3>
                  <p className="section-help">Solo se muestran los artefactos que el DJ ha incluido en esta campaña.</p>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setArtifactError(null);
                    setIsArtifactAddModalOpen(true);
                  }}
                >
                  Añadir artefacto
                </button>
              </div>

              {artifactError ? <p className="error-text">{artifactError}</p> : null}

              <div className="inline-row campaign-inline-form">
                <label className="field">
                  <span>Buscar</span>
                  <input value={artifactSearch} onChange={(event) => setArtifactSearch(event.target.value)} placeholder="Nombre, texto o poseedor" />
                </label>
                <label className="field">
                  <span>Libro o aventura</span>
                  <select value={artifactSourceFilter} onChange={(event) => setArtifactSourceFilter(event.target.value)}>
                    <option value="">Todos</option>
                    {artifactSources.map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </label>
              </div>

              <div className="cards">
                {visibleCampaignArtifacts.map((artifact) => {
                  const ownerValue = artifact.ownerType && artifact.ownerId ? `${artifact.ownerType}:${artifact.ownerId}` : "none";
                  return (
                    <article key={artifact.id} className="card">
                      <strong>{artifact.name}</strong>
                      <span>{artifact.kind === "weapon" ? "Arma" : artifact.kind === "armor" ? "Armadura" : "Objeto"} · {artifact.sourceTitle || "Personalizado"}{artifact.sourcePage ? ` p.${artifact.sourcePage}` : ""}</span>
                      <span>{artifact.isBound ? `Vinculado (${artifact.bindingPaymentType === "xp" ? `${artifact.bindingPaymentAmount} PX` : artifact.bindingPaymentType === "permanent_corruption" ? `${artifact.bindingPaymentAmount} Corrupción permanente` : "narrativo"})` : "Sin vínculo"}</span>
                      <label className="field">
                        <span>Poseedor</span>
                        <select value={ownerValue} disabled={isSaving || artifact.isBound} onChange={(event) => void handleArtifactOwnerChange(artifact, event.target.value)}>
                          <option value="none">Sin poseedor</option>
                          {selectedCampaign.characters.map((entry) => <option key={entry.id} value={`character:${entry.id}`}>PJ · {entry.name}</option>)}
                          {selectedCampaign.npcs.map((npc) => <option key={npc.id} value={`npc:${npc.id}`}>PNJ · {npc.name}</option>)}
                        </select>
                      </label>
                      {artifact.resources.map((resource) => (
                        <div key={resource.id} className="inline-row">
                          <span>{resource.name}: {resource.current ?? 0}/{resource.maximum ?? 0}{resource.suggestedMaxFormula ? ` (${resource.suggestedMaxFormula})` : ""}</span>
                          <button type="button" disabled={isSaving || (resource.current ?? 0) <= 0} onClick={() => void runArtifactMutation((token) => updateMysticArtifactResource(artifact.id, resource.id, { maximum: resource.maximum ?? 0, current: Math.max(0, (resource.current ?? 0) - 1) }, token))}>−</button>
                          <button type="button" disabled={isSaving || (resource.current ?? 0) >= (resource.maximum ?? 0)} onClick={() => void runArtifactMutation((token) => updateMysticArtifactResource(artifact.id, resource.id, { maximum: resource.maximum ?? 0, current: Math.min(resource.maximum ?? 0, (resource.current ?? 0) + 1) }, token))}>+</button>
                          <button type="button" disabled={isSaving} onClick={() => void handleAdjustArtifactResource(artifact, resource)}>Ajustar</button>
                        </div>
                      ))}
                      <div className="card-actions">
                        <button type="button" onClick={() => setArtifactDetails(artifact)}>Ver detalles</button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            setArtifactError(null);
                            setArtifactEditor({ id: artifact.id, definition: editableArtifactDefinition(artifact) });
                          }}
                        >
                          Editar artefacto
                        </button>
                        {artifact.ownerType === "npc" && !artifact.isBound ? <button type="button" disabled={isSaving} onClick={() => void runArtifactMutation((token) => bindNpcMysticArtifact(artifact.id, token))}>Vincular PNJ</button> : null}
                        {artifact.isBound ? <button type="button" disabled={isSaving} onClick={() => void runArtifactMutation((token) => unbindMysticArtifact(artifact.id, token))}>Romper vínculo</button> : null}
                        {!artifact.isBound && !artifact.ownerId ? <button type="button" disabled={isSaving} onClick={() => void runArtifactMutation((token) => deleteCampaignMysticArtifact(artifact.id, token))}>Eliminar</button> : null}
                      </div>
                    </article>
                  );
                })}
                {visibleCampaignArtifacts.length === 0 ? (
                  <p className="section-help">
                    {(selectedCampaign.mysticArtifacts ?? []).length === 0
                      ? "Todavía no se han añadido artefactos a esta campaña."
                      : "No hay artefactos que coincidan con los filtros."}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {selectedSheetEntry && false ? (
            <section className="campaign-sheet-shell">
              <UnifiedCharacterSheet
                title={campaignSheetModalEntry?.name ?? ""}
                subtitle={`${selectedSheetEntry?.ownerEmail ?? ""} · Hoja vinculada a campaña`}
                sheet={selectedSheetEntry!.sheet!}
                editable={false}
                busy={isSaving}
                onUseArtifactAbility={async (artifactId, abilityId) => {
                  const token = await ensureAccessToken();
                  await useMysticArtifactAbility(artifactId, abilityId, token);
                  await refresh();
                }}
                onBack={() => {
                  setSelectedSheetId(null);
                  setActiveSection("characters");
                }}
              />
            </section>
          ) : null}
        </section>
      ) : null}

      {isArtifactAddModalOpen ? (
        <section className="modal-backdrop" onClick={() => !isSaving && setIsArtifactAddModalOpen(false)}>
          <div className="panel modal-panel campaign-artifact-add-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <div>
                <h3>Añadir artefacto</h3>
                <p className="section-help">Elige una plantilla predefinida o crea un artefacto personalizado para esta campaña.</p>
              </div>
              <button type="button" className="subtle-button" disabled={isSaving} onClick={() => setIsArtifactAddModalOpen(false)}>Cerrar</button>
            </div>

            {artifactError ? <p className="error-text">{artifactError}</p> : null}

            <section className="campaign-artifact-add-modal__section">
              <h4>Artefacto predefinido</h4>
              {artifactPresets.length > 0 ? (
                <>
                  <label className="field">
                    <span>Seleccionar artefacto</span>
                    <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)}>
                      {artifactPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.name} · {preset.sourceTitle}{preset.sourcePage ? ` p.${preset.sourcePage}` : ""}</option>
                      ))}
                    </select>
                  </label>
                  {selectedPreset?.resources.map((resource) => (
                    <label key={resource.key} className="field">
                      <span>Máximo de {resource.name}{resource.suggestedMaxFormula ? ` (${resource.suggestedMaxFormula})` : ""}</span>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={presetResourceMaximums[resource.key] ?? 0}
                        onChange={(event) => setPresetResourceMaximums((current) => ({ ...current, [resource.key]: Number(event.target.value) }))}
                      />
                    </label>
                  ))}
                  <div className="card-actions">
                    <button type="button" disabled={!selectedPreset} onClick={() => selectedPreset && setArtifactDetails(selectedPreset)}>Ver detalles</button>
                    <button type="button" className="accent-button" disabled={isSaving || !selectedPreset} onClick={() => void handleClonePreset()}>Añadir predefinido</button>
                  </div>
                </>
              ) : <p className="section-help">No hay artefactos predefinidos disponibles.</p>}
            </section>

            <section className="campaign-artifact-add-modal__section">
              <h4>Artefacto personalizado</h4>
              <p className="section-help">Define desde cero su descripción, vínculo, recursos y capacidades.</p>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setArtifactError(null);
                  setIsArtifactAddModalOpen(false);
                  setArtifactEditor({ id: null, definition: structuredClone(EMPTY_ARTIFACT_DEFINITION) });
                }}
              >
                Crear personalizado
              </button>
            </section>
          </div>
        </section>
      ) : null}

      {artifactEditor ? (
        <section className="modal-backdrop" onClick={() => !isSaving && setArtifactEditor(null)}>
          <MysticArtifactEditorWizard
            title={artifactEditor.id ? "Editar artefacto" : "Crear artefacto personalizado"}
            initialValue={artifactEditor.definition}
            busy={isSaving}
            externalError={artifactError}
            onCancel={() => {
              setArtifactError(null);
              setArtifactEditor(null);
            }}
            onSave={handleSaveArtifactEditor}
          />
        </section>
      ) : null}

      {artifactDetails ? (
        <MysticArtifactDetailsModal
          artifact={artifactDetails}
          busy={isSaving}
          onClose={() => setArtifactDetails(null)}
          onOpenSource={handleOpenArtifactSource}
        />
      ) : null}

      {isDirector && selectedDmNote && selectedCampaign ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setDmNoteError(null);
              setSelectedDmNoteId(null);
            }
          }}
        >
          <div className="panel modal-panel campaign-shared-notes-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <div>
                <h3>{selectedDmNote.title}</h3>
                <p className="section-help">Nota privada del DJ{selectedDmNote.updatedAt || selectedDmNote.createdAt ? ` · Actualizada ${formatDate(selectedDmNote.updatedAt || selectedDmNote.createdAt)}` : ""}</p>
              </div>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => {
                  setDmNoteError(null);
                  setDmNoteEditor({ mode: "edit", note: buildDmNoteDraft(selectedDmNote) });
                }}>
                  Editar
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setDmNoteError(null);
                    setSelectedDmNoteId(null);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            {selectedDmNoteReferenceHighlights.length > 0 ? (
              <div className="compendium-tags">
                {selectedDmNoteReferenceHighlights.map((reference) => (
                  <button key={reference.id} type="button" className="compendium-chip" onClick={() => openReferenceDetail(reference.id)}>
                    {reference.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="campaign-markdown">
              {renderMarkdownBlocks(selectedDmNote.content || "Sin contenido detallado.", selectedDmNoteReferenceHighlights, openReferenceDetail)}
            </div>
          </div>
        </section>
      ) : null}

      {isDirector && dmNoteEditor && selectedCampaign ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setDmNoteEditor(null);
              setDmNoteError(null);
            }
          }}
        >
          <div className="panel modal-panel campaign-shared-notes-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <div>
                <h3>{dmNoteEditor.mode === "create" ? "Nueva nota privada" : "Editar nota privada"}</h3>
                <p className="section-help">La nota acepta Markdown y solo sera visible para el director de juego.</p>
              </div>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => void handleSaveDmNote()}>
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
                {dmNoteEditor.mode === "edit" ? (
                  <button type="button" className="danger-button" disabled={isSaving} onClick={() => void handleDeleteDmNote(dmNoteEditor.note.id)}>
                    Eliminar
                  </button>
                ) : null}
                <button type="button" disabled={isSaving} onClick={() => {
                  setDmNoteEditor(null);
                  setDmNoteError(null);
                }}>
                  Cerrar
                </button>
              </div>
            </div>
            {dmNoteError ? <p className="error-text">{dmNoteError}</p> : null}
            <div className="form-grid">
              <label className="field">
                <span>Titulo</span>
                <input
                  value={dmNoteEditor.note.title}
                  onChange={(event) => setDmNoteEditor((current) => current ? {
                    ...current,
                    note: { ...current.note, title: event.target.value }
                  } : null)}
                />
              </label>
            </div>
            <label className="field">
              <span>Contenido</span>
              <textarea
                rows={16}
                value={dmNoteEditor.note.content}
                onChange={(event) => setDmNoteEditor((current) => current ? {
                  ...current,
                  note: { ...current.note, content: event.target.value }
                } : null)}
                placeholder="Secretos, pistas, planes de sesion y recordatorios privados..."
              />
            </label>
          </div>
        </section>
      ) : null}

      {selectedSharedNote && selectedCampaign ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setSharedNoteError(null);
              setSelectedSharedNoteId(null);
            }
          }}
        >
          <div className="panel modal-panel campaign-shared-notes-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <div>
                <h3>{selectedSharedNote.title}</h3>
                <p className="section-help">{selectedSharedNote.authorEmail ? `${selectedSharedNote.authorEmail} · ` : ""}Actualizada {formatDate(selectedSharedNote.updatedAt || selectedSharedNote.createdAt)}</p>
              </div>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => {
                  setSharedNoteError(null);
                  setSharedNoteEditor({ mode: "edit", note: buildSharedNoteDraft(selectedSharedNote) });
                }}>
                  Editar
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setSharedNoteError(null);
                    setSelectedSharedNoteId(null);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            {selectedSharedNoteReferenceHighlights.length > 0 ? (
              <div className="compendium-tags">
                {selectedSharedNoteReferenceHighlights.map((reference) => (
                  <button key={reference.id} type="button" className="compendium-chip" onClick={() => openReferenceDetail(reference.id)}>
                    {reference.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="campaign-markdown">
              {renderMarkdownBlocks(selectedSharedNote.content || "Sin contenido detallado.", selectedSharedNoteReferenceHighlights, openReferenceDetail)}
            </div>
          </div>
        </section>
      ) : null}

      {sharedNoteEditor && selectedCampaign ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setSharedNoteEditor(null);
              setSharedNoteError(null);
            }
          }}
        >
          <div className="panel modal-panel campaign-shared-notes-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <div>
                <h3>{sharedNoteEditor.mode === "create" ? "Nueva nota compartida" : "Editar nota compartida"}</h3>
                <p className="section-help">La nota acepta Markdown y sera visible para los miembros de la campaña.</p>
              </div>
              <div className="toolbar">
                <button type="button" disabled={isSaving} onClick={() => void handleSaveSharedNote()}>
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
                {sharedNoteEditor.mode === "edit" ? (
                  <button type="button" className="danger-button" disabled={isSaving} onClick={() => void handleDeleteSharedNote(sharedNoteEditor.note.id)}>
                    Eliminar
                  </button>
                ) : null}
                <button type="button" disabled={isSaving} onClick={() => {
                  setSharedNoteEditor(null);
                  setSharedNoteError(null);
                }}>
                  Cerrar
                </button>
              </div>
            </div>
            {sharedNoteError ? <p className="error-text">{sharedNoteError}</p> : null}
            <div className="form-grid">
              <label className="field">
                <span>Titulo</span>
                <input
                  value={sharedNoteEditor.note.title}
                  onChange={(event) => setSharedNoteEditor((current) => current ? {
                    ...current,
                    note: { ...current.note, title: event.target.value }
                  } : null)}
                />
              </label>
            </div>
            <label className="field">
              <span>Contenido</span>
              <textarea
                rows={16}
                value={sharedNoteEditor.note.content}
                onChange={(event) => setSharedNoteEditor((current) => current ? {
                  ...current,
                  note: { ...current.note, content: event.target.value }
                } : null)}
                placeholder="Apuntes de sesion, acuerdos del grupo, pistas, recordatorios..."
              />
            </label>
          </div>
        </section>
      ) : null}

      {pendingUnlinkCharacter ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setPendingUnlinkCharacter(null);
            }
          }}
        >
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <div>
                <h3>Confirmar desvinculacion</h3>
                <p className="section-help">
                  Vas a desvincular a {pendingUnlinkCharacter.name} de esta campaña. Su ficha no se borra, pero dejara de aparecer aqui.
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setPendingUnlinkCharacter(null);
                }}
              >
                Cerrar
              </button>
            </div>
            {formError ? <p className="error-text">{formError}</p> : null}
            <div className="toolbar">
              <button
                type="button"
                className="danger-button"
                disabled={isSaving}
                onClick={() => void handleUnlinkCharacter(pendingUnlinkCharacter.id)}
              >
                {isSaving ? "Desvinculando..." : "Confirmar desvinculacion"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {isDirector && experienceGrantDraft ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setExperienceGrantDraft(null);
              setExperienceGrantError(null);
            }
          }}
        >
          <div className="panel modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <div>
                <h3>Conceder experiencia</h3>
                <p className="section-help">
                  Los PX se sumaran al total actual de {experienceGrantDraft.characterName} y quedaran registrados en el historial.
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setExperienceGrantDraft(null);
                  setExperienceGrantError(null);
                }}
              >
                Cerrar
              </button>
            </div>
            {experienceGrantError ? <p className="error-text">{experienceGrantError}</p> : null}
            <div className="form-grid">
              <label className="field">
                <span>Cantidad de PX</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={experienceGrantDraft.amount}
                  onChange={(event) => setExperienceGrantDraft((current) => current ? { ...current, amount: event.target.value } : null)}
                  autoFocus
                />
              </label>
              <label className="field field-span-2">
                <span>Motivo</span>
                <input
                  maxLength={300}
                  value={experienceGrantDraft.reason}
                  onChange={(event) => setExperienceGrantDraft((current) => current ? { ...current, reason: event.target.value } : null)}
                />
              </label>
            </div>
            <div className="toolbar">
              <button type="button" disabled={isSaving} onClick={() => void handleGrantExperience()}>
                {isSaving ? "Concediendo..." : "Confirmar concesion"}
              </button>
            </div>
          </div>
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
                <p className="section-help">{campaignSheetModalEntry.ownerEmail} | Hoja vinculada a campaña</p>
              </div>
              <button type="button" onClick={() => setSelectedSheetId(null)}>
                Cerrar
              </button>
            </div>
            <div className="campaign-character-sheet-modal-body">
              <UnifiedCharacterSheet
                title={campaignSheetModalEntry.name}
                subtitle={`${campaignSheetModalEntry.ownerEmail} | Hoja vinculada a campaña`}
                sheet={campaignSheetModalEntry.sheet!}
                editable={false}
                busy={isSaving}
                onUseArtifactAbility={async (artifactId, abilityId) => {
                  const token = await ensureAccessToken();
                  await useMysticArtifactAbility(artifactId, abilityId, token);
                  await refresh();
                }}
              />
            </div>
          </div>
        </section>
      ) : null}

      {isDirector && isBurdenSummaryModalOpen ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            setIsBurdenSummaryModalOpen(false);
          }}
        >
          <div className="panel modal-panel campaign-character-sheet-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions campaign-character-sheet-modal-header">
              <div>
                <h3>Resumen de cargas</h3>
                <p className="section-help">
                  Vista rapida para el DJ con las cargas activas de los personajes vinculados y su explicacion.
                </p>
              </div>
              <div className="toolbar">
                <span className="meta-text">{campaignBurdenDigest.length} registradas</span>
                <button type="button" onClick={() => setIsBurdenSummaryModalOpen(false)}>
                  Cerrar
                </button>
              </div>
            </div>
            <div className="campaign-character-sheet-modal-body">
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
              <h3>Nueva campaña</h3>
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
              <h3>Detalles de campaña</h3>
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

      {isReferenceCreateModalOpen ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setReferenceCreateError(null);
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
                    setReferenceCreateError(null);
                    setIsReferenceCreateModalOpen(false);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            {referenceCreateError ? <p className="error-text">{referenceCreateError}</p> : null}

            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={referenceForm.name}
                  onChange={(event) => setReferenceForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Categoria (opcional)</span>
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

            {isDirector ? (
              <>
                <label className="field">
                  <span>Visibilidad</span>
                  <select
                    value={referenceForm.visibility}
                    onChange={(event) =>
                      setReferenceForm((current) => ({
                        ...current,
                        visibility: event.target.value as CreateCampaignReferenceInput["visibility"],
                        sharedWithUserIds: event.target.value === "selected_players" ? current.sharedWithUserIds : []
                      }))
                    }
                  >
                    <option value="campaign">Toda la campaña</option>
                    <option value="selected_players">Jugadores concretos</option>
                    <option value="gm_only">Solo DJ</option>
                  </select>
                </label>
                {referenceForm.visibility === "selected_players" ? (
                  <div className="field">
                    <span>Jugadores con acceso</span>
                    <div className="cards">
                      {shareableMembers.map((member) => (
                        <label key={member.id} className="checkbox-field">
                          <input
                            type="checkbox"
                            checked={referenceForm.sharedWithUserIds.includes(member.userId)}
                            onChange={(event) =>
                              setReferenceForm((current) => ({
                                ...current,
                                sharedWithUserIds: event.target.checked
                                  ? [...current.sharedWithUserIds, member.userId]
                                  : current.sharedWithUserIds.filter((entry) => entry !== member.userId)
                              }))
                            }
                          />
                          <span>{member.email}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="section-help">Las entradas creadas por jugadores siempre se comparten con toda la campaña.</p>
            )}
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
                <p className="section-help">{selectedReference.label} · {describeReferenceVisibility(selectedReference)}</p>
              </div>
              <div className="toolbar">
                {canEditSelectedReference && isReferenceEditMode ? (
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
                {canEditSelectedReference && !isReferenceEditMode ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setFormError(null);
                      setIsReferenceEditMode(true);
                    }}
                  >
                    Editar
                  </button>
                ) : null}
                {canEditSelectedReference && isReferenceEditMode ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
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
                    }}
                  >
                    Cancelar
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setFormError(null);
                    setIsReferenceEditMode(false);
                    setIsReferenceDetailModalOpen(false);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
            {formError ? <p className="error-text">{formError}</p> : null}

            {canEditSelectedReference && isReferenceEditMode ? (
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

                {isDirector ? (
                  <>
                    <label className="field">
                      <span>Visibilidad</span>
                      <select
                        value={referenceForm.visibility}
                        onChange={(event) =>
                          setReferenceForm((current) => ({
                            ...current,
                            visibility: event.target.value as CreateCampaignReferenceInput["visibility"],
                            sharedWithUserIds: event.target.value === "selected_players" ? current.sharedWithUserIds : []
                          }))
                        }
                      >
                        <option value="campaign">Toda la campaña</option>
                        <option value="selected_players">Jugadores concretos</option>
                        <option value="gm_only">Solo DJ</option>
                      </select>
                    </label>
                    {referenceForm.visibility === "selected_players" ? (
                      <div className="field">
                        <span>Jugadores con acceso</span>
                        <div className="cards">
                          {shareableMembers.map((member) => (
                            <label key={member.id} className="checkbox-field">
                              <input
                                type="checkbox"
                                checked={referenceForm.sharedWithUserIds.includes(member.userId)}
                                onChange={(event) =>
                                  setReferenceForm((current) => ({
                                    ...current,
                                    sharedWithUserIds: event.target.checked
                                      ? [...current.sharedWithUserIds, member.userId]
                                      : current.sharedWithUserIds.filter((entry) => entry !== member.userId)
                                  }))
                                }
                              />
                              <span>{member.email}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="section-help">Tu entrada sigue siendo visible para toda la campaña.</p>
                )}
              </>
            ) : (
              <article className="campaign-reference-detail-card">
                <div className="campaign-reference-detail-header">
                  <div>
                    <p className="campaign-reference-detail-kicker">Entrada de wiki</p>
                    <h4>{selectedReference.name}</h4>
                  </div>
                  <div className="campaign-reference-detail-meta">
                    <span className="compendium-chip">{selectedReference.label}</span>
                    <span className="compendium-chip">{describeReferenceVisibility(selectedReference)}</span>
                  </div>
                </div>

                <div className="campaign-reference-detail-grid">
                  <article className="campaign-reference-preview">
                    <span className="meta-text">Resumen</span>
                    <p>{selectedReference.summary || "Sin resumen breve."}</p>
                  </article>
                  <article className="campaign-reference-preview campaign-reference-preview--author">
                    <span className="meta-text">Autor</span>
                    <p>{selectedReference.authorEmail}</p>
                  </article>
                </div>

                {selectedReference.aliases.length > 0 ? (
                  <article className="campaign-reference-preview">
                    <span className="meta-text">Alias</span>
                    <div className="compendium-tags">
                      {selectedReference.aliases.map((alias) => (
                        <span key={`${selectedReference.id}-${alias}`} className="compendium-chip">
                          {alias}
                        </span>
                      ))}
                    </div>
                  </article>
                ) : null}

                <article className="campaign-reference-preview campaign-reference-preview--content">
                  <span className="meta-text">Contenido</span>
                  <div className="campaign-markdown">
                    {renderMarkdownBlocks(selectedReference.content || "Sin contenido detallado.", selectedCampaign?.references ?? [selectedReference], openReferenceDetail)}
                  </div>
                </article>
              </article>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}


