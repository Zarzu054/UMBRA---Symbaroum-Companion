import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCharacterActions,
  assignCampaignSessionExperienceSchema,
  buildRollRequest,
  createEmptyCharacterSheet,
  createCampaignReferenceSchema,
  createCampaignSessionSchema,
  executeCharacterAction,
  decodeCampaignDmNotes,
  encodeCampaignDmNotes,
  grantCampaignExperienceSchema,
  getEffectiveCharacterRobustezMax,
  getCharacterMonsterTraitEffects,
  synchronizeCharacterSheet,
  SYMBAROUM_ABILITIES
} from "../dist/index.js";

test("las notas privadas del DJ conservan entradas Markdown y migran el texto antiguo", () => {
  const legacy = decodeCampaignDmNotes("# Secreto\n\nNo mostrar a los jugadores.");
  assert.equal(legacy.entries.length, 1);
  assert.equal(legacy.entries[0].title, "Notas privadas del DJ");
  assert.match(legacy.entries[0].content, /No mostrar/);

  const encoded = encodeCampaignDmNotes([{
    id: "dm-note-1",
    title: "Plan de la sesi\u00f3n",
    content: "## Emboscada\n\n- Tres guardias",
    authorId: "gm-a",
    authorEmail: "gm@example.com",
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-08-10T10:00:00.000Z"
  }]);
  const decoded = decodeCampaignDmNotes(encoded);
  assert.equal(decoded.legacyText, "");
  assert.equal(decoded.entries[0].title, "Plan de la sesi\u00f3n");
  assert.match(decoded.entries[0].content, /## Emboscada/);
});

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
test("las armas arrojadizas generan una accion separada para lanzar el arma", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.inventoryItems = [
    {
      id: "throwing-knife-1",
      name: "Cuchillo arrojadizo",
      category: "weapon",
      quantity: 3,
      stackable: true,
      isCustom: false,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "offHand",
      attackAttribute: "diestro",
      damageFormula: "1d6",
      protectionFormula: "",
      qualities: "Arrojadiza, Corta, Precisa",
      notes: "",
      grantedActions: [],
      modifiers: []
    }
  ];

  const actions = deriveCharacterActions(sheet);
  assert.ok(actions.find((action) => action.label === "Atacar con Cuchillo arrojadizo"));
  const thrownAction = actions.find((action) => action.label === "Lanzar Cuchillo arrojadizo");
  assert.ok(thrownAction);
  assert.equal(thrownAction.rollAttribute, "diestro");
  assert.equal(thrownAction.damageFormula, "1d6");
});

test("las armas con recarga generan una accion separada para recargar", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.inventoryItems = [
    {
      id: "crossbow-1",
      name: "Ballesta",
      category: "weapon",
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "ranged",
      attackAttribute: "diestro",
      damageFormula: "1d10",
      protectionFormula: "",
      qualities: "A distancia, Recarga",
      notes: "",
      grantedActions: [],
      modifiers: []
    }
  ];

  const actions = deriveCharacterActions(sheet);
  const reloadAction = actions.find((action) => action.label === "Recargar Ballesta");
  assert.ok(reloadAction);
  assert.equal(reloadAction.cost, "movement");
  assert.equal(reloadAction.rollAttribute, undefined);
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
  const weaponAction = actions.find((action) => action.label === "Atacar con Espada larga");
  assert.ok(weaponAction);

  const attack = executeCharacterAction(sheet, weaponAction.id, "attack");
  assert.equal(attack.rolls.length, 1);
  assert.equal(attack.rolls[0].formula, "1d20");

  const damage = executeCharacterAction(sheet, weaponAction.id, "damage");
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

  assert.deepEqual(actions, ["adepto"]);
});

test("Glifo vampirico deriva tirada y dano", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    poderesMisticos: [
      {
        nombre: "Glifo vampírico",
        tipo: "Poder místico",
        efecto: "",
        nivel: "novato",
        fuente: "Guía Avanzada del Jugador",
        notas: "",
        acciones: []
      }
    ]
  });

  const action = deriveCharacterActions(sheet).find((entry) => entry.sourceName === "Glifo vampírico");
  assert.ok(action);
  assert.equal(action.rollAttribute, "tenaz");
  assert.equal(action.damageFormula, "1d4");
});

