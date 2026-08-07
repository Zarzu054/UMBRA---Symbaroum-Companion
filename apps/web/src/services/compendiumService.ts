import type { CompendiumLibraryState, SetCompendiumFavoriteInput } from "@umbra/shared";
import { readFriendlyApiError } from "./apiError";

type LibraryResponse = { data: CompendiumLibraryState };

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchCompendiumLibrary(accessToken: string): Promise<CompendiumLibraryState> {
  const response = await fetch("/api/compendium/library", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as LibraryResponse;
  return payload.data;
}

export async function setCompendiumFavorite(
  entryId: string,
  input: SetCompendiumFavoriteInput,
  accessToken: string
): Promise<void> {
  const response = await fetch(`/api/compendium/library/${encodeURIComponent(entryId)}/favorite`, {
    method: "PUT",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}

export async function recordCompendiumView(entryId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/compendium/library/${encodeURIComponent(entryId)}/view`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}
