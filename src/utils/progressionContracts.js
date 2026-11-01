/**
 * src/utils/progressionContracts.js
 *
 * Domain-specific progression contracts, validation rules, level-edit semantics,
 * and diagnostic inspection utilities for characters and weapons.
 */

// ─── Character Constants ───────────────────────────────────────────────────
export const CHARACTER_MIN_LEVEL = 1;
export const CHARACTER_MAX_LEVEL = 100; // Supported for Stella Fortuna milestones at 95 and 100
export const CHARACTER_CANONICAL_MAX_LEVEL = 90;
export const CHARACTER_MIN_ASCENSION = 0;
export const CHARACTER_MAX_ASCENSION = 6;
export const CHARACTER_MILESTONES = [20, 40, 50, 60, 70, 80];

// ─── Weapon Constants ──────────────────────────────────────────────────────
export const WEAPON_MIN_LEVEL = 1;
export const WEAPON_STANDARD_MAX_LEVEL = 90; // 3★, 4★, 5★
export const WEAPON_LOW_TIER_MAX_LEVEL = 70; // 1★, 2★
export const WEAPON_MIN_ASCENSION = 0;
export const WEAPON_STANDARD_MAX_ASCENSION = 6;
export const WEAPON_LOW_TIER_MAX_ASCENSION = 4;
export const WEAPON_STANDARD_MILESTONES = [20, 40, 50, 60, 70, 80];
export const WEAPON_LOW_TIER_MILESTONES = [20, 40, 50, 60];