test("Berserker novato agrega una defensa con objetivo fijo de Agil 5", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    habilidades: [
      {
        nombre: "Berserker",
        tipo: "Habilidad",
        efecto: "",
        nivel: "novato",
        fuente: "Libro basico",
        notas: "",
        acciones: [
          {
            id: "novato-berserker",
            label: "Entrar en frenesi (Novato)",
            cost: "free",
            requiredLevel: "novato",
            damageFormula: "+1d6",
            effectSummary: ""
          },
          {
            id: "novato-berserker-defensa",
            label: "Defender con Berserker (Novato)",
            cost: "reaction",
            requiredLevel: "novato",
            rollAttribute: "agil",
            fixedTarget: 5,
            effectSummary: ""
          },
          {
            id: "adepto-berserker",
            label: "Absorber dano con Berserker (Adepto)",
            cost: "reaction",
            requiredLevel: "adepto",
            damageFormula: "1d4",
            effectSummary: ""
          }
        ]
      }
    ]
  });

  const actions = deriveCharacterActions(sheet).filter((action) => action.sourceName === "Berserker");

  assert.deepEqual(
    actions.map((action) => action.id),
    ["ability:Berserker:novato-berserker", "ability:Berserker:novato-berserker-defensa"]
  );

  const defenseAction = actions.find((action) => action.id === "ability:Berserker:novato-berserker-defensa");
  assert.ok(defenseAction);
  assert.equal(defenseAction.rollAttribute, "agil");
  assert.equal(defenseAction.fixedTarget, 5);

  const rollRequest = buildRollRequest(sheet, "Kael", defenseAction.id, "attack", "umbra");
  assert.equal(rollRequest.target, 5);

  const executed = executeCharacterAction(sheet, defenseAction.id, "attack");
  assert.equal(executed.rolls.length, 1);
  assert.equal(executed.rolls[0].target, 5);
});

test("synchronizeCharacterSheet hidrata acciones canonicas para Berserker aunque la hoja las tenga vacias", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    habilidades: [
      {
        nombre: "Berserker",
        tipo: "Habilidad",
        efecto: "",
        nivel: "novato",
        fuente: "Libro basico",
        notas: "",
        acciones: []
      }
    ]
  });

  const actions = deriveCharacterActions(sheet).filter((action) => action.sourceName === "Berserker");

  assert.deepEqual(
    actions.map((action) => action.id),
    ["ability:Berserker:novato-berserker", "ability:Berserker:novato-berserker-defensa"]
  );

  const defenseAction = actions.find((action) => action.id === "ability:Berserker:novato-berserker-defensa");
  assert.ok(defenseAction);
  assert.equal(defenseAction.fixedTarget, 5);
});

test("Robusto agrega una variante de dano extra solo a ataques cuerpo a cuerpo", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    habilidades: [
      {
        nombre: "Robusto",
        tipo: "Rasgo monstruoso",
        efecto: "",
        nivel: "adepto",
        fuente: "Codice de monstruos",
        notas: "",
        acciones: []
      }
    ],
    inventoryItems: [
      {
        id: "espada",
        name: "Espada larga",
        category: "weapon",
        quantity: 1,
        stackable: false,
        isCustom: false,
        description: "",
        weight: "",
        value: "",
        equipped: true,
        slot: "mainHand",
        attackAttribute: "diestro",
        damageFormula: "1d8",
        protectionFormula: "",
        qualities: "",
        notes: "",
        grantedActions: [],
        modifiers: []
      },
      {
        id: "arco",
        name: "Arco corto",
        category: "weapon",
        quantity: 1,
        stackable: false,
        isCustom: false,
        description: "",
        weight: "",
        value: "",
        equipped: true,
        slot: "ranged",
        attackAttribute: "diestro",
        damageFormula: "1d6",
        protectionFormula: "",
        qualities: "",
        notes: "",
        grantedActions: [],
        modifiers: []
      }
    ]
  });

  const meleeAttack = deriveCharacterActions(sheet).find((action) => action.sourceName === "Espada larga");
  const rangedAttack = deriveCharacterActions(sheet).find((action) => action.sourceName === "Arco corto");

  assert.ok(meleeAttack);
  assert.deepEqual(
    meleeAttack.damageModifiers?.map((modifier) => [modifier.label, modifier.formula]),
    [["Robusto", "+1d6"]]
  );

  assert.ok(rangedAttack);
  assert.equal(rangedAttack.damageModifiers, undefined);

  const robustRequest = buildRollRequest(sheet, "Kael", meleeAttack.id, "damage", "umbra", "", ["trait:robusto:2"]);
  assert.equal(robustRequest.formula, "1d8+1d6");
  assert.match(robustRequest.note ?? "", /Robusto/);
});

