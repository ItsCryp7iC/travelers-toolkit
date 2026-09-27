/**
 * Core primitive aliases
 */
export type CharacterLevel = number;
export type AscensionLevel = number;
export type TalentLevel = number;
export type RefinementLevel = number;
export type MaterialKey = string;
export type CharacterName = string;
export type WeaponName = string;
export type TrackedWeaponId = string;

/**
 * Talent levels representation
 */
export interface TalentLevels {
  normal: TalentLevel;
  skill: TalentLevel;
  burst: TalentLevel;
}

/**
 * A map representing material costs
 */
export type CostMap = Record<MaterialKey, number>;

export interface CharacterCalculatedCosts {
  ascCosts: CostMap;
  talentCosts: CostMap;
}

export type WeaponCalculatedCosts = Record<string, number | boolean | string | null | undefined>;

/**
 * Roster Entry represents a character currently saved in the user's toolkit.
 * It contains levels, ascension, talents and their target equivalents.
 */
export interface RosterEntry {
  level: CharacterLevel;
  ascension: AscensionLevel;
  targetLevel: CharacterLevel;
  targetAscension: AscensionLevel;
  talents: TalentLevels;
  targetTalents: TalentLevels;
  equippedWeaponId: TrackedWeaponId | null;
  tracked: boolean;
  calculatedCosts: CharacterCalculatedCosts | null;
}

/**
 * Roster map keyed by character name.
 */
export type Roster = Record<CharacterName, RosterEntry>;

/**
 * Inventory mapping of material ID to quantity.
 * Note: Quantity can historically be negative.
 */
export type Inventory = Record<MaterialKey, number>;

/**
 * TrackedWeapon represents a weapon assigned to the armory.
 * `createdAt` and `weapon_id` might be missing in historical migrated state.
 * `costs` might be undefined if not yet calculated.
 * `assignedTo` is the character name, or null if unassigned.
 */
export interface TrackedWeapon {
  id: TrackedWeaponId;
  weapon_id?: string; // The normalized ID string, historically optional
  weaponName: WeaponName;
  level: CharacterLevel;
  ascension: AscensionLevel;
  targetLevel: CharacterLevel;
  targetAscension: AscensionLevel;
  currentRefinement?: RefinementLevel;
  targetRefinement?: RefinementLevel;
  assignedTo: CharacterName | null;
  createdAt?: number; // Historically optional
  costs?: WeaponCalculatedCosts;
  hasEventBonus?: boolean;
}

/**
 * PersistedStore represents the slice of Zustand state that gets serialized to localStorage.
 */
export interface PersistedStore {
  roster: Roster;
  trackedWeapons: TrackedWeapon[];
  inventory: Inventory;
  goals: unknown[];
  resinCount: number;
  resinTimestamp: number;
  serverRegion: string;
  showDbBuilder: boolean;
  autoBackupEnabled: boolean;
}
