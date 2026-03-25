import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  buildRollRequest,
  createCampaignNpcSchema,
  deriveCharacterActions,
  executeCharacterAction,
  createCampaignReferenceSchema,
  createCampaignSchema,
  createCampaignSessionSchema,
  type ActionRollResult,
  type CharacterSheet,
  type CharacterActionDefinition,
  type CharacterActionPhase,
  type RollRequest,
  type RollDestination,
  type AuthUser,
  type Campaign,
  type CampaignReference,
  type CreateCampaignInput,
  type CreateCampaignNpcInput,
  type CreateCampaignReferenceInput,
  type CreateCampaignSessionInput,
  type UpdateCampaignNpcInput,
  type UpdateCampaignReferenceInput,
  type UpdateCampaignSessionInput
} from "@umbra/shared";
import {
  addCampaignMember,
  assignCampaignSessionExperience,
  createCampaign,
  createCampaignNpc,
  createCampaignNpcSheet,
  createCampaignReference,
  createCampaignSession,
  deleteCampaignNpc,
  deleteCampaignReference,
  fetchCampaigns,
  generateCampaignNpc,
  grantCampaignExperience,
  linkCampaignCharacter,
  removeCampaignMember,
  unlinkCampaignCharacter,
  updateCampaign,
  updateCampaignCharacterSheet,
  updateCampaignNpc,
  updateCampaignNpcSheet,
  updateCampaignReference,
  updateCampaignSession
} from "../services/campaignService";
import {
  dispatchRoll20Request,
  type Roll20Visibility
} from "../services/rollTransport";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
};

type CampaignHashState = {
  campaignId: string | null;
  sessionId: string | null;
  sheetKind: "character" | "npc" | null;
  sheetId: string | null;
};

type CampaignSheetTarget =
  | { kind: "character"; linkId: string }
  | { kind: "npc"; npcId: string };

type CampaignDetailSection = "wiki" | "members" | "sessions" | "characters" | "npcs" | "xp" | "sheet";