test("Robusta tambien funciona como bono de dano seleccionable cuando se guarda como habilidad", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    habilidades: [
      {
        nombre: "Robusta",
        tipo: "Rasgo monstruoso",
        efecto: "",
        nivel: "novato",
        fuente: "Codice de monstruos",
        notas: "",
        acciones: []
      }
    ],
    inventoryItems: [
      {
        id: "garrote",
        name: "Garrote",
        category: "weapon",
        quantity: 1,
        stackable: false,
        isCustom: false,
        description: "",
        weight: "",
        value: "",
        equipped: true,
        slot: "mainHand",
        attackAttribute: "fuerte",
        damageFormula: "1d6",
        protectionFormula: "",
        qualities: "",
        notes: "",
        grantedActions: [],
        modifiers: []
      }
    ]
  });

  const meleeAttack = deriveCharacterActions(sheet).find((action) => action.sourceName === "Garrote");
  assert.ok(meleeAttack);
  assert.deepEqual(
    meleeAttack.damageModifiers?.map((modifier) => [modifier.label, modifier.formula]),
    [["Robusto", "+1d4"]]
  );
});

test("Robusto como habilidad aplica su penalizador pasivo de Defensa", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    habilidades: [
      {
        nombre: "Robusto",
        tipo: "Rasgo monstruoso",
        efecto: "",
        nivel: "adepto",
        fuente: "Codice de monstruos",
        notas: "",
        acciones: []
      }
    ]
  });

  const traitEffects = getCharacterMonsterTraitEffects(sheet);
  assert.equal(traitEffects.robustoLevel, 2);
  assert.equal(traitEffects.defenseModifier, 3);
});

test("bonos de dano de una vez por turno generan una variante extra en ataques de arma", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    inventoryItems: [
      {
        id: "daga",
        name: "Daga",
        category: "weapon",
        quantity: 1,
        stackable: false,
        isCustom: false,
        description: "",
        weight: "",
        value: "",
        equipped: true,
        slot: "mainHand",
        attackAttribute: "diestro",
        damageFormula: "1d6",
        protectionFormula: "",
        qualities: "",
        notes: "",
        grantedActions: [],
        modifiers: []
      }
    ],
    habilidades: [
      {
        nombre: "Ataque traicionero",
        tipo: "Habilidad",
        efecto: "",
        nivel: "novato",
        fuente: "Libro basico",
        notas: "",
        acciones: []
      }
    ]
  });

  const weaponAttack = deriveCharacterActions(sheet).find((action) => action.sourceName === "Daga");
  assert.ok(weaponAttack);
  assert.deepEqual(
    weaponAttack.damageModifiers?.map((modifier) => [modifier.label, modifier.formula]),
    [["Ataque traicionero", "+1d4"]]
  );

  const damage = executeCharacterAction(sheet, weaponAttack.id, "damage", ["ability:Ataque traicionero:novato-ataque-traicionero"]);
  assert.equal(damage.rolls.length, 1);
  assert.equal(damage.rolls[0].formula, "1d6+1d4");
});

