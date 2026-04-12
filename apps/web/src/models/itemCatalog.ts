import {
  buildWeaponCatalogNotes,
  WEAPON_QUALITY_OPTIONS,
  WEAPON_TEMPLATES,
  formatWeaponQualities,
  type CharacterSheet
} from "@umbra/shared";

type InventoryItem = CharacterSheet["inventoryItems"][number];

export type ItemTemplate = Omit<InventoryItem, "id" | "quantity" | "equipped"> & {
  templateId: string;
  defaultQuantity?: number;
};

const WEAPON_ITEM_TEMPLATES: ItemTemplate[] = WEAPON_TEMPLATES.map((template) => ({
  templateId: template.templateId,
  name: template.name,
  category: "weapon",
  stackable: template.stackable ?? false,
  isCustom: false,
  description: template.description,
  weight: template.weight,
  value: template.value,
  slot: template.slot,
  attackAttribute: template.attackAttribute,
  damageFormula: template.damageFormula,
  protectionFormula: "",
  qualities: formatWeaponQualities(template.qualities),
  notes: buildWeaponCatalogNotes(template.notes ?? "", template.qualities),
  grantedActions: [],
  modifiers: [],
  defaultQuantity: template.defaultQuantity
}));

const OTHER_ITEM_TEMPLATES: ItemTemplate[] = [
  {
    templateId: "armor-light",
    name: "Armadura ligera",
    category: "armor",
    stackable: false,
    isCustom: false,
    description: "Proteccion ligera de cuero o tejidos reforzados.",
    weight: "Ligera",
    value: "",
    slot: "armor",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "1d4",
    qualities: "Ligera",
    notes: "",
    grantedActions: [],
    modifiers: []
  },
  {
    templateId: "armor-medium",
    name: "Armadura media",
    category: "armor",
    stackable: false,
    isCustom: false,
    description: "Proteccion media para combate sostenido.",
    weight: "Media",
    value: "",
    slot: "armor",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "1d6",
    qualities: "Media, Incomoda",
    notes: "",
    grantedActions: [],
    modifiers: []
  },
  {
    templateId: "armor-heavy",
    name: "Armadura pesada",
    category: "armor",
    stackable: false,
    isCustom: false,
    description: "Proteccion pesada de placas o cota reforzada.",
    weight: "Pesada",
    value: "",
    slot: "armor",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "1d8",
    qualities: "Pesada, Incomoda",
    notes: "",
    grantedActions: [],
    modifiers: []
  },
  {
    templateId: "armor-shield",
    name: "Escudo",
    category: "armor",
    stackable: false,
    isCustom: false,
    description: "Escudo para defensa cercana.",
    weight: "Media",
    value: "",
    slot: "offHand",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "Escudo",
    notes: "",
    grantedActions: [],
    modifiers: [
      { id: "shield-defense", label: "Bonificacion de defensa", modifierType: "defense", value: "+1", notes: "Bonificacion base por llevar escudo." }
    ]
  },
  {
    templateId: "gear-backpack",
    name: "Mochila",
    category: "gear",
    stackable: false,
    isCustom: false,
    description: "Contenedor de viaje.",
    weight: "Ligera",
    value: "",
    slot: "none",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "",
    notes: "",
    grantedActions: [],
    modifiers: []
  },
  {
    templateId: "gear-rations",
    name: "Raciones",
    category: "consumable",
    stackable: true,
    isCustom: false,
    description: "Comida para un dia de viaje.",
    weight: "Ligera",
    value: "",
    slot: "none",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "",
    notes: "",
    grantedActions: [],
    modifiers: [],
    defaultQuantity: 3
  },
  {
    templateId: "gear-torch",
    name: "Antorcha",
    category: "consumable",
    stackable: true,
    isCustom: false,
    description: "Fuente de luz basica.",
    weight: "Ligera",
    value: "",
    slot: "none",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "Luz",
    notes: "",
    grantedActions: [],
    modifiers: [],
    defaultQuantity: 3
  },
  {
    templateId: "gear-rope",
    name: "Cuerda",
    category: "gear",
    stackable: false,
    isCustom: false,
    description: "Cuerda de viaje o escalada.",
    weight: "Media",
    value: "",
    slot: "none",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "",
    notes: "",
    grantedActions: [],
    modifiers: []
  },
  {
    templateId: "consumable-herbs",
    name: "Hierbas curativas",
    category: "consumable",
    stackable: true,
    isCustom: false,
    description: "Material de apoyo para curacion.",
    weight: "Ligera",
    value: "",
    slot: "none",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "",
    notes: "",
    grantedActions: [
      {
        id: "usar-hierbas-curativas",
        label: "Usar hierbas curativas",
        cost: "combat",
        effectSummary: "Aplicar hierbas curativas sobre un objetivo."
      }
    ],
    modifiers: [],
    defaultQuantity: 2
  },
  {
    templateId: "consumable-elixir",
    name: "Elixir",
    category: "consumable",
    stackable: true,
    isCustom: false,
    description: "Consumible alquimico de uso rapido.",
    weight: "Ligera",
    value: "",
    slot: "none",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "Alquimico",
    notes: "",
    grantedActions: [
      {
        id: "usar-elixir",
        label: "Usar elixir",
        cost: "movement",
        effectSummary: "Usar o aplicar el elixir sobre uno mismo o el equipo."
      }
    ],
    modifiers: [],
    defaultQuantity: 1
  },
  {
    templateId: "artifact-generic",
    name: "Artefacto",
    category: "artifact",
    stackable: false,
    isCustom: false,
    description: "Artefacto mistico de origen desconocido.",
    weight: "",
    value: "",
    slot: "artifact",
    attackAttribute: undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "Mistico",
    notes: "",
    grantedActions: [],
    modifiers: []
  }
];

export const ITEM_CATALOG: ItemTemplate[] = [...WEAPON_ITEM_TEMPLATES, ...OTHER_ITEM_TEMPLATES];
export { WEAPON_QUALITY_OPTIONS };

export function createInventoryItemFromTemplate(template: ItemTemplate): InventoryItem {
  return {
    ...template,
    id: `${template.templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    quantity: template.defaultQuantity ?? 1,
    equipped: false
  };
}

export function createCustomInventoryItem(category: InventoryItem["category"] = "gear"): InventoryItem {
  const isWeapon = category === "weapon";
  return {
    id: `custom-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: isWeapon ? "Arma personalizada" : "Objeto personalizado",
    category,
    quantity: 1,
    stackable: false,
    isCustom: true,
    description: "",
    weight: "",
    value: "",
    equipped: false,
    slot: isWeapon ? "mainHand" : "none",
    attackAttribute: isWeapon ? "diestro" : undefined,
    damageFormula: "",
    protectionFormula: "",
    qualities: "",
    notes: "",
    grantedActions: [],
    modifiers: []
  };
}