type PendingRollConfirmation = {
  request: RollRequest;
  action: CharacterActionDefinition;
  phase: CharacterActionPhase;
  runLocalAfterSend: boolean;
  visibility: Roll20Visibility;
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
const emptyReferenceForm: CreateCampaignReferenceInput = {
  name: "",
  label: "",
  aliases: [],
  summary: "",
  content: "",
  isPublic: false
};

const referenceFieldLabels: Record<string, string> = {
  name: "Nombre",
  label: "Etiqueta",
  aliases: "Alias",
  summary: "Resumen corto",
  content: "Contenido"
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

function replaceCampaignHash(campaignId: string | null, sessionId: string | null, sheetTarget: CampaignSheetTarget | null): void {
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
  } else if (sheetTarget?.kind === "npc") {
    params.set("sheetKind", "npc");
    params.set("sheetId", sheetTarget.npcId);
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

function aliasesToInput(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function aliasesToText(value: string[]): string {
  return value.join(", ");
}

type ReferenceValidationIssue = {
  code: string;
  path: Array<string | number>;
  message: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  type?: string;
};

function formatReferenceValidationIssues(issues: ReferenceValidationIssue[]): string[] {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getReferenceTerms(references: CampaignReference[]): Array<{ referenceId: string; term: string }> {
  const seen = new Set<string>();
  const terms: Array<{ referenceId: string; term: string }> = [];

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

function renderLinkedText(
  text: string,
  references: CampaignReference[],
  onOpenReference: (referenceId: string) => void
): ReactNode {
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
  const nodes: ReactNode[] = [];
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
      nodes.push(
        <button
          key={`${referenceId}-${start}`}
          type="button"
          className="campaign-reference-link"
          onClick={() => onOpenReference(referenceId)}
        >
          {match[0]}
        </button>
      );
    } else {
      nodes.push(match[0]);
    }

    lastIndex = end;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>) : text;
}

function renderActionRollGroup(title: string, rolls: ActionRollResult[], keyPrefix: string): ReactNode {
  return (
    <div className="campaign-roll-group" key={keyPrefix}>
      <strong>{title}</strong>
      <div className="campaign-roll-group-lines">
        {rolls.map((roll, index) => (
          <span key={`${keyPrefix}-${index}`}>
            {roll.label}: {roll.formula} = {roll.total}
            {typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "éxito" : "fallo"}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderActionRolls(rolls: ActionRollResult[], keyPrefix: string): ReactNode {
  const attackRolls = rolls.filter((roll) => roll.kind === "attack_check");
  const checkRolls = rolls.filter((roll) => roll.kind === "attribute_check");
  const damageRolls = rolls.filter((roll) => roll.kind === "damage");
  const blocks: ReactNode[] = [];

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

  return rolls.map((roll, index) => (
    <span key={`${keyPrefix}-${index}`}>
      {roll.label}: {roll.formula} = {roll.total}
      {typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "éxito" : "fallo"}` : ""}
    </span>
  ));
}

function getActionPhaseLabel(action: CharacterActionDefinition, phase: CharacterActionPhase): string {
  if (phase === "damage") {
    return "Tirar daño";
  }

  return action.sourceType === "weapon" ? "Tirar ataque" : "Tirar prueba";
}

export function CampaignDashboardView({ user, ensureAccessToken }: Props) {
  const initialHashState = parseCampaignHash();
  const isDirector = user.role === "gm" || user.role === "superadmin";
  const rootRef = useRef<HTMLElement | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialHashState.campaignId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialHashState.sessionId);
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
  const [referenceForm, setReferenceForm] = useState<CreateCampaignReferenceInput>(emptyReferenceForm);
  const [referenceAliasesText, setReferenceAliasesText] = useState("");
  const [referenceValidationErrors, setReferenceValidationErrors] = useState<string[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [isReferenceEditorOpen, setIsReferenceEditorOpen] = useState(false);
  const [isReferenceDetailOpen, setIsReferenceDetailOpen] = useState(false);
  const [selectedSheetTarget, setSelectedSheetTarget] = useState<CampaignSheetTarget | null>(
    initialHashState.sheetKind === "character" && initialHashState.sheetId
      ? { kind: "character", linkId: initialHashState.sheetId }
      : initialHashState.sheetKind === "npc" && initialHashState.sheetId
        ? { kind: "npc", npcId: initialHashState.sheetId }
        : null
  );
  const [activeSection, setActiveSection] = useState<CampaignDetailSection>("wiki");
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [isCampaignDetailsModalOpen, setIsCampaignDetailsModalOpen] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");

    fields.forEach((field) => {
      field.setAttribute("data-bwignore", "true");
      field.setAttribute("data-1p-ignore", "true");
      field.setAttribute("data-lpignore", "true");

      if (!field.getAttribute("autocomplete")) {
        field.setAttribute("autocomplete", "off");
      }
    });
  });

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );
  const selectedSession = useMemo(
    () => selectedCampaign?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedCampaign, selectedSessionId]
  );
  const selectedReference = useMemo(
    () => selectedCampaign?.references.find((reference) => reference.id === selectedReferenceId) ?? null,
    [selectedCampaign, selectedReferenceId]
  );
  const selectedCharacterSheetEntry = useMemo(
    () =>
      selectedSheetTarget?.kind === "character"
        ? (selectedCampaign?.characters.find((entry) => entry.id === selectedSheetTarget.linkId) ?? null)
        : null,
    [selectedCampaign, selectedSheetTarget]
  );
  const selectedNpcSheetEntry = useMemo(
    () =>
      selectedSheetTarget?.kind === "npc"
        ? (selectedCampaign?.npcs.find((entry) => entry.id === selectedSheetTarget.npcId) ?? null)
        : null,
    [selectedCampaign, selectedSheetTarget]
  );
  const availableUnlinkedCharacters = useMemo(
    () => selectedCampaign?.availableCharacters.filter((entry) => !entry.linked) ?? [],
    [selectedCampaign]
  );
  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function syncSelectionFromHash(): void {
      const { campaignId, sessionId, sheetKind, sheetId } = parseCampaignHash();
      setSelectedCampaignId(campaignId);
      setSelectedSessionId(sessionId);
      setSelectedSheetTarget(
        sheetKind === "character" && sheetId
          ? { kind: "character", linkId: sheetId }
          : sheetKind === "npc" && sheetId
            ? { kind: "npc", npcId: sheetId }
            : null
      );
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
    const fallbackCampaignId =
      hashState.campaignId && campaigns.some((campaign) => campaign.id === hashState.campaignId)
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
    const fallbackSessionId =
      hashState.sessionId && selectedCampaign.sessions.some((session) => session.id === hashState.sessionId)
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
        notes: selectedCampaign.notes
      };
      return current.name === next.name &&
        current.summary === next.summary &&
        current.setting === next.setting &&
        current.notes === next.notes
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
    setSelectedReferenceId((current) =>
      current && selectedCampaign.references.some((reference) => reference.id === current)
        ? current
        : (selectedCampaign.references[0]?.id ?? null)
    );
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

  function openReference(referenceId: string): void {
    setSelectedReferenceId(referenceId);
    setActiveSection("wiki");
    setIsReferenceDetailOpen(true);
  }

  function openCreateReferenceEditor(): void {
    setSelectedReferenceId(null);
    setReferenceForm(emptyReferenceForm);
    setReferenceAliasesText("");
    setReferenceValidationErrors([]);
    setIsReferenceDetailOpen(false);
    setIsReferenceEditorOpen(true);
  }

  function openEditReferenceEditor(referenceId: string): void {
    setSelectedReferenceId(referenceId);
    setReferenceValidationErrors([]);
    setIsReferenceDetailOpen(false);
    setIsReferenceEditorOpen(true);
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

  async function handleSaveCharacterSheet(linkId: string, sheet: CharacterSheet): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await updateCampaignCharacterSheet(linkId, { sheet }, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la hoja del personaje");
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

  async function handleCreateNpcSheet(npcId: string): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await createCampaignNpcSheet(npcId, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la hoja del PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveNpcSheet(npcId: string, sheet: CharacterSheet | null): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      upsertCampaign(await updateCampaignNpcSheet(npcId, { sheet }, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la hoja del PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateReference(): Promise<void> {
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
      const createdReferenceId =
        updated.references.find(
          (reference) =>
            reference.name === parsed.name &&
            reference.label === parsed.label &&
            reference.summary === parsed.summary &&
            reference.content === parsed.content
        )?.id ?? updated.references[0]?.id ?? null;
      setSelectedReferenceId(createdReferenceId);
      setIsReferenceEditorOpen(false);
      setIsReferenceDetailOpen(createdReferenceId !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la referencia");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveReference(): Promise<void> {
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
      const parsed = parsedInput.data as UpdateCampaignReferenceInput;
      const updated = await updateCampaignReference(selectedReference.id, parsed, token);
      upsertCampaign(updated);
      setSelectedReferenceId(selectedReference.id);
      setIsReferenceEditorOpen(false);
      setIsReferenceDetailOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la referencia");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteReference(): Promise<void> {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la referencia");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="campaigns-module" ref={rootRef}>
      {!selectedCampaign ? (
      <section className="panel campaign-hero">
        <h2>Gestor de Campañas</h2>
        <p>Centraliza miembros, personajes vinculados, sesiones del DJ, PNJs y reparto de experiencia.</p>
      </section>
      ) : null}

      {error ? (
        <section className="panel error-list">
          <p>{error}</p>
        </section>
      ) : null}

      {!selectedCampaign ? (
        <section className="panel campaign-list-page">
          <div className="row-actions">
            <h3>Campañas</h3>
            <div className="toolbar">
              {isDirector ? (
                <button
                  type="button"
                  onClick={() => {
                    setCampaignForm(emptyCampaignForm);
                    setIsCreateCampaignModalOpen(true);
                  }}
                >
                  Nueva campaña
                </button>
              ) : null}
              <button disabled={isLoading} onClick={() => void refresh()}>
                Recargar
              </button>
            </div>
          </div>

          {isLoading ? <p>Cargando campañas...</p> : null}

          <div className="campaign-list">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                className="campaign-list-item"
                onClick={() => {
                  setSelectedCampaignId(campaign.id);
                  setSelectedSessionId(null);
                  setSelectedSheetTarget(null);
                  setActiveSection("wiki");
                }}
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

        </section>
      ) : (
        <section className="campaign-main">
          <section className="panel">
            <div className="row-actions">
              <div>
                <button
                  className="subtle-button"
                  onClick={() => {
                    replaceCampaignHash(null, null, null);
                    setSelectedCampaignId(null);
                    setSelectedSessionId(null);
                    setSelectedReferenceId(null);
                    setSelectedSheetTarget(null);
                    setActiveSection("wiki");
                  }}
                >
                  Volver a campañas
                </button>
                <h2>{selectedCampaign.name}</h2>
                <p className="meta-text">
                  DJ: <strong>{selectedCampaign.gmEmail}</strong>
                </p>
              </div>
              <div className="campaign-header-actions">
                {isDirector ? (
                  <button type="button" disabled={isSaving} onClick={() => setIsCampaignDetailsModalOpen(true)}>
                    Detalles
                  </button>
                ) : null}
              </div>
            </div>
            <div className="toolbar campaign-section-nav">
              <button type="button" className={activeSection === "wiki" ? "is-active" : ""} onClick={() => setActiveSection("wiki")}>Wiki</button>
              <button type="button" className={activeSection === "members" ? "is-active" : ""} onClick={() => setActiveSection("members")}>Miembros</button>
              <button type="button" className={activeSection === "sessions" ? "is-active" : ""} onClick={() => setActiveSection("sessions")}>Sesiones</button>
              <button type="button" className={activeSection === "characters" ? "is-active" : ""} onClick={() => setActiveSection("characters")}>Personajes</button>
              <button type="button" className={activeSection === "npcs" ? "is-active" : ""} onClick={() => setActiveSection("npcs")}>PNJ</button>
              <button type="button" className={activeSection === "xp" ? "is-active" : ""} onClick={() => setActiveSection("xp")}>PX</button>
              {selectedSheetTarget ? (
                <button type="button" className={activeSection === "sheet" ? "is-active" : ""} onClick={() => setActiveSection("sheet")}>Hoja abierta</button>
              ) : null}
            </div>
          </section>

          {activeSection === "wiki" ? (
          <section className="panel">
            <div className="row-actions">
              <h3>Wiki de campaña</h3>
              {isDirector ? (
                <button disabled={isSaving} onClick={openCreateReferenceEditor}>
                  Nueva referencia
                </button>
              ) : null}
            </div>
            <div className="cards">
              {selectedCampaign.references.map((reference) => (
                <article key={reference.id} className="card campaign-reference-card">
                  <strong>{reference.name}</strong>
                  <span>{reference.label || "Sin etiqueta"}</span>
                  <span>{reference.isPublic ? "Visible para jugadores" : "Solo DJ"}</span>
                  {reference.summary ? <p>{reference.summary}</p> : null}
                  <div className="card-actions">
                    <button type="button" onClick={() => openReference(reference.id)}>
                      Ver detalle
                    </button>
                    {isDirector ? (
                      <button type="button" onClick={() => openEditReferenceEditor(reference.id)}>
                        Editar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {selectedCampaign.references.length === 0 ? (
                <p className="section-help">Aún no hay referencias creadas para esta campaña.</p>
              ) : null}
            </div>
          </section>
          ) : null}

          {isReferenceEditorOpen ? (
            <section
              className="modal-backdrop"
              onClick={() => {
                if (!isSaving) {
                  setIsReferenceEditorOpen(false);
                }
              }}
            >
              <div className="panel modal-panel campaign-reference-modal" onClick={(event) => event.stopPropagation()}>
                <div className="row-actions">
                  <h3>{selectedReference ? "Editar referencia" : "Crear referencia"}</h3>
                  <div className="toolbar">
                    <button disabled={isSaving} onClick={() => void (selectedReference ? handleSaveReference() : handleCreateReference())}>
                      {selectedReference ? "Guardar referencia" : "Crear referencia"}
                    </button>
                    {selectedReference ? (
                      <button className="danger" disabled={isSaving} onClick={() => void handleDeleteReference()}>
                        Eliminar referencia
                      </button>
                    ) : null}
                    <button type="button" disabled={isSaving} onClick={() => setIsReferenceEditorOpen(false)}>
                      Cerrar
                    </button>
                  </div>
                </div>
                {referenceValidationErrors.length > 0 ? (
                  <div className="error-list">
                    {referenceValidationErrors.map((message) => (
                      <p key={message}>{message}</p>
                    ))}
                  </div>
                ) : null}
                <div className="form-grid">
                  <label className="field">
                    <span>Nombre</span>
                    <input value={referenceForm.name} onChange={(event) => { setReferenceValidationErrors([]); setReferenceForm((prev) => ({ ...prev, name: event.target.value })); }} />
                  </label>
                  <label className="field">
                    <span>Etiqueta</span>
                    <input value={referenceForm.label} onChange={(event) => { setReferenceValidationErrors([]); setReferenceForm((prev) => ({ ...prev, label: event.target.value })); }} />
                  </label>
                  <label className="field">
                    <span>Alias</span>
                    <input value={referenceAliasesText} onChange={(event) => { setReferenceValidationErrors([]); setReferenceAliasesText(event.target.value); }} placeholder="Bosque oscuro, Davokar oscuro" />
                  </label>
                  <label className="field checkbox-field">
                    <span>Visible para jugadores</span>
                    <input
                      type="checkbox"
                      checked={referenceForm.isPublic}
                      onChange={(event) => setReferenceForm((prev) => ({ ...prev, isPublic: event.target.checked }))}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Resumen corto</span>
                  <textarea rows={2} value={referenceForm.summary} onChange={(event) => { setReferenceValidationErrors([]); setReferenceForm((prev) => ({ ...prev, summary: event.target.value })); }} />
                </label>
                <label className="field">
                  <span>Contenido</span>
                  <textarea rows={8} value={referenceForm.content} onChange={(event) => { setReferenceValidationErrors([]); setReferenceForm((prev) => ({ ...prev, content: event.target.value })); }} />
                </label>
                <CampaignReferencePreview reference={{ ...referenceForm, id: selectedReference?.id ?? "draft", aliases: aliasesToInput(referenceAliasesText), createdAt: "", updatedAt: "" }} />
              </div>
            </section>
          ) : null}

          {isReferenceDetailOpen && selectedReference ? (
            <section
              className="modal-backdrop"
              onClick={() => setIsReferenceDetailOpen(false)}
            >
              <div className="panel modal-panel campaign-reference-modal" onClick={(event) => event.stopPropagation()}>
                <div className="row-actions">
                  <h3>Detalle de referencia</h3>
                  <div className="toolbar">
                    {isDirector ? (
                      <button type="button" onClick={() => openEditReferenceEditor(selectedReference.id)}>
                        Editar
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setIsReferenceDetailOpen(false)}>
                      Cerrar
                    </button>
                  </div>
                </div>
                <CampaignReferencePreview reference={selectedReference} />
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
          ) : null}

          {activeSection === "sessions" ? (
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
                        <span>Título</span>
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
                        <span>Ubicación</span>
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
                    <CampaignLinkedTextBlock
                      title="Vista enlazada del resumen de sesión"
                      text={sessionForm.summary}
                      references={selectedCampaign.references}
                      onOpenReference={openReference}
                    />
                    <label className="field">
                      <span>Notas visibles para la mesa</span>
                      <textarea rows={4} value={sessionForm.publicNotes} onChange={(event) => setSessionForm((prev) => ({ ...prev, publicNotes: event.target.value }))} />
                    </label>
                    <CampaignLinkedTextBlock
                      title="Vista enlazada de notas públicas"
                      text={sessionForm.publicNotes}
                      references={selectedCampaign.references}
                      onOpenReference={openReference}
                    />
                    <label className="field">
                      <span>Notas secretas del DJ</span>
                      <textarea rows={4} value={sessionForm.dmNotes} onChange={(event) => setSessionForm((prev) => ({ ...prev, dmNotes: event.target.value }))} />
                    </label>
                    <CampaignLinkedTextBlock
                      title="Vista enlazada de notas secretas"
                      text={sessionForm.dmNotes}
                      references={selectedCampaign.references}
                      onOpenReference={openReference}
                    />

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
                    {selectedSession ? (
                      <>
                        <CampaignLinkedTextBlock
                          title="Resumen"
                          text={selectedSession.summary}
                          references={selectedCampaign.references}
                          onOpenReference={openReference}
                        />
                        <CampaignLinkedTextBlock
                          title="Notas visibles"
                          text={selectedSession.publicNotes}
                          references={selectedCampaign.references}
                          onOpenReference={openReference}
                        />
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </section>
          ) : null}

          {activeSection === "characters" ? (
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
                  {entry.sheet ? (
                    <button type="button" onClick={() => { setSelectedSheetTarget({ kind: "character", linkId: entry.id }); setActiveSection("sheet"); }}>
                      Abrir hoja
                    </button>
                  ) : null}
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
          ) : null}

          {activeSection === "npcs" ? (
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
                    <span>Ocupación</span>
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
                  <span>Bloque rápido</span>
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
                  references={selectedCampaign.references}
                  onOpenReference={openReference}
                  onSave={handleUpdateNpc}
                  onDelete={handleDeleteNpc}
                  onOpenSheet={() => { setSelectedSheetTarget({ kind: "npc", npcId: npc.id }); setActiveSection("sheet"); }}
                  onCreateSheet={async (npcId) => {
                    setSelectedSheetTarget({ kind: "npc", npcId });
                    setActiveSection("sheet");
                    await handleCreateNpcSheet(npcId);
                  }}
                />
              ))}
              {selectedCampaign.npcs.length === 0 ? (
                <p className="section-help">Todavía no hay PNJs registrados.</p>
              ) : null}
            </div>
          </section>
          ) : null}

          {activeSection === "sheet" && selectedCharacterSheetEntry?.sheet ? (
            <section className="panel campaign-sheet-shell">
              <div className="row-actions">
                <h3>Hoja de personaje</h3>
                <button type="button" onClick={() => { setSelectedSheetTarget(null); setActiveSection("characters"); }}>
                  Cerrar hoja
                </button>
              </div>
              <CampaignSheetEditor
                title={selectedCharacterSheetEntry.name}
                subtitle={`${selectedCharacterSheetEntry.ownerEmail} · Personaje de campaña`}
                sheet={selectedCharacterSheetEntry.sheet}
                rollDestination="umbra"
                editable={false}
                allowActions={false}
                busy={isSaving}
                onSave={async (sheet) => handleSaveCharacterSheet(selectedCharacterSheetEntry.id, sheet)}
              />
            </section>
          ) : null}

          {activeSection === "sheet" && selectedSheetTarget?.kind === "npc" && selectedNpcSheetEntry ? (
            <section className="panel campaign-sheet-shell">
              <div className="row-actions">
                <h3>Hoja de PNJ</h3>
                <button type="button" onClick={() => { setSelectedSheetTarget(null); setActiveSection("npcs"); }}>
                  Cerrar hoja
                </button>
              </div>
              {selectedNpcSheetEntry.sheet ? (
                <CampaignSheetEditor
                  title={selectedNpcSheetEntry.name}
                  subtitle={`${selectedNpcSheetEntry.race || "PNJ"} · ${selectedNpcSheetEntry.archetype || selectedNpcSheetEntry.occupation || "Sin arquetipo"}`}
                  sheet={selectedNpcSheetEntry.sheet}
                  rollDestination="umbra"
                  editable={isDirector}
                  busy={isSaving}
                  onSave={async (sheet) => handleSaveNpcSheet(selectedNpcSheetEntry.id, sheet)}
                />
              ) : (
                <div className="campaign-empty-sheet">
                  <p className="section-help">Este PNJ todavía no tiene hoja de personaje. Puedes crearla y usarla para llevar equipo, corrupción, robustez y acciones.</p>
                  {isDirector ? (
                    <button disabled={isSaving} onClick={() => void handleCreateNpcSheet(selectedNpcSheetEntry.id)}>
                      Crear hoja de PNJ
                    </button>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {activeSection === "xp" ? (
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
          ) : null}
        </section>
      )}

      {isCampaignDetailsModalOpen && selectedCampaign ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setIsCampaignDetailsModalOpen(false);
            }
          }}
        >
          <div className="panel modal-panel campaign-create-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h2>Detalles de campa?a</h2>
              <div className="toolbar">
                <button disabled={isSaving} onClick={() => void handleSaveCampaign()}>
                  {isSaving ? "Guardando..." : "Guardar detalle"}
                </button>
                <button type="button" onClick={() => setIsCampaignDetailsModalOpen(false)} disabled={isSaving}>
                  Cerrar
                </button>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={draft.name} disabled={!isDirector} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Ambientaci?n</span>
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
            <CampaignLinkedTextBlock
              title="Vista enlazada del resumen"
              text={draft.summary}
              references={selectedCampaign.references}
              onOpenReference={openReference}
            />
            <label className="field">
              <span>Notas del director</span>
              <textarea rows={5} value={draft.notes} disabled={!isDirector} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
            </label>
            {draft.notes ? (
              <CampaignLinkedTextBlock
                title="Vista enlazada de notas"
                text={draft.notes}
                references={selectedCampaign.references}
                onOpenReference={openReference}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {isCreateCampaignModalOpen ? (
        <section
          className="modal-backdrop"
          onClick={() => {
            if (!isSaving) {
              setIsCreateCampaignModalOpen(false);
            }
          }}
        >
          <div className="panel modal-panel campaign-create-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h2>Nueva campaña</h2>
              <div className="toolbar">
                <button disabled={isSaving} onClick={() => void handleCreateCampaign()}>
                  {isSaving ? "Creando..." : "Crear campaña"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateCampaignModalOpen(false)}
                  disabled={isSaving}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="campaign-create-form">
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
              <label className="field">
                <span>Notas del director</span>
                <textarea
                  rows={6}
                  value={campaignForm.notes}
                  onChange={(event) => setCampaignForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function listToText(values: string[]): string {
  return values.join("\n");
}

function textToList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type CampaignSheetEditorProps = {
  title: string;
  subtitle: string;
  sheet: CharacterSheet;
  rollDestination: RollDestination;
  editable: boolean;
  allowActions?: boolean;
  busy: boolean;
  onSave: (sheet: CharacterSheet) => Promise<void>;
};

function CampaignSheetEditor({ title, subtitle, sheet, rollDestination, editable, allowActions = true, busy, onSave }: CampaignSheetEditorProps) {
  const [draft, setDraft] = useState<CharacterSheet>(sheet);
  const [equipmentText, setEquipmentText] = useState(listToText(sheet.equipo));
  const [contactsText, setContactsText] = useState(listToText(sheet.contactos));
  const [lastActionResult, setLastActionResult] = useState<{ action: CharacterActionDefinition; rolls: ActionRollResult[] } | null>(null);
  const [rollTransportStatus, setRollTransportStatus] = useState<string | null>(null);
  const [pendingRollConfirmation, setPendingRollConfirmation] = useState<PendingRollConfirmation | null>(null);
  const actions = useMemo(() => deriveCharacterActions(draft), [draft]);

  useEffect(() => {
    setDraft(sheet);
    setEquipmentText(listToText(sheet.equipo));
    setContactsText(listToText(sheet.contactos));
    setLastActionResult(null);
    setRollTransportStatus(null);
    setPendingRollConfirmation(null);
  }, [sheet]);

  function updateDraft(mutator: (current: CharacterSheet) => CharacterSheet): void {
    setDraft((current) => mutator(current));
  }

  async function runActionWithCurrentDestination(action: CharacterActionDefinition, phase: CharacterActionPhase): Promise<void> {
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
    } catch (error) {
      setRollTransportStatus(error instanceof Error ? error.message : "No se pudo preparar la tirada");
    }
  }

  function handleRunAction(action: CharacterActionDefinition, phase: CharacterActionPhase): void {
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

  async function handleConfirmRoll20Send(): Promise<void> {
    if (!pendingRollConfirmation) {
      return;
    }

    try {
      const result = await dispatchRoll20Request(pendingRollConfirmation.request, pendingRollConfirmation.visibility);
      setRollTransportStatus(result.status.message);

      if (pendingRollConfirmation.runLocalAfterSend) {
        setLastActionResult(executeCharacterAction(draft, pendingRollConfirmation.action.id, pendingRollConfirmation.phase));
      } else {
        setLastActionResult(null);
      }
    } catch (error) {
      setRollTransportStatus(error instanceof Error ? error.message : "No se pudo preparar la tirada");
    } finally {
      setPendingRollConfirmation(null);
    }
  }

  function getActionsForSource(sourceName: string): CharacterActionDefinition[] {
    return actions.filter((action) => action.sourceName === sourceName);
  }

  return (
    <div className="campaign-sheet">
      <header className="campaign-sheet-header">
        <div>
          <div className="campaign-sheet-kicker">Hoja de personaje</div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="campaign-sheet-vitals">
          <label className="field">
            <span>Robustez actual</span>
            <input
              type="number"
              min={0}
              disabled={!editable}
              value={draft.combate.robustezActual}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  combate: { ...current.combate, robustezActual: Number(event.target.value || 0) }
                }))
              }
            />
          </label>
          <label className="field">
            <span>Corrupción temporal</span>
            <input
              type="number"
              min={0}
              disabled={!editable}
              value={draft.corrupcion.temporal}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  corrupcion: { ...current.corrupcion, temporal: Number(event.target.value || 0) }
                }))
              }
            />
          </label>
          <label className="field">
            <span>Corrupción permanente</span>
            <input
              type="number"
              min={0}
              disabled={!editable}
              value={draft.corrupcion.permanente}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  corrupcion: { ...current.corrupcion, permanente: Number(event.target.value || 0) }
                }))
              }
            />
          </label>
        </div>
      </header>

      <div className="campaign-sheet-grid">
        <section className="campaign-sheet-card">
          <h4>Identidad</h4>
          <div className="campaign-sheet-readonly">
            <span>Raza: {String(draft.identidad.raza)}</span>
            <span>Cultura: {String(draft.identidad.cultura)}</span>
            <span>Arquetipo: {String(draft.identidad.arquetipo)}</span>
            <span>Profesión: {draft.identidad.profesion || "Sin definir"}</span>
          </div>
          <label className="field">
            <span>Objetivo personal</span>
            <textarea
              rows={3}
              disabled={!editable}
              value={draft.identidad.objetivoPersonal}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  identidad: { ...current.identidad, objetivoPersonal: event.target.value }
                }))
              }
            />
          </label>
          <label className="field">
            <span>Notas importantes</span>
            <textarea
              rows={6}
              disabled={!editable}
              value={draft.notas}
              onChange={(event) => updateDraft((current) => ({ ...current, notas: event.target.value }))}
            />
          </label>
        </section>

        <section className="campaign-sheet-card">
          <h4>Combate y recursos</h4>
          <div className="form-grid">
            <label className="field">
              <span>Robustez máxima</span>
              <input
                type="number"
                min={1}
                disabled={!editable}
                value={draft.combate.robustezMax}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    combate: { ...current.combate, robustezMax: Number(event.target.value || 1) }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Umbral de dolor</span>
              <input
                type="number"
                min={0}
                disabled={!editable}
                value={draft.combate.umbralDolor}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    combate: { ...current.combate, umbralDolor: Number(event.target.value || 0) }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Dinero</span>
              <input
                disabled={!editable}
                value={draft.recursos.dinero}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    recursos: { ...current.recursos, dinero: event.target.value }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Otros recursos</span>
              <input
                disabled={!editable}
                value={draft.recursos.otros}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    recursos: { ...current.recursos, otros: event.target.value }
                  }))
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Armadura</span>
            <input
              disabled={!editable}
              value={draft.combate.armadura}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  combate: { ...current.combate, armadura: event.target.value }
                }))
              }
            />
          </label>
          <label className="field">
            <span>Protección</span>
            <input
              disabled={!editable}
              value={draft.combate.armaduraProteccion}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  combate: { ...current.combate, armaduraProteccion: event.target.value }
                }))
              }
            />
          </label>
          <label className="field">
            <span>Notas de corrupción</span>
            <textarea
              rows={3}
              disabled={!editable}
              value={draft.corrupcion.notas}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  corrupcion: { ...current.corrupcion, notas: event.target.value }
                }))
              }
            />
          </label>
        </section>

        <section className="campaign-sheet-card">
          <h4>Equipo y contactos</h4>
          <label className="field">
            <span>Equipo</span>
            <textarea
              rows={8}
              disabled={!editable}
              value={equipmentText}
              onChange={(event) => {
                const nextValue = event.target.value;
                setEquipmentText(nextValue);
                updateDraft((current) => ({ ...current, equipo: textToList(nextValue) }));
              }}
            />
          </label>
          <label className="field">
            <span>Contactos</span>
            <textarea
              rows={6}
              disabled={!editable}
              value={contactsText}
              onChange={(event) => {
                const nextValue = event.target.value;
                setContactsText(nextValue);
                updateDraft((current) => ({ ...current, contactos: textToList(nextValue) }));
              }}
            />
          </label>
        </section>

        <section className="campaign-sheet-card">
          <h4>Atributos</h4>
          <div className="campaign-sheet-attributes">
            {Object.entries(draft.atributos).map(([key, value]) => (
              <div key={key} className="campaign-sheet-attribute">
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="campaign-sheet-card">
          <h4>Armas preparadas</h4>
          <div className="form-grid">
            <label className="field">
              <span>Arma principal</span>
              <input
                disabled={!editable}
                value={draft.combate.armaPrincipal}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    combate: { ...current.combate, armaPrincipal: event.target.value }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Atributo</span>
              <input
                disabled={!editable}
                value={draft.combate.armaPrincipalAtributo}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    combate: { ...current.combate, armaPrincipalAtributo: event.target.value }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Daño</span>
              <input
                disabled={!editable}
                value={draft.combate.danioPrincipal}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    combate: { ...current.combate, danioPrincipal: event.target.value }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Arma secundaria</span>
              <input
                disabled={!editable}
                value={draft.combate.armaSecundaria}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    combate: { ...current.combate, armaSecundaria: event.target.value }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Atributo</span>
              <input
                disabled={!editable}
                value={draft.combate.armaSecundariaAtributo}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    combate: { ...current.combate, armaSecundariaAtributo: event.target.value }
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Daño</span>
              <input
                disabled={!editable}
                value={draft.combate.danioSecundaria}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    combate: { ...current.combate, danioSecundaria: event.target.value }
                  }))
                }
              />
            </label>
          </div>
        </section>
      </div>

      <section className="campaign-sheet-card">
        <h4>Capacidades y acciones</h4>
        <div className="campaign-sheet-capability-columns">
          <CapabilityColumn title="Habilidades" entries={draft.habilidades} getActionsForSource={getActionsForSource} onRunAction={handleRunAction} allowActions={allowActions} />
          <CapabilityColumn title="Poderes místicos" entries={draft.poderesMisticos} getActionsForSource={getActionsForSource} onRunAction={handleRunAction} allowActions={allowActions} />
          <CapabilityColumn title="Rituales" entries={draft.rituales} getActionsForSource={getActionsForSource} onRunAction={handleRunAction} allowActions={allowActions} />
        </div>
      </section>

      <div className="campaign-sheet-grid">
        <section className="campaign-sheet-card">
          <h4>Grupo y contactos de hoja</h4>
          <label className="field">
            <span>Nombre del grupo</span>
            <input
              disabled={!editable}
              value={draft.grupo.nombre}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  grupo: { ...current.grupo, nombre: event.target.value }
                }))
              }
            />
          </label>
          <label className="field">
            <span>Objetivo del grupo</span>
            <textarea
              rows={3}
              disabled={!editable}
              value={draft.grupo.objetivo}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  grupo: { ...current.grupo, objetivo: event.target.value }
                }))
              }
            />
          </label>
          <div className="campaign-sheet-structured-list">
            {draft.contactosHoja.map((contacto, index) => (
              <article key={`contacto-${index}`} className="campaign-structured-card">
                <strong>Contacto {index + 1}</strong>
                <input
                  disabled={!editable}
                  placeholder="Nombre"
                  value={contacto.nombre}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      contactosHoja: current.contactosHoja.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, nombre: event.target.value } : item
                      )
                    }))
                  }
                />
                <input
                  disabled={!editable}
                  placeholder="Raza"
                  value={contacto.raza}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      contactosHoja: current.contactosHoja.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, raza: event.target.value } : item
                      )
                    }))
                  }
                />
                <input
                  disabled={!editable}
                  placeholder="Ocupación"
                  value={contacto.ocupacion}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      contactosHoja: current.contactosHoja.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, ocupacion: event.target.value } : item
                      )
                    }))
                  }
                />
                <input
                  disabled={!editable}
                  placeholder="Jugador"
                  value={contacto.jugador}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      contactosHoja: current.contactosHoja.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, jugador: event.target.value } : item
                      )
                    }))
                  }
                />
              </article>
            ))}
          </div>
        </section>

        <section className="campaign-sheet-card">
          <h4>Artefactos</h4>
          <div className="campaign-sheet-structured-list">
            {draft.artefactos.map((artefacto, index) => (
              <article key={`artefacto-${index}`} className="campaign-structured-card">
                <strong>Artefacto {index + 1}</strong>
                <input
                  disabled={!editable}
                  placeholder="Nombre"
                  value={artefacto.nombre}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      artefactos: current.artefactos.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, nombre: event.target.value } : item
                      )
                    }))
                  }
                />
                <textarea
                  rows={3}
                  disabled={!editable}
                  placeholder="Poderes"
                  value={artefacto.poderes}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      artefactos: current.artefactos.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, poderes: event.target.value } : item
                      )
                    }))
                  }
                />
                <input
                  disabled={!editable}
                  placeholder="Corrupción"
                  value={artefacto.corrupcion}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      artefactos: current.artefactos.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, corrupcion: event.target.value } : item
                      )
                    }))
                  }
                />
              </article>
            ))}
          </div>
        </section>
      </div>

      {allowActions ? (
      <section className="campaign-sheet-card">
        <div className="row-actions">
          <h4>Acciones disponibles</h4>
          {editable ? (
            <button type="button" disabled={busy} onClick={() => void onSave(draft)}>
              Guardar hoja
            </button>
          ) : null}
        </div>
        <div className="campaign-sheet-actions">
          {actions.map((action) => (
            <div key={action.id} className="campaign-action-button">
              <strong>{action.label}</strong>
              <span>{action.sourceName}</span>
              <span>
                {action.cost}
                {action.rollAttribute ? ` · ${action.rollAttribute}` : ""}
                {action.damageFormula ? ` · ${action.damageFormula}` : ""}
              </span>
              <div className="campaign-action-controls">
                {action.rollAttribute ? (
                  <button type="button" onClick={() => void handleRunAction(action, "attack")}>
                    {getActionPhaseLabel(action, "attack")}
                  </button>
                ) : null}
                {action.damageFormula ? (
                  <button type="button" onClick={() => void handleRunAction(action, "damage")}>
                    {getActionPhaseLabel(action, "damage")}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {actions.length === 0 ? <p className="section-help">No hay acciones ejecutables con la configuración actual de la hoja.</p> : null}
        </div>
        {rollTransportStatus ? <p className="meta-text campaign-roll-destination-feedback">{rollTransportStatus}</p> : null}
        {lastActionResult ? (
          <div className="campaign-sheet-roll-result">
            <strong>{lastActionResult.action.label}</strong>
            {renderActionRolls(lastActionResult.rolls, lastActionResult.action.id)}
            <p>{lastActionResult.action.effectSummary}</p>
          </div>
        ) : null}
      </section>
      ) : null}
      {allowActions && pendingRollConfirmation ? (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3>Enviar tirada a Roll20</h3>
            <p className="section-help">
              {pendingRollConfirmation.action.label} · {getActionPhaseLabel(pendingRollConfirmation.action, pendingRollConfirmation.phase)}
            </p>
            <label className="field">
              <span>Visibilidad</span>
              <select
                value={pendingRollConfirmation.visibility}
                onChange={(event) =>
                  setPendingRollConfirmation((current) =>
                    current ? { ...current, visibility: event.target.value as Roll20Visibility } : current
                  )
                }
              >
                <option value="public">Pública (/r)</option>
                <option value="gm">Solo DJ (/gr)</option>
              </select>
            </label>
            <div className="row-actions">
              <button type="button" className="subtle-button" onClick={() => setPendingRollConfirmation(null)}>
                Cancelar
              </button>
              <button type="button" onClick={() => void handleConfirmRoll20Send()}>
                Enviar a Roll20
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CapabilityColumnProps = {
  title: string;
  entries: Array<{ nombre: string; nivel: string; efecto: string }>;
  getActionsForSource: (sourceName: string) => CharacterActionDefinition[];
  onRunAction: (action: CharacterActionDefinition, phase: CharacterActionPhase) => void;
  allowActions: boolean;
};

function CapabilityColumn({ title, entries, getActionsForSource, onRunAction, allowActions }: CapabilityColumnProps) {
  return (
    <div className="campaign-capability-column">
      <h5>{title}</h5>
      {entries.map((entry) => {
        const entryActions = getActionsForSource(entry.nombre);
        return (
          <article key={`${title}-${entry.nombre}-${entry.nivel}`} className="campaign-capability-entry">
            <strong>{entry.nombre}</strong>
            <span>{entry.nivel}</span>
            {entry.efecto ? <p>{entry.efecto}</p> : null}
            {allowActions && entryActions.length > 0 ? (
              <div className="campaign-capability-actions">
                {entryActions.map((action) => (
                  <div key={action.id} className="campaign-action-controls">
                    {action.rollAttribute ? (
                      <button type="button" className="subtle-button" onClick={() => onRunAction(action, "attack")}>
                        {getActionPhaseLabel(action, "attack")}
                      </button>
                    ) : null}
                    {action.damageFormula ? (
                      <button type="button" className="subtle-button" onClick={() => onRunAction(action, "damage")}>
                        {getActionPhaseLabel(action, "damage")}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
      {entries.length === 0 ? <p className="section-help">Sin entradas.</p> : null}
    </div>
  );
}

type CampaignNpcEditorProps = {
  npc: Campaign["npcs"][number];
  editable: boolean;
  busy: boolean;
  references: CampaignReference[];
  onOpenReference: (referenceId: string) => void;
  onSave: (npcId: string, payload: UpdateCampaignNpcInput) => Promise<void>;
  onDelete: (npcId: string) => Promise<void>;
  onOpenSheet: () => void;
  onCreateSheet: (npcId: string) => Promise<void>;
};

function CampaignNpcEditor({ npc, editable, busy, references, onOpenReference, onSave, onDelete, onOpenSheet, onCreateSheet }: CampaignNpcEditorProps) {
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
          <span>Ocupación</span>
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
      <CampaignLinkedTextBlock title="Vista enlazada del resumen" text={draft.summary ?? ""} references={references} onOpenReference={onOpenReference} />
      <label className="field">
        <span>Bloque r?pido</span>
        <textarea rows={2} value={draft.statBlock ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, statBlock: event.target.value }))} />
      </label>
      <label className="field">
        <span>Notas</span>
        <textarea rows={3} value={draft.notes ?? ""} disabled={!editable} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
      </label>
      <CampaignLinkedTextBlock title="Vista enlazada de notas" text={draft.notes ?? ""} references={references} onOpenReference={onOpenReference} />
      <div className="card-actions">
        <span>{npc.isGenerated ? "Generado" : "Manual"}</span>
        <button
          type="button"
          disabled={!npc.sheet && !editable}
          onClick={() => {
            if (npc.sheet) {
              onOpenSheet();
              return;
            }
            void onCreateSheet(npc.id);
          }}
        >
          {npc.sheet ? "Abrir hoja" : "Crear hoja"}
        </button>
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

type CampaignLinkedTextBlockProps = {
  title: string;
  text: string;
  references: CampaignReference[];
  onOpenReference: (referenceId: string) => void;
};

function CampaignLinkedTextBlock({ title, text, references, onOpenReference }: CampaignLinkedTextBlockProps) {
  if (!text.trim()) {
    return null;
  }

  return (
    <div className="campaign-linked-text">
      <strong>{title}</strong>
      <p>{renderLinkedText(text, references, onOpenReference)}</p>
    </div>
  );
}

function CampaignReferencePreview({ reference }: { reference: CampaignReference }) {
  return (
    <div className="campaign-reference-preview">
      <div className="row-actions">
        <div>
          <h3>{reference.name || "Referencia sin nombre"}</h3>
          <p className="meta-text">
            {reference.label || "Sin etiqueta"} · {reference.isPublic ? "Visible para jugadores" : "Solo DJ"}
          </p>
        </div>
      </div>
      {reference.aliases.length > 0 ? (
        <p className="meta-text">
          Alias: {reference.aliases.join(", ")}
        </p>
      ) : null}
      {reference.summary ? <p>{reference.summary}</p> : null}
      {reference.content ? <p>{reference.content}</p> : <p className="section-help">Sin contenido detallado todavía.</p>}
    </div>
  );
}













