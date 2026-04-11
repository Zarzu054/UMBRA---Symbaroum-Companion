import type { RollRequest } from "@umbra/shared";

export type Roll20Visibility = "public" | "gm";

function getKindLabel(request: RollRequest): string {
  switch (request.kind) {
    case "attack":
      return "Ataque";
    case "check":
      return "Prueba";
    case "damage":
      return "Da\u00f1o";
    default:
      return "Tirada";
  }
}

function formatAttributeLabel(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function toRoll20Text(request: RollRequest, visibility: Roll20Visibility = "public"): string {
  const lines = [
    `${request.characterName} - ${request.actionLabel} [${getKindLabel(request)}]`,
    `${visibility === "gm" ? "/gr" : "/r"} ${request.formula}`
  ];

  if (request.rollAttribute && typeof request.target === "number") {
    lines.push(`Atributo: ${formatAttributeLabel(request.rollAttribute)} | Objetivo: <= ${request.target}`);
  }

  if (request.note) {
    lines.push(`Nota: ${request.note}`);
  }

  return lines.join("\n");
}
