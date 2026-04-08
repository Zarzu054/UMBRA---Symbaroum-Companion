import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCharacterActions,
  assignCampaignSessionExperienceSchema,
  createEmptyCharacterSheet,
  createCampaignReferenceSchema,
  createCampaignSessionSchema,
  executeCharacterAction,
  grantCampaignExperienceSchema
} from "../dist/index.js";

test("createCampaignSessionSchema acepta una sesion valida", () => {
  const parsed = createCampaignSessionSchema.parse({
    title: "Sesion 12",
    scheduledFor: "2026-03-15T19:00:00.000Z",
    location: "Discord",
    summary: "Exploracion de Davokar",
    publicNotes: "Repasar botin pendiente",
    dmNotes: "Emboscada de abominacion",
    status: "planned"
  });

  assert.equal(parsed.title, "Sesion 12");
  assert.equal(parsed.status, "planned");
});

test("grantCampaignExperienceSchema rechaza PX menores que 1", () => {
  assert.throws(() => {
    grantCampaignExperienceSchema.parse({
      characterId: "11111111-1111-1111-1111-111111111111",
      amount: 0,
      reason: "Fin de sesion"
    });
  });
});

test("assignCampaignSessionExperienceSchema acepta awards batch con ceros y positivos", () => {
  const parsed = assignCampaignSessionExperienceSchema.parse({
    awards: [
      { characterId: "11111111-1111-1111-1111-111111111111", amount: 0 },
      { characterId: "22222222-2222-2222-2222-222222222222", amount: 5 }
    ]
  });

  assert.equal(parsed.awards.length, 2);
  assert.equal(parsed.awards[0].amount, 0);
  assert.equal(parsed.awards[1].amount, 5);
});

test("assignCampaignSessionExperienceSchema rechaza cantidades negativas", () => {
  assert.throws(() => {
    assignCampaignSessionExperienceSchema.parse({
      awards: [{ characterId: "11111111-1111-1111-1111-111111111111", amount: -1 }]
    });
  });
});

test("createCampaignReferenceSchema acepta referencias publicas con alias", () => {
  const parsed = createCampaignReferenceSchema.parse({
    name: "Yndaros",
    label: "Ciudad",
    aliases: ["La Capital", "Ciudad de la Reina"],
    summary: "Centro de poder de Ambria",
    content: "Los personajes oyen rumores sobre Yndaros en casi toda la campaña.",
    isPublic: true
  });

  assert.equal(parsed.name, "Yndaros");
  assert.equal(parsed.aliases.length, 2);
  assert.equal(parsed.isPublic, true);
});

test("deriveCharacterActions genera accion de arma y executeCharacterAction separa ataque y daño", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.combate.armaPrincipal = "Espada larga";
  sheet.combate.armaPrincipalAtributo = "fuerte";
  sheet.combate.danioPrincipal = "1d8";
  sheet.atributos.fuerte = 20;

  const actions = deriveCharacterActions(sheet);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].label, "Atacar con Espada larga");

  const attack = executeCharacterAction(sheet, actions[0].id, "attack");
  assert.equal(attack.rolls.length, 1);
  assert.equal(attack.rolls[0].formula, "1d20");

  const damage = executeCharacterAction(sheet, actions[0].id, "damage");
  assert.equal(damage.rolls.length, 1);
  assert.equal(damage.rolls[0].formula, "1d8");
});

test("deriveCharacterActions filtra acciones por el nivel real de la capacidad", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.poderesMisticos = [
    {
      nombre: "Tormenta de flechas",
      tipo: "Poder místico",
      efecto: "",
      nivel: "adepto",
      fuente: "Guía Avanzada del Jugador",
      notas: "",
      acciones: [
        { id: "novato-tormenta", label: "Tormenta de flechas (Novato)", cost: "combat", requiredLevel: "novato", rollAttribute: "tenaz", damageFormula: "1d6", effectSummary: "" },
        { id: "adepto-tormenta", label: "Tormenta de flechas (Adepto)", cost: "combat", requiredLevel: "adepto", rollAttribute: "tenaz", damageFormula: "1d8", effectSummary: "" },
        { id: "maestro-tormenta", label: "Tormenta de flechas (Maestro)", cost: "combat", requiredLevel: "maestro", rollAttribute: "tenaz", damageFormula: "1d8", effectSummary: "" }
      ]
    }
  ];

  const actions = deriveCharacterActions(sheet)
    .filter((action) => action.sourceName === "Tormenta de flechas")
    .map((action) => action.requiredLevel);

  assert.deepEqual(actions, ["novato", "adepto"]);
});

