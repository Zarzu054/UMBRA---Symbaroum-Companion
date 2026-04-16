import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createCampaignReferenceSchema,
  createCampaignSchema,
  type AuthUser,
  type Campaign,
  type CampaignReference,
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
type CampaignSharedNoteEntry = Campaign["sharedNoteEntries"][number];

const emptyCampaignForm: CreateCampaignInput = {
  name: "",
  summary: "",
  setting: "",
  notes: "",
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

function sortSharedNoteEntries(entries: CampaignSharedNoteEntry[]): CampaignSharedNoteEntry[] {
  return [...entries].sort((left, right) => {
    const leftDate = left.updatedAt || left.createdAt || "";
    const rightDate = right.updatedAt || right.createdAt || "";
    return rightDate.localeCompare(leftDate);
  });
}

function summarizeNoteContent(content: string): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "Sin contenido.";
  }
  return collapsed.length > 180 ? `${collapsed.slice(0, 177)}...` : collapsed;
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
  const [referenceCreateError, setReferenceCreateError] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [draft, setDraft] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedAvailableCharacterId, setSelectedAvailableCharacterId] = useState("");
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [referenceForm, setReferenceForm] = useState<CreateCampaignReferenceInput>(emptyReferenceForm);
  const [referenceAliasesText, setReferenceAliasesText] = useState("");
  const [isReferenceCreateModalOpen, setIsReferenceCreateModalOpen] = useState(false);
  const [selectedSharedNoteId, setSelectedSharedNoteId] = useState<string | null>(null);
  const [sharedNoteEditor, setSharedNoteEditor] = useState<{ mode: "create" | "edit"; note: CampaignSharedNoteEntry } | null>(null);
  const [sharedNoteError, setSharedNoteError] = useState<string | null>(null);
  const [isReferenceDetailModalOpen, setIsReferenceDetailModalOpen] = useState(false);
  const [isReferenceEditMode, setIsReferenceEditMode] = useState(false);
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);
  const [isBurdenSummaryModalOpen, setIsBurdenSummaryModalOpen] = useState(false);
  const [pendingUnlinkCharacter, setPendingUnlinkCharacter] = useState<Campaign["characters"][number] | null>(null);

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
  const sortedSharedNotes = useMemo(
    () => sortSharedNoteEntries(selectedCampaign?.sharedNoteEntries ?? []),
    [selectedCampaign]
  );
  const selectedSharedNote = useMemo(
    () => sortedSharedNotes.find((entry) => entry.id === selectedSharedNoteId) ?? null,
    [selectedSharedNoteId, sortedSharedNotes]
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
  const selectedSharedNoteReferenceHighlights = useMemo(
    () => selectedSharedNote ? (selectedCampaign?.references ?? []).filter((reference) => referenceMatchesText(reference, selectedSharedNote.content)) : [],
    [selectedCampaign, selectedSharedNote]
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
      sharedNoteEntries: sortSharedNoteEntries(nextEntries)
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
        ? [normalized, ...sortedSharedNotes]
        : sortedSharedNotes.map((entry) => entry.id === normalized.id ? normalized : entry);
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
      await persistSharedNotes(sortedSharedNotes.filter((entry) => entry.id !== noteId));
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

            {formError && !selectedSharedNoteId && !sharedNoteEditor && !isCampaignDetailsModalOpen && !isReferenceCreateModalOpen && !isReferenceDetailModalOpen ? (
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
                <div>
                  <h3>Notas compartidas</h3>
                  <p className="section-help">Entradas ordenadas en Markdown, visibles para toda la campaña y con enlaces a la wiki detectados dentro de cada nota.</p>
                </div>
                <button type="button" disabled={isSaving} onClick={() => {
                  setSharedNoteError(null);
                  setSharedNoteEditor({ mode: "create", note: buildSharedNoteDraft() });
                }}>
                  Nueva nota
                </button>
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
                    <span>{summarizeNoteContent(note.content)}</span>
                    <span>{note.authorEmail ? `Autor: ${note.authorEmail}` : "Nota compartida"}</span>
                    <span>Actualizada: {formatDate(note.updatedAt || note.createdAt)}</span>
                  </button>
                ))}
                {sortedSharedNotes.length === 0 ? (
                  <p className="section-help">Aun no hay notas compartidas registradas.</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === "wiki" ? (
            <section className="panel">
              <div className="row-actions">
                <div>
                  <h3>Wiki de campana</h3>
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
                  return (
                    <article key={entry.id} className="card">
                      <strong>{entry.name}</strong>
                      <span>{entry.ownerEmail}</span>
                      <span>PX total: {entry.experienceTotal} | PX gastada: {entry.experienceSpent}</span>
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
                    </article>
                  );
                })}
                {selectedCampaign.characters.length === 0 ? (
                  <p className="section-help">Todavia no hay personajes vinculados.</p>
                ) : null}
              </div>

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
                  Vas a desvincular a {pendingUnlinkCharacter.name} de esta campana. Su ficha no se borra, pero dejara de aparecer aqui.
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
                <p className="section-help">{campaignSheetModalEntry.ownerEmail} | Hoja vinculada a campana</p>
              </div>
              <button type="button" onClick={() => setSelectedSheetId(null)}>
                Cerrar
              </button>
            </div>
            <div className="campaign-character-sheet-modal-body">
              <UnifiedCharacterSheet
                title={campaignSheetModalEntry.name}
                subtitle={`${campaignSheetModalEntry.ownerEmail} | Hoja vinculada a campana`}
                sheet={campaignSheetModalEntry.sheet!}
                editable={false}
                busy={isSaving}
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
                  <article className="campaign-reference-preview">
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
                    {renderMarkdownBlocks(selectedReference.content || "Sin contenido detallado.", [selectedReference], openReferenceDetail)}
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


