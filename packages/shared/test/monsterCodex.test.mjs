import test from "node:test";
import assert from "node:assert/strict";
import {
  MONSTER_CODEX_FAMILIES,
  STARTER_MONSTER_CODEX,
  getMonsterCreationChallenge,
  monsterSheetSchema,
  parsePublishedWeaponProfiles
} from "../dist/index.js";

test("el catálogo canónico contiene 168 perfiles únicos", () => {
  assert.equal(STARTER_MONSTER_CODEX.length, 168);
  assert.equal(new Set(STARTER_MONSTER_CODEX.map((monster) => monster.id)).size, 168);
  assert.equal(STARTER_MONSTER_CODEX.filter((monster) => monster.source === "Libro Básico").length, 37);
  assert.equal(STARTER_MONSTER_CODEX.filter((monster) => monster.source === "Códice de monstruos").length, 131);
  assert.equal(STARTER_MONSTER_CODEX.some((monster) => monster.source.includes("Lote inicial")), false);
});

test("cada arma publicada se conserva como un ataque separado", () => {
  const expectedWeapons = new Map([
    ["libro-basico-elfo-vernal", [["Daga", "3"], ["Arco", "4"]]],
    ["libro-basico-guerrero-barbaro-poblado", [["Hacha", "5"], ["golpe de escudo", "2"], ["lanza arrojadiza", "4"]]],
    ["codice-fusco-cazador", [["Arco", "4"], ["lanza", "4"]]],
    ["codice-manto-negro-veterano", [["Ballesta", "5"], ["Espada", "5"]]],
    ["codice-arquero", [["Arco largo", "5"], ["ballesta", "6"], ["espada", "4"]]],
    ["codice-mocoso-noble", [["Hoja de esgrima", "4"], ["daga de parada", "4"]]]
  ]);

  for (const [id, expected] of expectedWeapons) {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === id);
    assert.ok(monster, id);
    assert.deepEqual(monster.sheet.weapons.map(({ name, damage }) => [name, damage]), expected, id);
  }

  const poisonedBite = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-arak-emponzonador");
  assert.ok(poisonedBite);
  assert.equal(poisonedBite.sheet.weapons.length, 1, "el veneno no debe convertirse en otra arma");
  assert.match(poisonedBite.sheet.weapons[0].details, /veneno 2/i);

  assert.deepEqual(
    parsePublishedWeaponProfiles("Daga 3 (Corta), Arco 4").map(({ name, damage }) => [name, damage]),
    [["Daga", "3"], ["Arco", "4"]]
  );

  for (const monster of STARTER_MONSTER_CODEX) {
    for (const weapon of monster.sheet.weapons) {
      assert.equal(
        parsePublishedWeaponProfiles(weapon.details).length,
        1,
        `${monster.name}: una tarjeta todavía contiene más de un arma (${weapon.details})`
      );
    }
    assert.equal(
      monster.sheet.actions.filter((entry) => entry.startsWith("Armas:")).length,
      monster.sheet.weapons.length,
      `${monster.name}: las acciones y las armas estructuradas deben coincidir`
    );
  }
});

test("conserva completas y sin contaminación las tácticas publicadas de los 168 perfiles", () => {
  const basic = STARTER_MONSTER_CODEX.slice(0, 37);
  assert.equal(new Set(basic.map((monster) => monster.sheet.tactics)).size, 37);

  for (const monster of STARTER_MONSTER_CODEX) {
    assert.ok(monster.sheet.tactics.length >= 20, `${monster.name}: táctica vacía o truncada`);
    assert.doesNotMatch(
      monster.sheet.tactics,
      /Idea de aventura|Nueva regla|H O R D A S|SUTILEZA A D|\bConducta\b|\bRaza\b/,
      `${monster.name}: la táctica contiene texto ajeno a la ficha`
    );
  }

  const elfo = STARTER_MONSTER_CODEX.find((monster) => monster.id === "libro-basico-elfo-vernal");
  assert.equal(
    elfo?.sheet.tactics,
    "Los elfos vernales se suelen mantener a distancia del enemigo y disparar con el arco. Otra estrategia es provocar a sus víctimas para que los sigan hacia trampas o emboscadas de varios tipos."
  );

  const rasgador = STARTER_MONSTER_CODEX.find((monster) => monster.id === "codice-bestiaal-rasgador");
  assert.equal(
    rasgador?.sheet.tactics,
    "Movimiento por el campo de batalla para alcanzar a los arqueros y místicos del enemigo. Una vez han caído estos, se enfrenta a los combatientes cuerpo a cuerpo."
  );

  const retoño = STARTER_MONSTER_CODEX.find((monster) => monster.id === "codice-managaal-retono");
  assert.equal(
    retoño?.sheet.tactics,
    "El retoño trata de beber la sangre de una víctima (a poder ser corrupta). Comienza la escena con 1D4 puntos de corrupción acumulada."
  );
});

