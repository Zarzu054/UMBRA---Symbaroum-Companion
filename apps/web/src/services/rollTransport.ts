import type { RollDestination, RollRequest } from "@umbra/shared";
import { toRoll20Text, type Roll20Visibility } from "./roll20Adapter";
export type { Roll20Visibility } from "./roll20Adapter";

const STORAGE_KEY = "umbra.rollDestination";
export const ROLL20_BRIDGE_EVENT = "umbra:roll20-request";
export const ROLL20_BRIDGE_PING_EVENT = "umbra:roll20-ping";
export const ROLL20_BRIDGE_RESPONSE_EVENT = "umbra:roll20-response";

export type Roll20BridgeStatus = {
  bridgeAvailable: boolean;
  hasRoll20Tab: boolean;
  mode: "sent" | "inserted" | "copied" | "unavailable" | "error";
  message: string;
};

function waitForBridgeResponse(requestId: string, timeoutMs = 1500): Promise<Roll20BridgeStatus> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener(ROLL20_BRIDGE_RESPONSE_EVENT, handleResponse as EventListener);
      resolve({
        bridgeAvailable: false,
        hasRoll20Tab: false,
        mode: "copied",
        message: "No se detectó el bridge de Roll20. La tirada se ha copiado al portapapeles."
      });
    }, timeoutMs);

    function handleResponse(event: Event): void {
      const customEvent = event as CustomEvent<{ requestId?: string; status?: Roll20BridgeStatus }>;
      if (customEvent.detail?.requestId !== requestId || !customEvent.detail.status) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener(ROLL20_BRIDGE_RESPONSE_EVENT, handleResponse as EventListener);
      resolve(customEvent.detail.status);
    }

    window.addEventListener(ROLL20_BRIDGE_RESPONSE_EVENT, handleResponse as EventListener);
  });
}

export function getRollDestination(): RollDestination {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "umbra" || raw === "roll20" || raw === "both" ? raw : "roll20";
}

export function setRollDestination(destination: RollDestination): void {
  window.localStorage.setItem(STORAGE_KEY, destination);
}

export async function pingRoll20Bridge(): Promise<Roll20BridgeStatus> {
  const requestId = `roll20-ping-${crypto.randomUUID()}`;
  window.dispatchEvent(new CustomEvent(ROLL20_BRIDGE_PING_EVENT, { detail: { requestId } }));
  return waitForBridgeResponse(requestId);
}

export async function dispatchRoll20Request(
  request: RollRequest,
  visibility: Roll20Visibility = "public"
): Promise<{ text: string; status: Roll20BridgeStatus }> {
  const text = toRoll20Text(request, visibility);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Some browsers or embedded contexts deny clipboard writes. The Roll20 bridge
    // event should still fire so a future extension can consume the payload.
  }

  const requestId = `roll20-request-${crypto.randomUUID()}`;
  const responsePromise = waitForBridgeResponse(requestId);
  window.dispatchEvent(new CustomEvent(ROLL20_BRIDGE_EVENT, { detail: { requestId, request, text } }));

  return {
    text,
    status: await responsePromise
  };
}