test("Berserker aparece como modificador seleccionable de dano para ataques cuerpo a cuerpo", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    inventoryItems: [
      {
        id: "hacha",
        name: "Hacha",
        category: "weapon",
        quantity: 1,
        stackable: false,
        isCustom: false,
        description: "",
        weight: "",
        value: "",
        equipped: true,
        slot: "mainHand",
        attackAttribute: "fuerte",
        damageFormula: "1d8",
        protectionFormula: "",
        qualities: "",
        notes: "",
        grantedActions: [],
        modifiers: []
      }
    ],
    habilidades: [
      {
        nombre: "Berserker",
        tipo: "Habilidad",
        efecto: "",
        nivel: "novato",
        fuente: "Libro basico",
        notas: "",
        acciones: []
      }
    ]
  });

  const weaponAttack = deriveCharacterActions(sheet).find((action) => action.sourceName === "Hacha");
  assert.ok(weaponAttack);
  assert.deepEqual(
    weaponAttack.damageModifiers?.map((modifier) => [modifier.label, modifier.formula]),
    [["Berserker", "+1d6"]]
  );

  const request = buildRollRequest(
    sheet,
    "Kael",
    weaponAttack.id,
    "damage",
    "umbra",
    "",
    ["ability:Berserker:novato-berserker"]
  );
  assert.equal(request.formula, "1d8+1d6");
  assert.match(request.note ?? "", /Berserker/);

  const berserkerStandalone = deriveCharacterActions(sheet).find((action) => action.id === "ability:Berserker:novato-berserker");
  assert.ok(berserkerStandalone);
});

test("deriveCharacterActions tambien filtra acciones precalculadas de la hoja segun el nivel real", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    {
      nombre: "Guardaespaldas",
      tipo: "Habilidad",
      efecto: "",
      nivel: "adepto",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    }
  ];
  sheet.actions = [
    {
      id: "ability:Guardaespaldas:novato",
      label: "Usar Guardaespaldas (Novato)",
      sourceType: "ability",
      sourceName: "Guardaespaldas",
      cost: "reaction",
      requiredLevel: "novato",
      effectSummary: ""
    },
    {
      id: "ability:Guardaespaldas:adepto",
      label: "Usar Guardaespaldas (Adepto)",
      sourceType: "ability",
      sourceName: "Guardaespaldas",
      cost: "reaction",
      requiredLevel: "adepto",
      effectSummary: ""
    },
    {
      id: "ability:Guardaespaldas:maestro",
      label: "Usar Guardaespaldas (Maestro)",
      sourceType: "ability",
      sourceName: "Guardaespaldas",
      cost: "reaction",
      requiredLevel: "maestro",
      effectSummary: ""
    }
  ];

  const actions = deriveCharacterActions(sheet)
    .filter((action) => action.sourceName === "Guardaespaldas")
    .map((action) => action.requiredLevel);

  assert.deepEqual(actions, ["adepto"]);
});

test("deriveCharacterActions infiere el nivel de acciones precalculadas antiguas cuando falta requiredLevel", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    {
      nombre: "Guardaespaldas",
      tipo: "Habilidad",
      efecto: "",
      nivel: "adepto",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    }
  ];
  sheet.actions = [
    {
      id: "ability:Guardaespaldas:novato",
      label: "Usar Guardaespaldas (Novato)",
      sourceType: "ability",
      sourceName: "Guardaespaldas",
      cost: "reaction",
      effectSummary: ""
    },
    {
      id: "ability:Guardaespaldas:adepto",
      label: "Usar Guardaespaldas (Adepto)",
      sourceType: "ability",
      sourceName: "Guardaespaldas",
      cost: "reaction",
      effectSummary: ""
    },
    {
      id: "ability:Guardaespaldas:maestro",
      label: "Usar Guardaespaldas (Maestro)",
      sourceType: "ability",
      sourceName: "Guardaespaldas",
      cost: "reaction",
      effectSummary: ""
    }
  ];

  const actions = deriveCharacterActions(sheet)
    .filter((action) => action.sourceName === "Guardaespaldas")
    .map((action) => action.label);

  assert.deepEqual(actions, ["Usar Guardaespaldas (Adepto)"]);
});

