import { getOwnedQty } from "./inventoryUtils";

export const CURRENCY_EXP_CONFIG = [
  {
    key: "mora",
    id: "Mora",
    displayName: "Mora",
    domainName: "Common Currencies",
    folder: "others",
    rarity: 3,
  },
  {
    key: "heroWits",
    id: "HerosWit",
    displayName: "Hero's Wit",
    domainName: "Character EXP",
    folder: "experience",
    rarity: 4,
  },
  {
    key: "mysticOre",
    id: "MysticEnhancementOre",
    displayName: "Mystic Enhancement Ore",
    domainName: "Weapon EXP",
    folder: "experience",
    rarity: 3,
  },
  {
    key: "crown",
    id: "CrownOfInsight",
    displayName: "Crown of Insight",
    domainName: "Character Talent Materials",
    folder: "others",
    rarity: 5,
  },
  {
    key: "stellaFortuna",
    id: "MasterlessStellaFortuna",
    displayName: "Masterless Stella Fortuna",
    domainName: "Character Awakening Materials",
    folder: "others",
    rarity: 5,
  },
];

export function buildCurrencyExpItems(toFarm, inventory) {
  return CURRENCY_EXP_CONFIG.map(config => {
    const item = toFarm[config.key] ?? {
      name: config.id,
      required: 0,
      owned: getOwnedQty(inventory, config.id),
      toFarm: 0,
      rarity: config.rarity,
    };

    return {
      config,
      item,
    };
  });
}
