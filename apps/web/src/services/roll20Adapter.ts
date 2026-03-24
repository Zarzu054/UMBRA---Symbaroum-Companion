import type { RollRequest } from "@umbra/shared";

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

export function toRoll20Text(request: RollRequest): string {
  const lines = [
    `${request.characterName} - ${request.actionLabel} [${getKindLabel(request)}]`,
    `/r ${request.formula}`
  ];

  if (request.rollAttribute && typeof request.target === "number") {
    lines.push(`Atributo: ${request.rollAttribute} | Objetivo: <= ${request.target}`);
  }

  if (request.note) {
    lines.push(`Nota: ${request.note}`);
  }

  return lines.join("\n");
}