test("deriveCharacterActions colapsa acciones de arma duplicadas entre hoja precalculada e inventario equipado", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    inventoryItems: [
      {
        id: "bow-1",
        name: "Arco",
        category: "weapon",
        quantity: 1,
        stackable: false,
        isCustom: false,
        description: "",
        weight: "",
        value: "",
        equipped: true,
        slot: "ranged",
        attackAttribute: "diestro",
        damageFormula: "1d8",
        protectionFormula: "",
        qualities: "",
        notes: "",
        grantedActions: [],
        modifiers: []
      },
      {
        id: "crossbow-1",
        name: "Ballesta",
        category: "weapon",
        quantity: 1,
        stackable: false,
        isCustom: false,
        description: "",
        weight: "",
        value: "",
        equipped: true,
        slot: "offHand",
        attackAttribute: "diestro",
        damageFormula: "1d10",
        protectionFormula: "",
        qualities: "",
        notes: "",
        grantedActions: [],
        modifiers: []
      }
    ]
  });

  const actions = deriveCharacterActions(sheet).filter((action) => action.sourceType === "weapon");
  assert.equal(actions.filter((action) => action.sourceName === "Arco").length, 1);
  assert.equal(actions.filter((action) => action.sourceName === "Ballesta").length, 1);
});

test("synchronizeCharacterSheet colapsa capacidades duplicadas y conserva el nivel mas alto", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    {
      nombre: "Guardaespaldas",
      tipo: "Habilidad",
      efecto: "novato",
      nivel: "novato",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    },
    {
      nombre: "Guardaespaldas",
      tipo: "Habilidad",
      efecto: "adepto",
      nivel: "adepto",
      fuente: "Libro basico",
      notas: "nota",
      acciones: []
    },
    {
      nombre: "Guardaespaldas",
      tipo: "Habilidad",
      efecto: "maestro",
      nivel: "maestro",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    }
  ];

  const normalized = synchronizeCharacterSheet(sheet);

  assert.equal(normalized.habilidades.length, 1);
  assert.equal(normalized.habilidades[0].nivel, "maestro");
  assert.match(normalized.habilidades[0].efecto, /Maestro:/);
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
  assert.equal(actions[0].rollAttribute, "diestro");
});

test("todo personaje tiene un ataque desarmado base de 1d4 aunque no tenga Combate sin armas", () => {
  const sheet = createEmptyCharacterSheet();

  const unarmedAction = deriveCharacterActions(sheet).find((action) => action.label === "Ataque desarmado");
  assert.ok(unarmedAction);
  assert.equal(unarmedAction.damageFormula, "1d4");
  assert.equal(unarmedAction.rollAttribute, "diestro");
});

test("Arma natural crea un ataque separado y no modifica el ataque desarmado base", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    {
      nombre: "Arma natural",
      tipo: "Rasgo monstruoso",
      efecto: "",
      nivel: "novato",
      fuente: "Codice de monstruos",
      notas: "",
      acciones: []
    }
  ];

  const actions = deriveCharacterActions(sheet);
  const unarmedAction = actions.find((action) => action.label === "Ataque desarmado");
  const naturalWeaponAction = actions.find((action) => action.label === "Ataque con Arma natural");
  assert.ok(unarmedAction);
  assert.ok(naturalWeaponAction);
  assert.equal(unarmedAction.damageFormula, "1d4");
  assert.equal(naturalWeaponAction.damageFormula, "1d6");
});

test("Combate sin armas aumenta un nivel de dado el ataque con Arma natural", () => {
  const expectedDamageByNaturalWeaponLevel = {
    novato: "1d8",
    adepto: "1d10",
    maestro: "1d12"
  };

  for (const [naturalWeaponLevel, expectedDamage] of Object.entries(expectedDamageByNaturalWeaponLevel)) {
    const sheet = createEmptyCharacterSheet();
    sheet.habilidades = [
      {
        nombre: "Combate sin armas",
        tipo: "Habilidad",
        efecto: "",
        nivel: "novato",
        fuente: "Libro basico",
        notas: "",
        acciones: []
      },
      {
        nombre: "Arma natural",
        tipo: "Rasgo monstruoso",
        efecto: "",
        nivel: naturalWeaponLevel,
        fuente: "Codice de monstruos",
        notas: "",
        acciones: []
      }
    ];

    const naturalWeaponAction = deriveCharacterActions(sheet).find((action) => action.label === "Ataque con Arma natural");
    assert.ok(naturalWeaponAction);
    assert.equal(naturalWeaponAction.damageFormula, expectedDamage);
  }
});

