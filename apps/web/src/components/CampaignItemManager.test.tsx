import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Campaign } from "@umbra/shared";
import { CampaignItemManager } from "./CampaignItemManager";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CampaignItemManager", () => {
  it("creates an exclusive piece with a campaign owner and locks stacking controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const campaign = {
      id: "11111111-1111-4111-8111-111111111111",
      campaignItems: [],
      characters: [{ id: "22222222-2222-4222-8222-222222222222", name: "Arold" }],
      npcs: [{ id: "33333333-3333-4333-8333-333333333333", name: "Capitán" }]
    } as Campaign;

    render(<CampaignItemManager campaign={campaign} kind="weapon" ensureAccessToken={async () => "token"} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear arma" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Poseedor único/ }));

    expect(screen.getByLabelText("Cantidad predeterminada")).toBeDisabled();
    expect(screen.getByLabelText("Apilable")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Poseedor inicial"), {
      target: { value: "character:22222222-2222-4222-8222-222222222222" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/campaigns/11111111-1111-4111-8111-111111111111/items");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      isUnique: true,
      ownerType: "character",
      ownerId: "22222222-2222-4222-8222-222222222222",
      definition: { stackable: false, defaultQuantity: 1 }
    });
    expect(onRefresh).toHaveBeenCalled();
  });
});