test("el Códice conserva sus formatos, familias y referencias", () => {
  const codex = STARTER_MONSTER_CODEX.filter((monster) => monster.source === "Códice de monstruos");
  assert.equal(codex.filter((monster) => monster.sheet.profileFormat === "extended").length, 45);
  assert.equal(codex.filter((monster) => monster.sheet.profileFormat === "compact").length, 86);
  assert.equal(MONSTER_CODEX_FAMILIES.length, 27);
  for (const monster of codex) {
    assert.equal(monster.sheet.sourceReferences.length, 1, monster.name);
    assert.equal(monster.sheet.sourceReferences[0].source, "Códice de monstruos", monster.name);
    assert.ok(monster.sheet.sourceReferences[0].page > 0, monster.name);
    assert.ok(monster.sheet.description.length > 20, monster.name);
    assert.ok(monster.sheet.race, monster.name);
    assert.ok(monster.sheet.publishedThreat, monster.name);
    assert.ok(monster.sheet.shadow, monster.name);
    assert.ok(monster.sheet.tactics, monster.name);
    assert.deepEqual(monsterSheetSchema.parse(monster.sheet), monster.sheet);
  }
});

test("las fichas muestran siempre el desafío calculado por PX", () => {
  for (const monster of STARTER_MONSTER_CODEX) {
    assert.equal(monster.threat, getMonsterCreationChallenge(monster.sheet), monster.name);
  }
});

test("conserva valores representativos de ambos formatos del Códice", () => {
  const arak = STARTER_MONSTER_CODEX.find((monster) => monster.id === "codice-arak-emponzonador");
  assert.ok(arak);
  assert.equal(arak.sheet.attributes.quick, 13);
  assert.equal(arak.sheet.weapons[0].fixedValue, 3);
  assert.equal(arak.sheet.fixedValues.armor, 2);
  assert.equal(arak.sheet.sourceReferences[0].page, 13);

  const dragon = STARTER_MONSTER_CODEX.find((monster) => monster.id === "codice-dragon");
  assert.ok(dragon);
  assert.equal(dragon.sheet.attributes.strong, 18);
  assert.equal(dragon.sheet.publishedThreat, "Mortal");
  assert.equal(dragon.sheet.weapons[0].fixedValue, 17);

  const azote = STARTER_MONSTER_CODEX.find((monster) => monster.id === "codice-azote-de-prios");
  assert.ok(azote);
  assert.equal(azote.sheet.weapons[0].fixedValue, 4);
  assert.equal(azote.sheet.fixedValues.armor, 4);
  assert.match(azote.sheet.description, /Prios|manto/i);

  const kotka = STARTER_MONSTER_CODEX.find((monster) => monster.id === "codice-kotka");
  assert.ok(kotka, "Kotka debe incluirse aunque falte en el índice impreso");
  assert.equal(kotka.sheet.weapons[0].fixedValue, 7);
});

test("mantiene los identificadores publicados del Libro Básico y el orden editorial", () => {
  assert.equal(STARTER_MONSTER_CODEX[0].id, "libro-basico-elfo-vernal");
  assert.equal(STARTER_MONSTER_CODEX[36].id, "libro-basico-moratumbas");
  assert.equal(STARTER_MONSTER_CODEX[37].id, "codice-arak-emponzonador");
  assert.deepEqual(STARTER_MONSTER_CODEX.map((monster) => monster.appearanceOrder), Array.from({ length: 168 }, (_, index) => index));
});