test("Ataque con Arma natural explica en el desglose cuando Combate sin armas aumenta el dado", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    {
      nombre: "Combate sin armas",
      tipo: "Habilidad",
      efecto: "",
      nivel: "novato",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    },
    {
      nombre: "Arma natural",
      tipo: "Rasgo monstruoso",
      efecto: "",
      nivel: "novato",
      fuente: "Codice de monstruos",
      notas: "",
      acciones: []
    }
  ];

  const naturalWeaponAction = deriveCharacterActions(sheet).find((action) => action.label === "Ataque con Arma natural");
  assert.ok(naturalWeaponAction);
  assert.deepEqual(naturalWeaponAction.damageBreakdown, [
    { label: "Arma natural", formula: "1d6" },
    { label: "Combate sin armas", detail: "Mejora el dado base (Novato)." }
  ]);
});

test("getEffectiveCharacterRobustezMax no conserva un robustezMax guardado obsoleto cuando Recio recalcula menos", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.atributos.fuerte = 15;
  sheet.combate.robustezMax = 23;
  sheet.habilidades = [
    {
      nombre: "Recio",
      tipo: "Rasgo monstruoso",
      efecto: "",
      nivel: "novato",
      fuente: "Codice de monstruos",
      notas: "",
      acciones: []
    }
  ];

  assert.equal(getCharacterMonsterTraitEffects(sheet).robustezMaxima, 22);
  assert.equal(getEffectiveCharacterRobustezMax(sheet), 22);
});

test("la robustez maxima de un PJ nunca es inferior a 10", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.atributos.fuerte = 5;
  sheet.combate.robustezMax = 5;
  sheet.combate.robustezActual = 5;

  assert.equal(getCharacterMonsterTraitEffects(sheet).robustezMaxima, 10);
  assert.equal(getEffectiveCharacterRobustezMax(sheet), 10);

  const synchronized = synchronizeCharacterSheet(sheet);
  assert.equal(synchronized.combate.robustezMax, 10);
  assert.equal(synchronized.combate.robustezActual, 10);
});

test("al migrar el minimo de robustez se conservan los puntos de dano existentes", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.atributos.fuerte = 5;
  sheet.combate.robustezMax = 5;
  sheet.combate.robustezActual = 3;

  const synchronized = synchronizeCharacterSheet(sheet);
  assert.equal(synchronized.combate.robustezMax, 10);
  assert.equal(synchronized.combate.robustezActual, 3);
});

test("sincroniza automaticamente Corrupcion y Moribundo y los retira cuando dejan de aplicar", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.corrupcion.temporal = 2;
  sheet.combate.robustezActual = 0;

  const affected = synchronizeCharacterSheet(sheet);
  assert.deepEqual(
    affected.conditions.filter((condition) => condition.active).map((condition) => condition.id).sort(),
    ["legacy-corruption", "legacy-dying"]
  );

  affected.corrupcion.temporal = 0;
  affected.combate.robustezActual = 1;
  const recovered = synchronizeCharacterSheet(affected);
  assert.equal(recovered.conditions.some((condition) => condition.id === "legacy-corruption"), false);
  assert.equal(recovered.conditions.some((condition) => condition.id === "legacy-dying"), false);
});