// ─── Rarity Helpers ────────────────────────────────────────────────────────
export function getNumericRarity(rarity) {
  if (rarity == null) return null;
  if (typeof rarity === 'number') return rarity;
  if (typeof rarity === 'string') {
    const starCount = (rarity.match(/★/g) || []).length;
    if (starCount > 0) return starCount;
    const parsed = parseInt(rarity, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

export function isLowTierWeapon(rarity) {
  const r = getNumericRarity(rarity);
  return r === 1 || r === 2;
}

export function getWeaponMaxLevel(rarity) {
  return isLowTierWeapon(rarity) ? WEAPON_LOW_TIER_MAX_LEVEL : WEAPON_STANDARD_MAX_LEVEL;
}

export function getWeaponMaxAscension(rarity) {
  return isLowTierWeapon(rarity) ? WEAPON_LOW_TIER_MAX_ASCENSION : WEAPON_STANDARD_MAX_ASCENSION;
}

export function getWeaponMilestones(rarity) {
  return isLowTierWeapon(rarity) ? WEAPON_LOW_TIER_MILESTONES : WEAPON_STANDARD_MILESTONES;
}

// ─── Character Progression Boundaries ──────────────────────────────────────
export function getValidCharacterAscensions(level) {
  const lv = Number(level);
  if (Number.isNaN(lv) || lv < CHARACTER_MIN_LEVEL || lv > CHARACTER_MAX_LEVEL) return [];
  if (lv < 20) return [0];
  if (lv === 20) return [0, 1];
  if (lv < 40) return [1];
  if (lv === 40) return [1, 2];
  if (lv < 50) return [2];
  if (lv === 50) return [2, 3];
  if (lv < 60) return [3];
  if (lv === 60) return [3, 4];
  if (lv < 70) return [4];
  if (lv === 70) return [4, 5];
  if (lv < 80) return [5];
  if (lv === 80) return [5, 6];
  return [6]; // 81 .. 100
}

export function isCharacterMilestone(level) {
  return CHARACTER_MILESTONES.includes(Number(level));
}

export function getCharacterMinAscensionForLevel(level) {
  const ascs = getValidCharacterAscensions(level);
  return ascs.length > 0 ? ascs[0] : 0;
}

export function getCharacterMaxAscensionForLevel(level) {
  const ascs = getValidCharacterAscensions(level);
  return ascs.length > 0 ? ascs[ascs.length - 1] : 0;
}

export function getCharacterLevelRangeForAscension(ascension) {
  const a = Number(ascension);
  switch (a) {
    case 0: return { min: 1, max: 20 };
    case 1: return { min: 20, max: 40 };
    case 2: return { min: 40, max: 50 };
    case 3: return { min: 50, max: 60 };
    case 4: return { min: 60, max: 70 };
    case 5: return { min: 70, max: 80 };
    case 6: return { min: 80, max: 100 };
    default: return { min: 1, max: 100 };
  }
}

// ─── Weapon Progression Boundaries ─────────────────────────────────────────
export function getValidWeaponAscensions(level, rarity) {
  const lv = Number(level);
  const isLowTier = isLowTierWeapon(rarity);
  const maxLv = isLowTier ? WEAPON_LOW_TIER_MAX_LEVEL : WEAPON_STANDARD_MAX_LEVEL;
  if (Number.isNaN(lv) || lv < WEAPON_MIN_LEVEL || lv > maxLv) return [];

  if (isLowTier) {
    if (lv < 20) return [0];
    if (lv === 20) return [0, 1];
    if (lv < 40) return [1];
    if (lv === 40) return [1, 2];
    if (lv < 50) return [2];
    if (lv === 50) return [2, 3];
    if (lv < 60) return [3];
    if (lv === 60) return [3, 4];
    return [4]; // 61 .. 70
  }

  // Standard 3★, 4★, 5★
  if (lv < 20) return [0];
  if (lv === 20) return [0, 1];
  if (lv < 40) return [1];
  if (lv === 40) return [1, 2];
  if (lv < 50) return [2];
  if (lv === 50) return [2, 3];
  if (lv < 60) return [3];
  if (lv === 60) return [3, 4];
  if (lv < 70) return [4];
  if (lv === 70) return [4, 5];
  if (lv < 80) return [5];
  if (lv === 80) return [5, 6];
  return [6]; // 81 .. 90
}

export function isWeaponMilestone(level, rarity) {
  const milestones = getWeaponMilestones(rarity);
  return milestones.includes(Number(level));
}

export function getWeaponMinAscensionForLevel(level, rarity) {
  const ascs = getValidWeaponAscensions(level, rarity);
  return ascs.length > 0 ? ascs[0] : 0;
}

export function getWeaponMaxAscensionForLevel(level, rarity) {
  const ascs = getValidWeaponAscensions(level, rarity);
  return ascs.length > 0 ? ascs[ascs.length - 1] : 0;
}

export function getWeaponLevelRangeForAscension(ascension, rarity) {
  const a = Number(ascension);
  const isLowTier = isLowTierWeapon(rarity);
  switch (a) {
    case 0: return { min: 1, max: 20 };
    case 1: return { min: 20, max: 40 };
    case 2: return { min: 40, max: 50 };
    case 3: return { min: 50, max: 60 };
    case 4: return { min: 60, max: 70 };
    case 5: return { min: 70, max: 80 };
    case 6: return { min: 80, max: 90 };
    default: return { min: 1, max: isLowTier ? 70 : 90 };
  }
}

// ─── Level-Edit Semantics & Coherent Resolution ─────────────────────────────
/**
 * Resolves a coherent level and ascension pair when the level is changed.
 *
 * Rules:
 * 1. If oldAscension is already compatible with newLevel, PRESERVE IT.
 * 2. If incompatible:
 *    - Clamp oldAscension into [minAscensionForLevel, maxAscensionForLevel].
 *    - At milestone levels where two phases are valid:
 *      - If role === 'target' and oldAscension exceeded the cap, select post-ascension (maxAsc).
 *      - If role === 'current' and oldAscension was below the milestone, select pre-ascension (minAsc).
 * 3. Never mutates input arguments.
 */
export function resolveCoherentProgression(newLevel, oldAscension, type = 'character', rarity = null, role = 'current') {
  const isChar = type === 'character';
  const maxLevel = isChar ? CHARACTER_MAX_LEVEL : getWeaponMaxLevel(rarity);
  const clampedLevel = Math.max(1, Math.min(maxLevel, Number(newLevel) || 1));

  const validAscs = isChar
    ? getValidCharacterAscensions(clampedLevel)
    : getValidWeaponAscensions(clampedLevel, rarity);

  const numOldAsc = oldAscension != null ? Number(oldAscension) : null;

  // Rule 1: Preserve existing ascension if it remains valid
  if (numOldAsc != null && validAscs.includes(numOldAsc)) {
    return { level: clampedLevel, ascension: numOldAsc };
  }

  // Rule 2: Derive deterministic compatible ascension
  const minAsc = validAscs[0] ?? 0;
  const maxAsc = validAscs[validAscs.length - 1] ?? 0;

  let chosenAsc;
  if (numOldAsc != null) {
    if (numOldAsc < minAsc) {
      chosenAsc = minAsc;
    } else if (numOldAsc > maxAsc) {
      chosenAsc = maxAsc;
    } else {
      chosenAsc = minAsc;
    }
  } else {
    chosenAsc = role === 'target' ? maxAsc : minAsc;
  }

  return { level: clampedLevel, ascension: chosenAsc };
}

// ─── Structured Diagnostic & Validation Utilities ──────────────────────────
/**
 * Validates a single level and ascension combination.
 * Returns structured diagnostic details without modifying input.
 */
export function validateLevelAscension(level, ascension, type = 'character', rarity = null) {
  const isChar = type === 'character';
  const maxLevel = isChar ? CHARACTER_MAX_LEVEL : getWeaponMaxLevel(rarity);

  if (level == null || ascension == null) {
    return {
      isValid: false,
      status: 'missing',
      entityType: type,
      level,
      ascension,
      reason: level == null && ascension == null
        ? 'Both level and ascension are missing'
        : (level == null ? 'Level is missing' : 'Ascension is missing'),
      allowedAscensions: [],
      validLevelRange: { min: 1, max: maxLevel },
      isUnambiguous: false,
      requiresHumanInput: true,
    };
  }

  const numLv = Number(level);
  const numAsc = Number(ascension);

  if (Number.isNaN(numLv) || numLv < 1 || numLv > maxLevel) {
    return {
      isValid: false,
      status: 'invalid',
      entityType: type,
      level,
      ascension,
      reason: Number.isNaN(numLv) ? `Level ${level} is not a valid number` : `Level ${level} is out of valid range (1–${maxLevel})`,
      allowedAscensions: [],
      validLevelRange: { min: 1, max: maxLevel },
      isUnambiguous: false,
      requiresHumanInput: true,
    };
  }

  if (Number.isNaN(numAsc)) {
    return {
      isValid: false,
      status: 'invalid',
      entityType: type,
      level: numLv,
      ascension,
      reason: `Ascension ${ascension} is not a valid number`,
      allowedAscensions: [],
      validLevelRange: { min: 1, max: maxLevel },
      isUnambiguous: false,
      requiresHumanInput: true,
    };
  }

  const allowedAscensions = isChar
    ? getValidCharacterAscensions(numLv)
    : getValidWeaponAscensions(numLv, rarity);

  if (!allowedAscensions.includes(numAsc)) {
    const isUnambiguous = allowedAscensions.length === 1;
    return {
      isValid: false,
      status: 'invalid',
      entityType: type,
      level: numLv,
      ascension: numAsc,
      reason: `Ascension ${numAsc} is invalid for level ${numLv}. Allowed ascensions: ${allowedAscensions.join(', ')}`,
      allowedAscensions,
      validLevelRange: isChar
        ? getCharacterLevelRangeForAscension(numAsc)
        : getWeaponLevelRangeForAscension(numAsc, rarity),
      isUnambiguous,
      requiresHumanInput: !isUnambiguous,
      suggestedAscension: isUnambiguous ? allowedAscensions[0] : undefined,
    };
  }

  return {
    isValid: true,
    status: 'valid',
    entityType: type,
    level: numLv,
    ascension: numAsc,
    allowedAscensions,
    validLevelRange: { min: 1, max: maxLevel },
    isUnambiguous: true,
    requiresHumanInput: false,
  };
}

/**
 * Validates current-to-target ordering.
 */
export function validateProgressionOrdering(fromLevel, fromAsc, toLevel, toAsc) {
  if (fromLevel == null || toLevel == null) {
    return { isValid: false, reason: 'Level values missing for ordering validation' };
  }
  const fL = Number(fromLevel);
  const tL = Number(toLevel);
  const fA = fromAsc != null ? Number(fromAsc) : 0;
  const tA = toAsc != null ? Number(toAsc) : 0;

  if (fL > tL) {
    return {
      isValid: false,
      reason: `Target level (${tL}) cannot be lower than current level (${fL})`
    };
  }
  if (fL === tL && fA > tA) {
    return {
      isValid: false,
      reason: `Target ascension (A${tA}) cannot be lower than current ascension (A${fA}) at level ${fL}`
    };
  }
  return { isValid: true };
}

// ─── Store Patch Normalizers ───────────────────────────────────────────────
/**
 * Normalizes a character patch before store mutation.
 * Guarantees that:
 * - Unrelated updates (e.g. equippedWeaponId, notes) pass through unmodified.
 * - Explicit level updates coherently adjust ascension when incompatible.
 * - Explicit ascension updates clamp level when incompatible.
 * - Changing target cannot lower current; changing current pushes target if exceeded.
 */
export function normalizeCharacterPatch(existing, patch) {
  if (!patch || typeof patch !== 'object') return patch;

  const hasLevel = 'level' in patch;
  const hasAscension = 'ascension' in patch;
  const hasTargetLevel = 'targetLevel' in patch;
  const hasTargetAscension = 'targetAscension' in patch;

  // Preserve unrelated updates without touching existing progression fields
  if (!hasLevel && !hasAscension && !hasTargetLevel && !hasTargetAscension) {
    return patch;
  }

  const normalized = { ...patch };

  // 1. Current progression
  if (hasLevel || hasAscension) {
    const rawL = hasLevel ? patch.level : existing?.level;
    const rawA = hasAscension ? patch.ascension : existing?.ascension;

    if (hasLevel && !hasAscension) {
      const coherent = resolveCoherentProgression(rawL, existing?.ascension, 'character', null, 'current');
      normalized.level = coherent.level;
      normalized.ascension = coherent.ascension;
    } else if (!hasLevel && hasAscension) {
      if (!getValidCharacterAscensions(rawL).includes(rawA)) {
        const range = getCharacterLevelRangeForAscension(rawA);
        normalized.level = Math.max(range.min, Math.min(range.max, rawL ?? range.min));
      }
    } else {
      const validAscs = getValidCharacterAscensions(rawL);
      if (!validAscs.includes(rawA)) {
        const coherent = resolveCoherentProgression(rawL, rawA, 'character', null, 'current');
        normalized.level = coherent.level;
        normalized.ascension = coherent.ascension;
      }
    }
  }

  // 2. Target progression
  if (hasTargetLevel || hasTargetAscension) {
    const rawTargetL = hasTargetLevel ? patch.targetLevel : existing?.targetLevel;
    const rawTargetA = hasTargetAscension ? patch.targetAscension : existing?.targetAscension;

    if (hasTargetLevel && !hasTargetAscension) {
      const coherent = resolveCoherentProgression(rawTargetL, existing?.targetAscension, 'character', null, 'target');
      normalized.targetLevel = coherent.level;
      normalized.targetAscension = coherent.ascension;
    } else if (!hasTargetLevel && hasTargetAscension) {
      if (!getValidCharacterAscensions(rawTargetL).includes(rawTargetA)) {
        const range = getCharacterLevelRangeForAscension(rawTargetA);
        normalized.targetLevel = Math.max(range.min, Math.min(range.max, rawTargetL ?? range.min));
      }
    } else {
      const validAscs = getValidCharacterAscensions(rawTargetL);
      if (!validAscs.includes(rawTargetA)) {
        const coherent = resolveCoherentProgression(rawTargetL, rawTargetA, 'character', null, 'target');
        normalized.targetLevel = coherent.level;
        normalized.targetAscension = coherent.ascension;
      }
    }
  }

  // 3. Ordering enforcement: Target >= Current
  const curL = 'level' in normalized ? normalized.level : existing?.level;
  const curA = 'ascension' in normalized ? normalized.ascension : existing?.ascension;
  const tgtL = 'targetLevel' in normalized ? normalized.targetLevel : existing?.targetLevel;
  const tgtA = 'targetAscension' in normalized ? normalized.targetAscension : existing?.targetAscension;

  if (curL != null && tgtL != null) {
    if (hasLevel || hasAscension) {
      if (curL > tgtL || (curL === tgtL && curA > tgtA)) {
        normalized.targetLevel = curL;
        normalized.targetAscension = curA;
      }
    }
    if (hasTargetLevel || hasTargetAscension) {
      const effectiveTgtL = 'targetLevel' in normalized ? normalized.targetLevel : tgtL;
      const effectiveTgtA = 'targetAscension' in normalized ? normalized.targetAscension : tgtA;
      if (effectiveTgtL < curL) {
        normalized.targetLevel = curL;
        normalized.targetAscension = curA;
      } else if (effectiveTgtL === curL && effectiveTgtA < curA) {
        normalized.targetAscension = curA;
      }
    }
  }

  return normalized;
}

/**
 * Normalizes a weapon patch before store mutation.
 */
export function normalizeWeaponPatch(existing, patch, rarity = null) {
  if (!patch || typeof patch !== 'object') return patch;

  const hasLevel = 'level' in patch;
  const hasAscension = 'ascension' in patch;
  const hasTargetLevel = 'targetLevel' in patch;
  const hasTargetAscension = 'targetAscension' in patch;

  // Preserve unrelated updates without touching existing progression fields
  if (!hasLevel && !hasAscension && !hasTargetLevel && !hasTargetAscension) {
    return patch;
  }

  const normalized = { ...patch };

  // 1. Current progression
  if (hasLevel || hasAscension) {
    const rawL = hasLevel ? patch.level : existing?.level;
    const rawA = hasAscension ? patch.ascension : existing?.ascension;

    if (hasLevel && !hasAscension) {
      const coherent = resolveCoherentProgression(rawL, existing?.ascension, 'weapon', rarity, 'current');
      normalized.level = coherent.level;
      normalized.ascension = coherent.ascension;
    } else if (!hasLevel && hasAscension) {
      if (!getValidWeaponAscensions(rawL, rarity).includes(rawA)) {
        const range = getWeaponLevelRangeForAscension(rawA, rarity);
        normalized.level = Math.max(range.min, Math.min(range.max, rawL ?? range.min));
      }
    } else {
      const validAscs = getValidWeaponAscensions(rawL, rarity);
      if (!validAscs.includes(rawA)) {
        const coherent = resolveCoherentProgression(rawL, rawA, 'weapon', rarity, 'current');
        normalized.level = coherent.level;
        normalized.ascension = coherent.ascension;
      }
    }
  }

  // 2. Target progression
  if (hasTargetLevel || hasTargetAscension) {
    const rawTargetL = hasTargetLevel ? patch.targetLevel : existing?.targetLevel;
    const rawTargetA = hasTargetAscension ? patch.targetAscension : existing?.targetAscension;

    if (hasTargetLevel && !hasTargetAscension) {
      const coherent = resolveCoherentProgression(rawTargetL, existing?.targetAscension, 'weapon', rarity, 'target');
      normalized.targetLevel = coherent.level;
      normalized.targetAscension = coherent.ascension;
    } else if (!hasTargetLevel && hasTargetAscension) {
      if (!getValidWeaponAscensions(rawTargetL, rarity).includes(rawTargetA)) {
        const range = getWeaponLevelRangeForAscension(rawTargetA, rarity);
        normalized.targetLevel = Math.max(range.min, Math.min(range.max, rawTargetL ?? range.min));
      }
    } else {
      const validAscs = getValidWeaponAscensions(rawTargetL, rarity);
      if (!validAscs.includes(rawTargetA)) {
        const coherent = resolveCoherentProgression(rawTargetL, rawTargetA, 'weapon', rarity, 'target');
        normalized.targetLevel = coherent.level;
        normalized.targetAscension = coherent.ascension;
      }
    }
  }

  // 3. Ordering enforcement: Target >= Current
  const curL = 'level' in normalized ? normalized.level : existing?.level;
  const curA = 'ascension' in normalized ? normalized.ascension : existing?.ascension;
  const tgtL = 'targetLevel' in normalized ? normalized.targetLevel : existing?.targetLevel;
  const tgtA = 'targetAscension' in normalized ? normalized.targetAscension : existing?.targetAscension;

  if (curL != null && tgtL != null) {
    if (hasLevel || hasAscension) {
      if (curL > tgtL || (curL === tgtL && curA > tgtA)) {
        normalized.targetLevel = curL;
        normalized.targetAscension = curA;
      }
    }
    if (hasTargetLevel || hasTargetAscension) {
      const effectiveTgtL = 'targetLevel' in normalized ? normalized.targetLevel : tgtL;
      const effectiveTgtA = 'targetAscension' in normalized ? normalized.targetAscension : tgtA;
      if (effectiveTgtL < curL) {
        normalized.targetLevel = curL;
        normalized.targetAscension = curA;
      } else if (effectiveTgtL === curL && effectiveTgtA < curA) {
        normalized.targetAscension = curA;
      }
    }
  }

  return normalized;
}

// ─── Read-Only Diagnostic Functions for Existing Records ───────────────────
export function diagnoseCharacterRecord(name, entry) {
  const issues = [];
  if (!entry || typeof entry !== 'object') {
    return [{
      entityType: 'character',
      entityName: name,
      entityIdentifier: name,
      scope: 'record',
      currentLevel: null,
      currentAscension: null,
      targetLevel: null,
      targetAscension: null,
      status: 'invalid',
      reason: `Character record '${name}' is missing or malformed`,
      validAllowedRanges: {
        allowedAscensions: [],
        levelRange: { min: CHARACTER_MIN_LEVEL, max: CHARACTER_MAX_LEVEL },
      },
      isUnambiguous: false,
      requiresHumanInput: true,
    }];
  }

  const currentVal = validateLevelAscension(entry.level, entry.ascension, 'character');
  if (!currentVal.isValid) {
    issues.push({
      entityType: 'character',
      entityName: name,
      entityIdentifier: name,
      scope: 'current',
      level: entry.level,
      ascension: entry.ascension,
      currentLevel: entry.level,
      currentAscension: entry.ascension,
      targetLevel: entry.targetLevel,
      targetAscension: entry.targetAscension,
      status: currentVal.status,
      reason: currentVal.reason,
      validAllowedRanges: {
        allowedAscensions: currentVal.allowedAscensions,
        levelRange: currentVal.validLevelRange,
      },
      isUnambiguous: currentVal.isUnambiguous,
      requiresHumanInput: currentVal.requiresHumanInput,
      suggestedCorrection: currentVal.isUnambiguous
        ? { level: entry.level, ascension: currentVal.suggestedAscension }
        : undefined,
    });
  }

  const targetVal = validateLevelAscension(entry.targetLevel, entry.targetAscension, 'character');
  if (!targetVal.isValid) {
    issues.push({
      entityType: 'character',
      entityName: name,
      entityIdentifier: name,
      scope: 'target',
      level: entry.targetLevel,
      ascension: entry.targetAscension,
      currentLevel: entry.level,
      currentAscension: entry.ascension,
      targetLevel: entry.targetLevel,
      targetAscension: entry.targetAscension,
      status: targetVal.status,
      reason: targetVal.reason,
      validAllowedRanges: {
        allowedAscensions: targetVal.allowedAscensions,
        levelRange: targetVal.validLevelRange,
      },
      isUnambiguous: targetVal.isUnambiguous,
      requiresHumanInput: targetVal.requiresHumanInput,
      suggestedCorrection: targetVal.isUnambiguous
        ? { targetLevel: entry.targetLevel, targetAscension: targetVal.suggestedAscension }
        : undefined,
    });
  }

  if (currentVal.isValid && targetVal.isValid) {
    const ordering = validateProgressionOrdering(entry.level, entry.ascension, entry.targetLevel, entry.targetAscension);
    if (!ordering.isValid) {
      issues.push({
        entityType: 'character',
        entityName: name,
        entityIdentifier: name,
        scope: 'ordering',
        level: entry.level,
        ascension: entry.ascension,
        currentLevel: entry.level,
        currentAscension: entry.ascension,
        targetLevel: entry.targetLevel,
        targetAscension: entry.targetAscension,
        status: 'invalid',
        reason: ordering.reason,
        validAllowedRanges: {
          allowedAscensions: [],
          levelRange: { min: entry.level, max: CHARACTER_MAX_LEVEL },
        },
        isUnambiguous: false,
        requiresHumanInput: true,
      });
    }
  }

  return issues;
}

export function diagnoseWeaponRecord(weapon, weaponData = null) {
  const issues = [];
  if (!weapon || typeof weapon !== 'object') {
    return [{
      entityType: 'weapon',
      entityName: 'Unknown Weapon',
      entityIdentifier: 'unknown',
      scope: 'record',
      currentLevel: null,
      currentAscension: null,
      targetLevel: null,
      targetAscension: null,
      status: 'invalid',
      reason: 'Weapon record is missing or malformed',
      validAllowedRanges: {
        allowedAscensions: [],
        levelRange: { min: WEAPON_MIN_LEVEL, max: WEAPON_STANDARD_MAX_LEVEL },
      },
      isUnambiguous: false,
      requiresHumanInput: true,
    }];
  }

  const rarity = weaponData?.rarity || weapon?.rarity;
  const weaponName = weapon.weaponName || weapon.name || weapon.id || 'Unknown Weapon';
  const weaponId = weapon.id || weapon.weaponName || 'Unknown Weapon';

  const currentVal = validateLevelAscension(weapon.level, weapon.ascension, 'weapon', rarity);
  if (!currentVal.isValid) {
    issues.push({
      entityType: 'weapon',
      entityName: weaponName,
      entityIdentifier: weaponId,
      scope: 'current',
      level: weapon.level,
      ascension: weapon.ascension,
      currentLevel: weapon.level,
      currentAscension: weapon.ascension,
      targetLevel: weapon.targetLevel,
      targetAscension: weapon.targetAscension,
      status: currentVal.status,
      reason: currentVal.reason,
      validAllowedRanges: {
        allowedAscensions: currentVal.allowedAscensions,
        levelRange: currentVal.validLevelRange,
      },
      isUnambiguous: currentVal.isUnambiguous,
      requiresHumanInput: currentVal.requiresHumanInput,
      suggestedCorrection: currentVal.isUnambiguous
        ? { level: weapon.level, ascension: currentVal.suggestedAscension }
        : undefined,
    });
  }

  const targetVal = validateLevelAscension(weapon.targetLevel, weapon.targetAscension, 'weapon', rarity);
  if (!targetVal.isValid) {
    issues.push({
      entityType: 'weapon',
      entityName: weaponName,
      entityIdentifier: weaponId,
      scope: 'target',
      level: weapon.targetLevel,
      ascension: weapon.targetAscension,
      currentLevel: weapon.level,
      currentAscension: weapon.ascension,
      targetLevel: weapon.targetLevel,
      targetAscension: weapon.targetAscension,
      status: targetVal.status,
      reason: targetVal.reason,
      validAllowedRanges: {
        allowedAscensions: targetVal.allowedAscensions,
        levelRange: targetVal.validLevelRange,
      },
      isUnambiguous: targetVal.isUnambiguous,
      requiresHumanInput: targetVal.requiresHumanInput,
      suggestedCorrection: targetVal.isUnambiguous
        ? { targetLevel: weapon.targetLevel, targetAscension: targetVal.suggestedAscension }
        : undefined,
    });
  }

  if (currentVal.isValid && targetVal.isValid) {
    const ordering = validateProgressionOrdering(weapon.level, weapon.ascension, weapon.targetLevel, weapon.targetAscension);
    if (!ordering.isValid) {
      issues.push({
        entityType: 'weapon',
        entityName: weaponName,
        entityIdentifier: weaponId,
        scope: 'ordering',
        level: weapon.level,
        ascension: weapon.ascension,
        currentLevel: weapon.level,
        currentAscension: weapon.ascension,
        targetLevel: weapon.targetLevel,
        targetAscension: weapon.targetAscension,
        status: 'invalid',
        reason: ordering.reason,
        validAllowedRanges: {
          allowedAscensions: [],
          levelRange: { min: weapon.level, max: getWeaponMaxLevel(rarity) },
        },
        isUnambiguous: false,
        requiresHumanInput: true,
      });
    }
  }

  return issues;
}

export function diagnoseRoster(roster) {
  if (!roster || typeof roster !== 'object') return [];
  const issues = [];
  Object.entries(roster).forEach(([name, entry]) => {
    issues.push(...diagnoseCharacterRecord(name, entry));
  });
  return issues;
}

export function diagnoseTrackedWeapons(trackedWeapons, weaponsData = []) {
  if (!Array.isArray(trackedWeapons)) return [];
  const issues = [];
  const seenIds = new Set();
  const weaponMap = new Map((weaponsData || []).map((w) => [w.name, w]));

  trackedWeapons.forEach((w) => {
    if (!w || typeof w !== 'object') {
      issues.push(...diagnoseWeaponRecord(w, null));
      return;
    }
    if (w.id) {
      if (seenIds.has(w.id)) {
        issues.push({
          entityType: 'weapon',
          entityName: w.weaponName || w.name || w.id,
          entityIdentifier: w.id,
          scope: 'identity',
          currentLevel: w.level,
          currentAscension: w.ascension,
          targetLevel: w.targetLevel,
          targetAscension: w.targetAscension,
          status: 'invalid',
          reason: `Duplicate tracked weapon UUID: ${w.id}`,
          validAllowedRanges: { allowedAscensions: [], levelRange: { min: 1, max: 90 } },
          isUnambiguous: false,
          requiresHumanInput: true,
        });
      } else {
        seenIds.add(w.id);
      }
    }
    const wData = weaponMap.get(w.weaponName) || w.data;
    issues.push(...diagnoseWeaponRecord(w, wData));
  });
  return issues;
}

export function diagnoseProgressionState({ roster, trackedWeapons, weaponsData = [] } = {}) {
  const characterIssues = diagnoseRoster(roster);
  const weaponIssues = diagnoseTrackedWeapons(trackedWeapons, weaponsData);
  const issuesCount = characterIssues.length + weaponIssues.length;

  const totalCharacters = roster && typeof roster === 'object' ? Object.keys(roster).length : 0;
  const totalWeapons = Array.isArray(trackedWeapons) ? trackedWeapons.length : 0;
  const totalScanned = totalCharacters + totalWeapons;

  // Group issues by entity record
  const characterRecordsMap = new Map();
  if (roster && typeof roster === 'object') {
    Object.entries(roster).forEach(([name, entry]) => {
      const recIssues = characterIssues.filter((i) => i.entityIdentifier === name);
      if (recIssues.length > 0) {
        characterRecordsMap.set(name, {
          id: name,
          name,
          type: 'character',
          entry,
          currentLevel: entry?.level,
          currentAscension: entry?.ascension,
          targetLevel: entry?.targetLevel,
          targetAscension: entry?.targetAscension,
          issues: recIssues,
          hasCurrentIssue: recIssues.some((i) => i.scope === 'current'),
          hasTargetIssue: recIssues.some((i) => i.scope === 'target'),
          hasOrderingIssue: recIssues.some((i) => i.scope === 'ordering'),
          hasRecordIssue: recIssues.some((i) => i.scope === 'record'),
          isAmbiguous: recIssues.some((i) => i.requiresHumanInput || !i.isUnambiguous),
        });
      }
    });
  }

  const weaponRecordsMap = new Map();
  if (Array.isArray(trackedWeapons)) {
    trackedWeapons.forEach((w, idx) => {
      if (!w || typeof w !== 'object') {
        const dummyKey = `invalid_weapon_record_${idx}`;
        const recIssues = weaponIssues.filter((i) => i.scope === 'record');
        weaponRecordsMap.set(dummyKey, {
          id: dummyKey,
          name: 'Malformed Weapon Record',
          type: 'weapon',
          entry: w,
          currentLevel: null,
          currentAscension: null,
          targetLevel: null,
          targetAscension: null,
          issues: recIssues.length > 0 ? recIssues : [{
            entityType: 'weapon',
            entityName: 'Malformed Weapon Record',
            entityIdentifier: dummyKey,
            scope: 'record',
            reason: 'Weapon record is missing or malformed',
            status: 'invalid',
            validAllowedRanges: { allowedAscensions: [], levelRange: { min: 1, max: 90 } },
            isUnambiguous: false,
            requiresHumanInput: true,
          }],
          hasRecordIssue: true,
          isAmbiguous: true,
        });
        return;
      }
      const wid = w.id || w.weaponName || `weapon_${idx}`;
      const recIssues = weaponIssues.filter((i) => i.entityIdentifier === wid);
      if (recIssues.length > 0) {
        const key = w.id ? `${w.id}_${idx}` : wid;
        weaponRecordsMap.set(key, {
          id: w.id || wid,
          name: w.weaponName || w.name || 'Unknown Weapon',
          type: 'weapon',
          entry: w,
          currentLevel: w.level,
          currentAscension: w.ascension,
          targetLevel: w.targetLevel,
          targetAscension: w.targetAscension,
          issues: recIssues,
          hasCurrentIssue: recIssues.some((i) => i.scope === 'current'),
          hasTargetIssue: recIssues.some((i) => i.scope === 'target'),
          hasOrderingIssue: recIssues.some((i) => i.scope === 'ordering'),
          hasIdentityIssue: recIssues.some((i) => i.scope === 'identity'),
          hasRecordIssue: recIssues.some((i) => i.scope === 'record'),
          isAmbiguous: recIssues.some((i) => i.requiresHumanInput || !i.isUnambiguous),
        });
      }
    });
  }

  const invalidCharacters = Array.from(characterRecordsMap.values());
  const invalidWeapons = Array.from(weaponRecordsMap.values());
  const invalidRecords = [...invalidCharacters, ...invalidWeapons];

  const invalidCharactersCount = invalidCharacters.length;
  const invalidWeaponsCount = invalidWeapons.length;
  const invalidRecordsCount = invalidRecords.length;
  const validRecordsCount = Math.max(0, totalScanned - invalidRecordsCount);

  return {
    isValid: issuesCount === 0,
    issuesCount,
    characterIssues,
    weaponIssues,
    characterIssuesCount: characterIssues.length,
    weaponIssuesCount: weaponIssues.length,
    totalCharacters,
    totalWeapons,
    totalScanned,
    invalidCharacters,
    invalidWeapons,
    invalidRecords,
    invalidCharactersCount,
    invalidWeaponsCount,
    invalidRecordsCount,
    validRecordsCount,
  };
}
