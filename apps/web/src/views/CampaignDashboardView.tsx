import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  deriveCharacterActions,
  executeCharacterAction,
  createCampaignNpcSchema,
  createCampaignChatMessageSchema,
  createCampaignReferenceSchema,
  createCampaignSchema,
  createCampaignSessionSchema,
  type ActionRollResult,
  type CampaignChatMessage,
  type CampaignChatVisibility,
  type CharacterSheet,
  type CharacterActionDefinition,
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
  createCampaignChatMessage,
  createCampaignNpc,
  createCampaignNpcSheet,
  createCampaignReference,
  createCampaignSession,
  deleteCampaignNpc,
  deleteCampaignReference,
  fetchCampaignChatMessages,
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

export function CampaignDashboardView({ user, ensureAccessToken }: Props) {
  const isDirector = user.role === "gm" || user.role === "superadmin";
  const rootRef = useRef<HTMLElement | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [selectedSheetTarget, setSelectedSheetTarget] = useState<CampaignSheetTarget | null>(null);
  const [chatMessages, setChatMessages] = useState<CampaignChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatVisibility, setChatVisibility] = useState<CampaignChatVisibility>("all");
  const [chatActorCharacterId, setChatActorCharacterId] = useState<string>("");
  const [actionNote, setActionNote] = useState("");

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
  const controllableCharacters = useMemo(
    () =>
      (selectedCampaign?.characters ?? []).filter(
        (entry) => entry.sheet && (isDirector || entry.ownerId === user.id)
      ),
    [isDirector, selectedCampaign, user.id]
  );
  const activeChatCharacter = useMemo(
    () => controllableCharacters.find((entry) => entry.characterId === chatActorCharacterId) ?? controllableCharacters[0] ?? null,
    [chatActorCharacterId, controllableCharacters]
  );
  const availableActions = useMemo<CharacterActionDefinition[]>(
    () => (activeChatCharacter?.sheet ? deriveCharacterActions(activeChatCharacter.sheet) : []),
    [activeChatCharacter]
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
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
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
  }, [selectedCampaign, selectedSessionId]);

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
      setSelectedReferenceId(null);
      setSelectedSheetTarget(null);
      setChatMessages([]);
      setChatText("");
      setChatActorCharacterId("");
      setActionNote("");
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
    setChatMessages((current) => (current === selectedCampaign.chatMessages ? current : selectedCampaign.chatMessages));
    setChatActorCharacterId((current) =>
      current && selectedCampaign.characters.some((entry) => entry.characterId === current)
        ? current
        : ((selectedCampaign.characters.find((entry) => entry.sheet && (isDirector || entry.ownerId === user.id))?.characterId) ?? "")
    );
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

  useEffect(() => {
    if (!selectedCampaign) {
      return;
    }

    const abortController = new AbortController();
    const campaignId = selectedCampaign.id;

    async function connectStream(): Promise<void> {
      try {
        const token = await ensureAccessToken();
        const initialMessages = await fetchCampaignChatMessages(campaignId, token);
        setChatMessages(initialMessages);

        const response = await fetch(`/api/campaigns/${campaignId}/chat-stream`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal
        });

        if (!response.ok || !response.body) {
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as { type: string; data?: CampaignChatMessage };
            if (event.type !== "message" || !event.data) continue;
            setChatMessages((current) =>
              current.some((entry) => entry.id === event.data!.id) ? current : [...current, event.data!]
            );
          }
        }
      } catch {
        // Ignore aborted or transient stream errors in MVP.
      }
    }

    void connectStream();
    return () => abortController.abort();
  }, [ensureAccessToken, selectedCampaign]);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      setCampaigns(await fetchCampaigns(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las campaÃ±as");
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
  }

  async function handleCreateCampaign(): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const created = await createCampaign(createCampaignSchema.parse(campaignForm), token);
      upsertCampaign(created);
      setCampaignForm(emptyCampaignForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la campaÃ±a");
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
      setError(err instanceof Error ? err.message : "No se pudo guardar la campaÃ±a");
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
      setError(err instanceof Error ? err.message : "No se pudo crear la sesiÃ³n");
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
      setError(err instanceof Error ? err.message : "No se pudo guardar la sesiÃ³n");
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
      setError(err instanceof Error ? err.message : "No se pudo asignar PX de sesiÃ³n");
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

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const parsed = createCampaignReferenceSchema.parse({
        ...referenceForm,
        aliases: aliasesToInput(referenceAliasesText)
      });
      const updated = await createCampaignReference(selectedCampaign.id, parsed, token);
      upsertCampaign(updated);
      setReferenceForm(emptyReferenceForm);
      setReferenceAliasesText("");
      setSelectedReferenceId(updated.references[0]?.id ?? null);
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

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const parsed = {
        ...referenceForm,
        aliases: aliasesToInput(referenceAliasesText)
      } as UpdateCampaignReferenceInput;
      const updated = await updateCampaignReference(selectedReference.id, parsed, token);
      upsertCampaign(updated);
      setSelectedReferenceId(selectedReference.id);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la referencia");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendChatMessage(): Promise<void> {
    if (!selectedCampaign || !chatText.trim()) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const message = await createCampaignChatMessage(
        selectedCampaign.id,
        createCampaignChatMessageSchema.parse({
          characterId: chatActorCharacterId || undefined,
          visibility: chatVisibility,
          text: chatText.trim()
        }),
        token
      );
      setChatMessages((current) => (current.some((entry) => entry.id === message.id) ? current : [...current, message]));
      setChatText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExecuteAction(action: CharacterActionDefinition): Promise<void> {
    if (!selectedCampaign || !activeChatCharacter) {
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const message = await createCampaignChatMessage(
        selectedCampaign.id,
        createCampaignChatMessageSchema.parse({
          visibility: chatVisibility,
          text: "",
          actionExecution: {
            characterId: activeChatCharacter.characterId,
            actionId: action.id,
            note: actionNote.trim()
          }
        }),
        token
      );
      setChatMessages((current) => (current.some((entry) => entry.id === message.id) ? current : [...current, message]));
      setActionNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar la accion");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="campaigns-module" ref={rootRef}>
      <section className="panel campaign-hero">
        <h2>Gestor de Campañas</h2>
        <p>Centraliza miembros, personajes vinculados, sesiones del DJ, PNJs y reparto de experiencia.</p>
      </section>

      {error ? (
        <section className="panel error-list">
          <p>{error}</p>
        </section>
      ) : null}

      {!selectedCampaign ? (
        <section className="panel campaign-list-page">
          <div className="row-actions">
            <h3>Campañas</h3>
            <button disabled={isLoading} onClick={() => void refresh()}>
              Recargar
            </button>
          </div>

          {isLoading ? <p>Cargando campañas...</p> : null}

          <div className="campaign-list">
            {campaigns.map((campaign) => (
              <button key={campaign.id} className="campaign-list-item" onClick={() => setSelectedCampaignId(campaign.id)}>
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

          {isDirector ? (
            <div className="campaign-create-form">
              <div className="section-title">Nueva campaña</div>
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
              <button disabled={isSaving} onClick={() => void handleCreateCampaign()}>
                Crear campaña
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="campaign-main">
          <section className="panel">
            <div className="row-actions">
              <div>
                <button
                  className="subtle-button"
                  onClick={() => {
                    setSelectedCampaignId(null);
                    setSelectedSessionId(null);
                  }}
                >
                  Volver a campañas
                </button>
                <h2>{selectedCampaign.name}</h2>
                <p className="meta-text">
                  DJ: <strong>{selectedCampaign.gmEmail}</strong>
                </p>
              </div>
              {isDirector ? (
                <button disabled={isSaving} onClick={() => void handleSaveCampaign()}>
                  Guardar detalle
                </button>
              ) : null}
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={draft.name} disabled={!isDirector} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Ambientación</span>
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
          </section>

          <section className="panel">
            <div className="row-actions">
              <h3>Wiki de campaña</h3>
              {isDirector ? (
                <button
                  disabled={isSaving}
                  onClick={() => {
                    setSelectedReferenceId(null);
                    setReferenceForm(emptyReferenceForm);
                    setReferenceAliasesText("");
                  }}
                >
                  Nueva referencia
                </button>
              ) : null}
            </div>
            <div className="campaign-reference-layout">
              <div className="campaign-reference-list">
                {selectedCampaign.references.map((reference) => (
                  <button
                    key={reference.id}
                    className={`campaign-list-item${selectedReferenceId === reference.id ? " is-active" : ""}`}
                    onClick={() => openReference(reference.id)}
                  >
                    <strong>{reference.name}</strong>
                    <span>{reference.label}</span>
                    <span>{reference.isPublic ? "Visible para jugadores" : "Solo DJ"}</span>
                  </button>
                ))}
                {selectedCampaign.references.length === 0 ? (
                  <p className="section-help">Aun no hay referencias creadas para esta campaña.</p>
                ) : null}
              </div>

              <div className="campaign-reference-detail">
                {isDirector ? (
                  <>
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
                      </div>
                    </div>
                    <div className="form-grid">
                      <label className="field">
                        <span>Nombre</span>
                        <input value={referenceForm.name} onChange={(event) => setReferenceForm((prev) => ({ ...prev, name: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Etiqueta</span>
                        <input value={referenceForm.label} onChange={(event) => setReferenceForm((prev) => ({ ...prev, label: event.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Alias</span>
                        <input value={referenceAliasesText} onChange={(event) => setReferenceAliasesText(event.target.value)} placeholder="Bosque oscuro, Davokar oscuro" />
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
                      <textarea rows={2} value={referenceForm.summary} onChange={(event) => setReferenceForm((prev) => ({ ...prev, summary: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Contenido</span>
                      <textarea rows={8} value={referenceForm.content} onChange={(event) => setReferenceForm((prev) => ({ ...prev, content: event.target.value }))} />
                    </label>
                    <CampaignReferencePreview reference={{ ...referenceForm, id: selectedReference?.id ?? "draft", aliases: aliasesToInput(referenceAliasesText), createdAt: "", updatedAt: "" }} />
                  </>
                ) : selectedReference ? (
                  <CampaignReferencePreview reference={selectedReference} />
                ) : (
                  <p className="section-help">Selecciona una referencia resaltada o una entrada de la lista.</p>
                )}
              </div>
            </div>
          </section>

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
                    <button type="button" onClick={() => setSelectedSheetTarget({ kind: "character", linkId: entry.id })}>
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
                  onOpenSheet={() => setSelectedSheetTarget({ kind: "npc", npcId: npc.id })}
                  onCreateSheet={async (npcId) => {
                    setSelectedSheetTarget({ kind: "npc", npcId });
                    await handleCreateNpcSheet(npcId);
                  }}
                />
              ))}
              {selectedCampaign.npcs.length === 0 ? (
                <p className="section-help">Todavía no hay PNJs registrados.</p>
              ) : null}
            </div>
          </section>

          {selectedCharacterSheetEntry?.sheet ? (
            <section className="panel campaign-sheet-shell">
              <div className="row-actions">
                <h3>Hoja de personaje</h3>
                <button type="button" onClick={() => setSelectedSheetTarget(null)}>
                  Cerrar hoja
                </button>
              </div>
              <CampaignSheetEditor
                title={selectedCharacterSheetEntry.name}
                subtitle={`${selectedCharacterSheetEntry.ownerEmail} · Personaje de campaña`}
                sheet={selectedCharacterSheetEntry.sheet}
                editable={isDirector || selectedCharacterSheetEntry.ownerId === user.id}
                busy={isSaving}
                onSave={async (sheet) => handleSaveCharacterSheet(selectedCharacterSheetEntry.id, sheet)}
              />
            </section>
          ) : null}

          {selectedSheetTarget?.kind === "npc" && selectedNpcSheetEntry ? (
            <section className="panel campaign-sheet-shell">
              <div className="row-actions">
                <h3>Hoja de PNJ</h3>
                <button type="button" onClick={() => setSelectedSheetTarget(null)}>
                  Cerrar hoja
                </button>
              </div>
              {selectedNpcSheetEntry.sheet ? (
                <CampaignSheetEditor
                  title={selectedNpcSheetEntry.name}
                  subtitle={`${selectedNpcSheetEntry.race || "PNJ"} · ${selectedNpcSheetEntry.archetype || selectedNpcSheetEntry.occupation || "Sin arquetipo"}`}
                  sheet={selectedNpcSheetEntry.sheet}
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

          <section className="panel">
            <div className="row-actions">
              <h3>Chat de campaña</h3>
              <span className="meta-text">Tiempo real para mesa y DJ</span>
            </div>
            <div className="campaign-chat-layout">
              <div className="campaign-chat-feed">
                {chatMessages.map((message) => (
                  <article key={message.id} className={`card campaign-chat-message${message.visibility === "gm_only" ? " is-private" : ""}`}>
                    <strong>
                      {message.characterName ? `${message.characterName} · ` : ""}
                      {message.userEmail}
                    </strong>
                    <span>
                      {new Date(message.createdAt).toLocaleTimeString()} · {message.visibility === "gm_only" ? "Solo DJ" : "Para todos"}
                    </span>
                    {message.actionLabel ? (
                      <span>
                        {message.actionLabel}
                        {message.actionCost ? ` (${message.actionCost})` : ""}
                      </span>
                    ) : null}
                    {message.text ? <p>{message.text}</p> : null}
                    {message.rolls.length > 0 ? (
                      <div className="campaign-chat-rolls">
                        {message.rolls.map((roll, index) => (
                          <span key={`${message.id}-roll-${index}`}>
                            {roll.label}: {roll.formula} = {roll.total}
                            {typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "exito" : "fallo"}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
                {chatMessages.length === 0 ? <p className="section-help">Aun no hay mensajes en la campaña.</p> : null}
              </div>

              <div className="campaign-chat-compose">
                <div className="form-grid">
                  <label className="field">
                    <span>Visibilidad</span>
                    <select value={chatVisibility} onChange={(event) => setChatVisibility(event.target.value as CampaignChatVisibility)}>
                      <option value="all">Para todos</option>
                      <option value="gm_only">Solo DJ</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Actor</span>
                    <select value={chatActorCharacterId} onChange={(event) => setChatActorCharacterId(event.target.value)}>
                      <option value="">Sin personaje</option>
                      {controllableCharacters.map((entry) => (
                        <option key={entry.characterId} value={entry.characterId}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Mensaje</span>
                  <textarea rows={4} value={chatText} onChange={(event) => setChatText(event.target.value)} />
                </label>
                <button disabled={isSaving || !chatText.trim()} onClick={() => void handleSendChatMessage()}>
                  Enviar mensaje
                </button>

                {activeChatCharacter ? (
                  <>
                    <div className="section-title">Acciones de {activeChatCharacter.name}</div>
                    <label className="field">
                      <span>Nota de accion</span>
                      <input value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder="Objetivo, contexto o aclaracion" />
                    </label>
                    <div className="campaign-action-list">
                      {availableActions.map((action) => (
                        <button key={action.id} className="campaign-action-button" disabled={isSaving} onClick={() => void handleExecuteAction(action)}>
                          <strong>{action.label}</strong>
                          <span>{action.sourceName}</span>
                          <span>
                            {action.cost}
                            {action.rollAttribute ? ` · ${action.rollAttribute}` : ""}
                            {action.damageFormula ? ` · ${action.damageFormula}` : ""}
                          </span>
                        </button>
                      ))}
                      {availableActions.length === 0 ? (
                        <p className="section-help">No hay acciones ejecutables configuradas para este personaje. Ahora mismo el sistema genera acciones de armas y cualquier accion estructurada en habilidades, poderes o rituales.</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="section-help">Selecciona uno de tus personajes vinculados para ver acciones ejecutables.</p>
                )}
              </div>
            </div>
          </section>

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
        </section>
      )}
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
  editable: boolean;
  busy: boolean;
  onSave: (sheet: CharacterSheet) => Promise<void>;
};

function CampaignSheetEditor({ title, subtitle, sheet, editable, busy, onSave }: CampaignSheetEditorProps) {
  const [draft, setDraft] = useState<CharacterSheet>(sheet);
  const [equipmentText, setEquipmentText] = useState(listToText(sheet.equipo));
  const [contactsText, setContactsText] = useState(listToText(sheet.contactos));
  const [lastActionResult, setLastActionResult] = useState<{ action: CharacterActionDefinition; rolls: ActionRollResult[] } | null>(null);
  const actions = useMemo(() => deriveCharacterActions(draft), [draft]);

  useEffect(() => {
    setDraft(sheet);
    setEquipmentText(listToText(sheet.equipo));
    setContactsText(listToText(sheet.contactos));
    setLastActionResult(null);
  }, [sheet]);

  function updateDraft(mutator: (current: CharacterSheet) => CharacterSheet): void {
    setDraft((current) => mutator(current));
  }

  function handleRunAction(action: CharacterActionDefinition): void {
    setLastActionResult(executeCharacterAction(draft, action.id));
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
          <CapabilityColumn title="Habilidades" entries={draft.habilidades} getActionsForSource={getActionsForSource} onRunAction={handleRunAction} />
          <CapabilityColumn title="Poderes místicos" entries={draft.poderesMisticos} getActionsForSource={getActionsForSource} onRunAction={handleRunAction} />
          <CapabilityColumn title="Rituales" entries={draft.rituales} getActionsForSource={getActionsForSource} onRunAction={handleRunAction} />
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
            <button key={action.id} type="button" className="campaign-action-button" onClick={() => handleRunAction(action)}>
              <strong>{action.label}</strong>
              <span>{action.sourceName}</span>
              <span>
                {action.cost}
                {action.rollAttribute ? ` · ${action.rollAttribute}` : ""}
                {action.damageFormula ? ` · ${action.damageFormula}` : ""}
              </span>
            </button>
          ))}
          {actions.length === 0 ? <p className="section-help">No hay acciones ejecutables con la configuración actual de la hoja.</p> : null}
        </div>
        {lastActionResult ? (
          <div className="campaign-sheet-roll-result">
            <strong>{lastActionResult.action.label}</strong>
            {lastActionResult.rolls.map((roll, index) => (
              <span key={`${lastActionResult.action.id}-${index}`}>
                {roll.label}: {roll.formula} = {roll.total}
                {typeof roll.target === "number" ? ` vs ${roll.target} ${roll.success ? "éxito" : "fallo"}` : ""}
              </span>
            ))}
            <p>{lastActionResult.action.effectSummary}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

type CapabilityColumnProps = {
  title: string;
  entries: Array<{ nombre: string; nivel: string; efecto: string }>;
  getActionsForSource: (sourceName: string) => CharacterActionDefinition[];
  onRunAction: (action: CharacterActionDefinition) => void;
};

function CapabilityColumn({ title, entries, getActionsForSource, onRunAction }: CapabilityColumnProps) {
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
            {entryActions.length > 0 ? (
              <div className="campaign-capability-actions">
                {entryActions.map((action) => (
                  <button key={action.id} type="button" className="subtle-button" onClick={() => onRunAction(action)}>
                    {action.label}
                  </button>
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
          <span>Ocupacion</span>
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
        <span>Bloque rapido</span>
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





