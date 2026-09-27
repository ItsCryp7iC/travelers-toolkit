import charactersData from './characters';
import weaponsData from '../data/weapons.json';
import { getPrimaryInventoryList } from './dataManager';

let materialsLookup = null;

const MATERIAL_ALIASES = {};

export const resolveGoodMaterialKey = (goodKey) => {
  if (!materialsLookup) {
    const materials = getPrimaryInventoryList();
    materialsLookup = new Map();
    materials.forEach(mat => {
      materialsLookup.set(mat.matKey, mat.matKey);
    });
  }

  if (materialsLookup.has(goodKey)) return materialsLookup.get(goodKey);
  if (MATERIAL_ALIASES[goodKey] && materialsLookup.has(MATERIAL_ALIASES[goodKey])) {
    return materialsLookup.get(MATERIAL_ALIASES[goodKey]);
  }
  return null;
};

const CHARACTER_ALIASES = {
  'TravelerAnemo': 'Traveler Anemo',
  'TravelerGeo': 'Traveler Geo',
  'TravelerElectro': 'Traveler Electro',
  'TravelerDendro': 'Traveler Dendro',
  'TravelerHydro': 'Traveler Hydro',
  'TravelerPyro': 'Traveler Pyro',
  'TravelerCryo': 'Traveler Cryo'
};

const normalizeIdentity = (value) => String(value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

let normalizedCharacters = null;
let normalizedWeapons = null;

const buildCharacterMaps = () => {
  if (normalizedCharacters) return;
  normalizedCharacters = new Map();
  charactersData.forEach(c => {
    const norm = normalizeIdentity(c.name);
    if (!normalizedCharacters.has(norm)) {
      normalizedCharacters.set(norm, []);
    }
    normalizedCharacters.get(norm).push(c.name);
  });
};

const buildWeaponMaps = () => {
  if (normalizedWeapons) return;
  normalizedWeapons = new Map();
  weaponsData.forEach(w => {
    const norm = normalizeIdentity(w.name);
    if (!normalizedWeapons.has(norm)) {
      normalizedWeapons.set(norm, []);
    }
    normalizedWeapons.get(norm).push(w.name);
  });
};

export const resolveGoodCharacterKey = (goodKey) => {
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
  const matches = normalizedCharacters.get(normGoodKey);

  if (matches && matches.length === 1) {
    return matches[0];
  }

  return null;
};

export const resolveGoodWeaponKey = (goodKey) => {
  let weapon = weaponsData.find(w => w.id === goodKey);
  if (weapon) return weapon.name;

  let exactMatch = weaponsData.find(w => w.name === goodKey);
  if (exactMatch) return exactMatch.name;

  buildWeaponMaps();
  const normGoodKey = normalizeIdentity(goodKey);
  const matches = normalizedWeapons.get(normGoodKey);

  if (matches && matches.length === 1) {
    return matches[0];
  }

  return null;
};
