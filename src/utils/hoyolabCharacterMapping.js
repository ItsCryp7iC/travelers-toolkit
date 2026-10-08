import hoyolabMap from '../data/hoyolabMap.json';
import charactersData from '../data/characters.json';
import weaponsData from '../data/weapons.json';
import travelersData from '../data/traveler.json';

/**
 * These HoYoLAB avatar records are Manekin entities that do not use normal
 * character material progression and are intentionally outside Traveler's Toolkit
 * character planning scope.
 */
export const EXCLUDED_HOYOLAB_CHARACTER_IDS = new Set([
  10000117,
  10000118,
]);

const characterIdMap = new Map();
charactersData.forEach(c => characterIdMap.set(c.id, c));
travelersData.forEach(c => characterIdMap.set(c.id, c));

const weaponIdMap = new Map();
weaponsData.forEach(w => weaponIdMap.set(w.id, w));

/**
 * Normalizes HoYoLAB elements to match Traveler variants.
 */
function normalizeTravelerElement(hoyolabElement) {
  if (!hoyolabElement) return null;
  // HoYoLAB typically returns capitalized element e.g. "Anemo"
  const elem = String(hoyolabElement).trim();
  const valid = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo'];
  if (valid.includes(elem)) return elem;

  // Try case-insensitive matching
  const match = valid.find(v => v.toLowerCase() === elem.toLowerCase());
  return match || null;
}

export function mapHoyolabCharacter(syncCharacter) {
  if (!syncCharacter || !syncCharacter.id) {
    return { status: "unmapped" };
  }

  const hoyolabIdStr = String(syncCharacter.id);
  const mappedId = hoyolabMap.characters[hoyolabIdStr];

  if (!mappedId) {
    return { status: "unmapped" };
  }

  // Handle Traveler specifically
  if (mappedId === "Traveler") {
    const elem = normalizeTravelerElement(syncCharacter.element);
    if (!elem) {
      return { status: "unmapped" };
    }
    const travelerId = `Traveler${elem}`;
    const canonicalChar = characterIdMap.get(travelerId);
    if (!canonicalChar) {
      return { status: "unmapped" };
    }
    return {
      status: "matched",
      hoyolabId: syncCharacter.id,
      canonicalId: canonicalChar.id,
      rosterKey: canonicalChar.name,
      character: canonicalChar
    };
  }

  const canonicalChar = characterIdMap.get(mappedId);
  if (!canonicalChar) {
    return { status: "unmapped" };
  }

  return {
    status: "matched",
    hoyolabId: syncCharacter.id,
    canonicalId: canonicalChar.id,
    rosterKey: canonicalChar.name,
    character: canonicalChar
  };
}

export function mapHoyolabWeapon(syncWeapon) {
  if (!syncWeapon || !syncWeapon.id) {
    return { status: "unmapped" };
  }

  const hoyolabIdStr = String(syncWeapon.id);
  const mappedId = hoyolabMap.weapons[hoyolabIdStr];

  if (!mappedId) {
    return { status: "unmapped" };
  }

  const canonicalWeapon = weaponIdMap.get(mappedId);
  if (!canonicalWeapon) {
    return { status: "unmapped" };
  }

  return {
    status: "matched",
    hoyolabId: syncWeapon.id,
    canonicalId: canonicalWeapon.id,
    weaponName: canonicalWeapon.name,
    weapon: canonicalWeapon
  };
}
