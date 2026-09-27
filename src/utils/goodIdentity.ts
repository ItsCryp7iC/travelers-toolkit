import charactersData from './characters';
import weaponsData from '../data/weapons.json';
import { getPrimaryInventoryList } from './dataManager';
import type { MaterialKey, CharacterName, WeaponName } from '../types/domain';

let materialsLookup: Map<string, string> | null = null;

const MATERIAL_ALIASES: Record<string, MaterialKey> = {};

export const resolveGoodMaterialKey = (goodKey: string): MaterialKey | null => {
  if (!materialsLookup) {
    const materials = getPrimaryInventoryList();
    materialsLookup = new Map<string, string>();
    materials.forEach(mat => {
      materialsLookup!.set(mat.matKey, mat.matKey);
    });
  }

  if (materialsLookup.has(goodKey)) return materialsLookup.get(goodKey) as MaterialKey;
  if (MATERIAL_ALIASES[goodKey] && materialsLookup.has(MATERIAL_ALIASES[goodKey])) {
    return materialsLookup.get(MATERIAL_ALIASES[goodKey]) as MaterialKey;
  }
  return null;
};

const CHARACTER_ALIASES: Record<string, CharacterName> = {
  'TravelerAnemo': 'Traveler Anemo',
  'TravelerGeo': 'Traveler Geo',
  'TravelerElectro': 'Traveler Electro',
  'TravelerDendro': 'Traveler Dendro',
  'TravelerHydro': 'Traveler Hydro',
  'TravelerPyro': 'Traveler Pyro',
  'TravelerCryo': 'Traveler Cryo'
};

const normalizeIdentity = (value: unknown): string => String(value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

let normalizedCharacters: Map<string, string[]> | null = null;
let normalizedWeapons: Map<string, string[]> | null = null;

const buildCharacterMaps = () => {
  if (normalizedCharacters) return;
  normalizedCharacters = new Map<string, string[]>();
  charactersData.forEach(c => {
    const norm = normalizeIdentity(c.name);
    if (!normalizedCharacters!.has(norm)) {
      normalizedCharacters!.set(norm, []);
    }
    normalizedCharacters!.get(norm)!.push(c.name);
  });
};

const buildWeaponMaps = () => {
  if (normalizedWeapons) return;
  normalizedWeapons = new Map<string, string[]>();
  weaponsData.forEach(w => {
    const norm = normalizeIdentity(w.name);
    if (!normalizedWeapons!.has(norm)) {
      normalizedWeapons!.set(norm, []);
    }
    normalizedWeapons!.get(norm)!.push(w.name);
  });
};

export const resolveGoodCharacterKey = (goodKey: string): CharacterName | null => {
  let char = charactersData.find(c => c.id === goodKey);
  if (char) return char.name;

  if (CHARACTER_ALIASES[goodKey]) {
    let aliasChar = charactersData.find(c => c.name === CHARACTER_ALIASES[goodKey]);
    if (aliasChar) return aliasChar.name;
  }

  let exactMatch = charactersData.find(c => c.name === goodKey);
  if (exactMatch) return exactMatch.name;

  buildCharacterMaps();
  const normGoodKey = normalizeIdentity(goodKey);
  const matches = normalizedCharacters!.get(normGoodKey);

  if (matches && matches.length === 1) {
    return matches[0];
  }

  return null;
};

export const resolveGoodWeaponKey = (goodKey: string): WeaponName | null => {
  let weapon = weaponsData.find(w => w.id === goodKey);
  if (weapon) return weapon.name;

  let exactMatch = weaponsData.find(w => w.name === goodKey);
  if (exactMatch) return exactMatch.name;

  buildWeaponMaps();
  const normGoodKey = normalizeIdentity(goodKey);
  const matches = normalizedWeapons!.get(normGoodKey);

  if (matches && matches.length === 1) {
    return matches[0];
  }

  return null;
};
