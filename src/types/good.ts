import type { CharacterLevel, AscensionLevel, TalentLevels, CharacterName, WeaponName } from './domain';

/**
 * GoodCharacterEntry represents a single character record imported via the GOOD format.
 */
export interface GoodCharacterEntry {
  name: CharacterName;
  level: CharacterLevel;
  ascension: AscensionLevel;
  talents: TalentLevels;
}

/**
 * GoodWeaponEntry represents a single weapon record imported via the GOOD format.
 */
export interface GoodWeaponEntry {
  weaponName: WeaponName;
  level: CharacterLevel;
  ascension: AscensionLevel;
  location: CharacterName | null;
}

/**
 * NormalizedGoodPayload represents the payload that has been passed through the parser
 * and is ready for store integration.
 */
export interface NormalizedGoodPayload {
  characters?: GoodCharacterEntry[];
  weapons?: GoodWeaponEntry[];
  materials?: Record<string, number>;
}
