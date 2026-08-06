import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyCharacterSheet } from "@umbra/shared";

const serviceMocks = vi.hoisted(() => ({
  createCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  duplicateCharacter: vi.fn(),
  fetchCharacters: vi.fn(),
  importCharacter: vi.fn(),
  updateCharacter: vi.fn()
}));

const generatorMocks = vi.hoisted(() => ({
  generateRandomCharacter: vi.fn()
}));

vi.mock("../services/characterService", () => serviceMocks);
vi.mock("../models/randomCharacterGenerator", () => generatorMocks);

import { useCharacterController } from "./characterController";

describe("useCharacterController random characters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.fetchCharacters.mockResolvedValue([]);
  });

  it("adds the API result directly without refetching the whole directory", async () => {
    const input = {
      name: "Arold",
      archetype: "Guerrero",
      race: "Humano",
      culture: "Ambriano",
      profession: "Mercenario",
      level: 1,
      sheet: createEmptyCharacterSheet()
    };
    const created = { ...input, id: "character-random" };
    const ensureAccessToken = vi.fn().mockResolvedValue("token");
    generatorMocks.generateRandomCharacter.mockReturnValue(input);
    serviceMocks.createCharacter.mockResolvedValue(created);

    const { result } = renderHook(() => useCharacterController(ensureAccessToken));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(serviceMocks.fetchCharacters).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.createRandomCharacter();
    });

    expect(serviceMocks.createCharacter).toHaveBeenCalledWith(input, "token");
    expect(serviceMocks.fetchCharacters).toHaveBeenCalledTimes(1);
    expect(result.current.characters).toEqual([created]);
  });
});