test("deriveCharacterActions reemplaza acciones guardadas obsoletas de Arma natural por la derivada actual", () => {
  const sheet = synchronizeCharacterSheet({
    ...createEmptyCharacterSheet(),
    habilidades: [
      {
        nombre: "Combate sin armas",
        tipo: "Habilidad",
        efecto: "",
        nivel: "novato",
        fuente: "Libro basico",
        notas: "",
        acciones: []
      },
      {
        nombre: "Arma natural",
        tipo: "Rasgo monstruoso",
        efecto: "",
        nivel: "novato",
        fuente: "Codice de monstruos",
        notas: "",
        acciones: []
      }
    ],
    actions: [
      {
        id: "trait:arma-natural:1",
        label: "Ataque con Arma natural",
        sourceType: "weapon",
        sourceName: "Arma natural",
        cost: "combat",
        rollAttribute: "diestro",
        damageFormula: "1d6",
        effectSummary: "Version guardada obsoleta."
      }
    ]
  });

  const naturalWeaponActions = deriveCharacterActions(sheet).filter((action) => action.label === "Ataque con Arma natural");
  assert.equal(naturalWeaponActions.length, 1);
  assert.equal(naturalWeaponActions[0].damageFormula, "1d8");
});

test("las armas heredadas llamadas Natural no generan un arma equipada falsa", () => {
  const baseSheet = createEmptyCharacterSheet();
  const sheet = synchronizeCharacterSheet({
    ...baseSheet,
    combate: {
      ...baseSheet.combate,
      armaPrincipal: "Natural",
      danioPrincipal: "1d6",
      armaPrincipalAtributo: "diestro"
    },
    habilidades: [
      {
        nombre: "Arma natural",
        tipo: "Rasgo monstruoso",
        efecto: "",
        nivel: "novato",
        fuente: "Codice de monstruos",
        notas: "",
        acciones: []
      }
    ]
  });

  const actions = deriveCharacterActions(sheet);
  assert.equal(actions.some((action) => action.label === "Atacar con Natural"), false);
  assert.equal(actions.some((action) => action.label === "Ataque con Arma natural"), true);
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
  const knifeAction = actions.find((action) => action.label === "Atacar con Cuchillo");
  assert.ok(knifeAction);
  assert.equal(knifeAction.rollAttribute, "agil");
  assert.match(knifeAction.effectSummary, /dos ataques separados con cuchillo/i);
});

test("Golpe de hierro cambia automaticamente a Fuerte los ataques cuerpo a cuerpo", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.atributos.diestro = 9;
  sheet.atributos.fuerte = 15;
  sheet.inventoryItems = [
    {
      id: "sword-1",
      name: "Espada larga",
      category: "weapon",
      quantity: 1,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "mainHand",
      attackAttribute: "diestro",
      damageFormula: "1d8",
      protectionFormula: "",
      qualities: "larga",
      notes: ""
    }
  ];
  sheet.habilidades = [
    {
      nombre: "Golpe de hierro",
      tipo: "Habilidad",
      efecto: "",
      nivel: "novato",
      fuente: "Libro basico",
      notas: "",
      acciones: [
        {
          id: "novato-golpe-de-hierro",
          label: "Usar Golpe de hierro (Novato)",
          cost: "combat",
          requiredLevel: "novato",
          rollAttribute: "fuerte",
          effectSummary: "Puedes usar Fuerte en vez de Diestro para atacar cuerpo a cuerpo."
        }
      ]
    }
  ];

  const actions = deriveCharacterActions(sheet);
  const weaponAction = actions.find((action) => action.label === "Atacar con Espada larga");
  assert.ok(weaponAction);
  assert.equal(weaponAction.rollAttribute, "fuerte");
  assert.match(weaponAction.effectSummary, /golpe de hierro/i);

  const rollRequest = buildRollRequest(sheet, "Kael", weaponAction.id, "attack", "roll20");
  assert.equal(rollRequest.rollAttribute, "fuerte");
  assert.equal(rollRequest.target, 15);
});

