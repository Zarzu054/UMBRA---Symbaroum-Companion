import type {
  AddCampaignMemberInput,
  Campaign,
  CreateCampaignInput,
  CreateCampaignNpcInput,
  GrantCampaignExperienceInput,
  UpdateCampaignInput,
  UpdateCampaignNpcInput
} from "@umbra/shared";

type CampaignListResponse = { data: Campaign[] };
type CampaignSingleResponse = { data: Campaign };

const JSON_HEADERS = { "Content-Type": "application/json" };

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
      details?: Array<{ path?: string; message?: string }>;
    };

    return payload.message ?? payload.error ?? `Fallo de solicitud (${response.status})`;
  } catch {
    return `Fallo de solicitud (${response.status})`;
  }
}

async function request<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? JSON_HEADERS : {}),
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

export async function fetchCampaigns(accessToken: string): Promise<Campaign[]> {
  const payload = await request<CampaignListResponse>("/api/campaigns", accessToken);
  return payload.data;
}

export async function createCampaign(input: CreateCampaignInput, accessToken: string): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>("/api/campaigns", accessToken, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return payload.data;
}

export async function updateCampaign(campaignId: string, input: UpdateCampaignInput, accessToken: string): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}`, accessToken, {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return payload.data;
}

export async function addCampaignMember(
  campaignId: string,
  input: AddCampaignMemberInput,
  accessToken: string
): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/members`, accessToken, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return payload.data;
}

export async function removeCampaignMember(memberId: string, accessToken: string): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaign-members/${memberId}`, accessToken, {
    method: "DELETE"
  });
  return payload.data;
}

export async function linkCampaignCharacter(campaignId: string, characterId: string, accessToken: string): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/characters`, accessToken, {
    method: "POST",
    body: JSON.stringify({ characterId })
  });
  return payload.data;
}

export async function unlinkCampaignCharacter(linkId: string, accessToken: string): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaign-characters/${linkId}`, accessToken, {
    method: "DELETE"
  });
  return payload.data;
}

export async function createCampaignNpc(
  campaignId: string,
  input: CreateCampaignNpcInput,
  accessToken: string
): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/npcs`, accessToken, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return payload.data;
}

export async function generateCampaignNpc(campaignId: string, accessToken: string): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/npcs/generate`, accessToken, {
    method: "POST"
  });
  return payload.data;
}

export async function updateCampaignNpc(npcId: string, input: UpdateCampaignNpcInput, accessToken: string): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaign-npcs/${npcId}`, accessToken, {
    method: "PUT",
    body: JSON.stringify(input)
  });
  return payload.data;
}

export async function deleteCampaignNpc(npcId: string, accessToken: string): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaign-npcs/${npcId}`, accessToken, {
    method: "DELETE"
  });
  return payload.data;
}

export async function grantCampaignExperience(
  campaignId: string,
  input: GrantCampaignExperienceInput,
  accessToken: string
): Promise<Campaign> {
  const payload = await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/xp-grants`, accessToken, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return payload.data;
}