test("Combate sin armas se deriva como ataque base y no como accion pasiva separada", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    {
      nombre: "Combate sin armas",
      tipo: "Habilidad",
      efecto: "",
      nivel: "adepto",
      fuente: "Libro basico",
      notas: "",
      acciones: [
        {
          id: "adepto-combate-sin-armas",
          label: "Usar Combate sin armas (Adepto)",
          cost: "combat",
          requiredLevel: "adepto",
          damageFormula: "1d6/1d6",
          effectSummary: "Haz dos ataques desarmados contra el mismo objetivo."
        }
      ]
    }
  ];

  const actions = deriveCharacterActions(sheet);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].label, "Ataque desarmado");
  assert.equal(actions[0].damageFormula, "1d6");
  assert.equal(actions[0].rollAttribute, "fuerte");
});

test("Cuchillo rapido modifica el ataque con cuchillo en vez de aparecer como accion separada", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.inventoryItems = [
    {
      id: "knife-1",
      name: "Cuchillo",
      category: "weapon",
      quantity: 1,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "mainHand",
      attackAttribute: "diestro",
      damageFormula: "1d6",
      protectionFormula: "",
      qualities: "corta",
      notes: ""
    }
  ];
  sheet.habilidades = [
    {
      nombre: "Cuchillo rápido",
      tipo: "Habilidad",
      efecto: "",
      nivel: "adepto",
      fuente: "Libro basico",
      notas: "",
      acciones: [
        {
          id: "adepto-cuchillo-rapido",
          label: "Usar Cuchillo rápido (Adepto)",
          cost: "combat",
          requiredLevel: "adepto",
          rollAttribute: "agil",
          effectSummary: "Haz dos ataques con cuchillo en una sola acción."
        }
      ]
    }
  ];

  const actions = deriveCharacterActions(sheet);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].label, "Atacar con Cuchillo");
  assert.equal(actions[0].rollAttribute, "agil");
  assert.match(actions[0].effectSummary, /dos ataques separados con cuchillo/i);
});

test("Armas a dos manos modifica el arma pesada y no aparece como accion separada", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.inventoryItems = [
    {
      id: "greatsword-1",
      name: "Mandoble",
      category: "weapon",
      quantity: 1,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "mainHand",
      attackAttribute: "diestro",
      damageFormula: "1d10",
      protectionFormula: "",
      qualities: "pesada",
      notes: ""
    }
  ];
  sheet.habilidades = [
    {
      nombre: "Armas a dos manos",
      tipo: "Habilidad",
      efecto: "",
      nivel: "maestro",
      fuente: "Libro basico",
      notas: "",
      acciones: [
        {
          id: "maestro-armas-a-dos-manos",
          label: "Usar Armas a dos manos (Maestro)",
          cost: "combat",
          requiredLevel: "maestro",
          effectSummary: "Haz un ataque con arma pesada que ignora por completo la armadura."
        }
      ]
    }
  ];

  const actions = deriveCharacterActions(sheet);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].label, "Atacar con Mandoble");
  assert.equal(actions[0].damageFormula, "1d12");
  assert.match(actions[0].effectSummary, /ignora la armadura/i);
});

test("executeCharacterAction no tira daño cuando falla la tirada de ataque", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.combate.armaPrincipal = "Espada larga";
  sheet.combate.armaPrincipalAtributo = "fuerte";
  sheet.combate.danioPrincipal = "1d8";
  sheet.atributos.fuerte = 0;

  const [action] = deriveCharacterActions(sheet);
  const executed = executeCharacterAction(sheet, action.id);

  assert.equal(executed.rolls.length, 1);
  assert.equal(executed.rolls[0].kind, "attack_check");
  assert.equal(executed.rolls[0].success, false);
});