test("Golpe de hierro tambien modifica el ataque desarmado", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.atributos.fuerte = 14;
  sheet.atributos.diestro = 9;
  sheet.habilidades = [
    {
      nombre: "Golpe de hierro",
      tipo: "Habilidad",
      efecto: "",
      nivel: "novato",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    }
  ];

  const unarmedAction = deriveCharacterActions(sheet).find((action) => action.label === "Ataque desarmado");
  assert.ok(unarmedAction);
  assert.equal(unarmedAction.rollAttribute, "fuerte");

  const rollRequest = buildRollRequest(sheet, "Kael", unarmedAction.id, "attack", "roll20");
  assert.equal(rollRequest.rollAttribute, "fuerte");
  assert.equal(rollRequest.target, 14);
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
  const weaponAction = actions.find((action) => action.label === "Atacar con Mandoble");
  assert.ok(weaponAction);
  assert.equal(weaponAction.damageFormula, "1d12");
  assert.match(weaponAction.effectSummary, /ignora la armadura/i);
});

test("Tirador mejora automaticamente arcos y ballestas equipados", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.inventoryItems = [
    {
      id: "bow-1",
      name: "Arco largo",
      category: "weapon",
      quantity: 1,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "ranged",
      attackAttribute: "diestro",
      damageFormula: "1d8",
      protectionFormula: "",
      qualities: "",
      notes: ""
    },
    {
      id: "crossbow-1",
      name: "Ballesta",
      category: "weapon",
      quantity: 1,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "ranged",
      attackAttribute: "diestro",
      damageFormula: "1d10",
      protectionFormula: "",
      qualities: "",
      notes: ""
    }
  ];
  sheet.habilidades = [
    {
      nombre: "Tirador",
      tipo: "Habilidad",
      efecto: "",
      nivel: "novato",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    }
  ];

  const actions = deriveCharacterActions(sheet);
  assert.equal(actions.find((action) => action.label === "Atacar con Arco largo")?.damageFormula, "1d10");
  assert.equal(actions.find((action) => action.label === "Atacar con Ballesta")?.damageFormula, "1d12");
});

test("Sexto sentido cambia a Atento los ataques a distancia disponibles", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.atributos.atento = 13;
  sheet.inventoryItems = [
    {
      id: "bow-1",
      name: "Arco largo",
      category: "weapon",
      quantity: 1,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "ranged",
      attackAttribute: "diestro",
      damageFormula: "1d8",
      protectionFormula: "",
      qualities: "",
      notes: ""
    }
  ];
  sheet.habilidades = [
    {
      nombre: "Sexto sentido",
      tipo: "Habilidad",
      efecto: "",
      nivel: "novato",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    }
  ];

  const bowAction = deriveCharacterActions(sheet).find((action) => action.label === "Atacar con Arco largo");
  assert.ok(bowAction);
  assert.equal(bowAction.rollAttribute, "atento");
  assert.match(bowAction.effectSummary, /sexto sentido/i);

  const rollRequest = buildRollRequest(sheet, "Kael", bowAction.id, "attack", "roll20");
  assert.equal(rollRequest.rollAttribute, "atento");
  assert.equal(rollRequest.target, 13);
});

test("Arco veloz maestro se guarda como accion de combate en el compendio canonico", () => {
  const fastBow = SYMBAROUM_ABILITIES.find((entry) => entry.nombre === "Arco veloz");
  const masterAction = fastBow?.acciones.find((action) => action.label === "Usar Arco veloz (Maestro)");

  assert.ok(masterAction);
  assert.equal(masterAction.cost, "combat");
  assert.equal(masterAction.label, "Usar Arco veloz (Maestro)");
});

test("las subidas acumuladas de nivel de dado se topan en 1d12 y el exceso pasa a +1", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.inventoryItems = [
    {
      id: "halberd-1",
      name: "Alabarda",
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
      qualities: "pesada larga",
      notes: ""
    }
  ];
  sheet.habilidades = [
    {
      nombre: "Armas a dos manos",
      tipo: "Habilidad",
      efecto: "",
      nivel: "novato",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    },
    {
      nombre: "Armas de asta",
      tipo: "Habilidad",
      efecto: "",
      nivel: "novato",
      fuente: "Libro basico",
      notas: "",
      acciones: []
    }
  ];

  const weaponAction = deriveCharacterActions(sheet).find((action) => action.label === "Atacar con Alabarda");
  assert.ok(weaponAction);
  assert.equal(weaponAction.damageFormula, "1d12+1");
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
