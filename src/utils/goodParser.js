import { resolveGoodCharacterKey, resolveGoodWeaponKey, resolveGoodMaterialKey } from './goodIdentity';

const isValidLevel = (lvl) => Number.isInteger(lvl) && lvl >= 1 && lvl <= 90;
const isValidAscension = (asc) => Number.isInteger(asc) && asc >= 0 && asc <= 6;
const isValidTalent = (t) => Number.isInteger(t) && t >= 1 && t <= 15;
const isValidRefinement = (r) => Number.isInteger(r) && r >= 1 && r <= 5;
const isValidQuantity = (q) => Number.isInteger(q) && q >= 0;

export const parseGoodData = (jsonContent) => {
  if (!jsonContent || jsonContent.format !== "GOOD") {
    throw new Error("Invalid GOOD format");
  }

  const parsed = {
    characters: [],
    weapons: [],
    materials: {},
    unresolved: {
      characters: [],
      weapons: [],
      materials: [],
      locations: []
    }
  };

  // Parse Characters
  if (Array.isArray(jsonContent.characters)) {
    jsonContent.characters.forEach((char) => {
      const resolvedName = resolveGoodCharacterKey(char.key);
      if (!resolvedName) {
        parsed.unresolved.characters.push({ key: char.key, reason: 'No matching internal character ID' });
        return;
      }

      const auto = char.talent?.auto ?? 1;
      const skill = char.talent?.skill ?? 1;
      const burst = char.talent?.burst ?? 1;

      if (!isValidLevel(char.level) || !isValidAscension(char.ascension) || !isValidTalent(auto) || !isValidTalent(skill) || !isValidTalent(burst)) {
        parsed.unresolved.characters.push({ key: char.key, reason: 'Invalid level, ascension, or talent values' });
        return;
      }

      parsed.characters.push({
        name: resolvedName,
        level: char.level,
        ascension: char.ascension,
        talents: {
          normal: auto,
          skill: skill,
          burst: burst,
        }
      });
    });
  }

  // Parse Weapons
  if (Array.isArray(jsonContent.weapons)) {
    jsonContent.weapons.forEach((weapon) => {
      const resolvedName = resolveGoodWeaponKey(weapon.key);
      if (!resolvedName) {
        parsed.unresolved.weapons.push({ key: weapon.key, reason: 'No matching internal weapon ID' });
        return;
      }

      if (!isValidLevel(weapon.level) || !isValidAscension(weapon.ascension) || !isValidRefinement(weapon.refinement)) {
        parsed.unresolved.weapons.push({ key: weapon.key, reason: 'Invalid level, ascension, or refinement values' });
        return;
      }

      let resolvedLocation = null;
      if (weapon.location) {
        resolvedLocation = resolveGoodCharacterKey(weapon.location);
        if (!resolvedLocation) {
          parsed.unresolved.locations.push({ key: weapon.location, reason: 'No matching internal character ID for location' });
        }
      }

      parsed.weapons.push({
        weaponName: resolvedName,
        level: weapon.level,
        ascension: weapon.ascension,
        refinement: weapon.refinement,
        location: resolvedLocation,
      });
    });
  }

  // Parse Materials
  if (jsonContent.materials && typeof jsonContent.materials === 'object') {
    Object.entries(jsonContent.materials).forEach(([goodKey, count]) => {
      const resolvedKey = resolveGoodMaterialKey(goodKey);
      if (!resolvedKey) {
        parsed.unresolved.materials.push({ key: goodKey, reason: 'No matching internal material ID' });
        return;
      }

      if (!isValidQuantity(count)) {
        parsed.unresolved.materials.push({ key: goodKey, reason: 'Invalid quantity value' });
        return;
      }

      parsed.materials[resolvedKey] = count;
    });
  }

  return parsed;
};
