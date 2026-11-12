/**
 * Traveler's Toolkit — Activity Diffing Helpers for Characters and Weapons
 * Authoritative specification: docs/activity-history-architecture.md
 */

import { FieldChange } from './activityTypes';

export interface CharacterScalarFieldConfig {
  key: string;
  label: string;
}

const CHARACTER_SCALAR_FIELDS: CharacterScalarFieldConfig[] = [
  { key: 'level', label: 'Level' },
  { key: 'ascension', label: 'Ascension' },
  { key: 'targetLevel', label: 'Target Level' },
  { key: 'targetAscension', label: 'Target Ascension' },
  { key: 'equippedWeaponId', label: 'Equipped Weapon' },
];

const TALENT_KEYS: Array<{
  key: 'normal' | 'skill' | 'burst';
  field: string;
  label: string;
}> = [
  { key: 'normal', field: 'talents.normal', label: 'Normal Attack' },
  { key: 'skill', field: 'talents.skill', label: 'Elemental Skill' },
  { key: 'burst', field: 'talents.burst', label: 'Elemental Burst' },
];

const TARGET_TALENT_KEYS: Array<{
  key: 'normal' | 'skill' | 'burst';
  field: string;
  label: string;
}> = [
  {
    key: 'normal',
    field: 'targetTalents.normal',
    label: 'Target Normal Attack',
  },
  {
    key: 'skill',
    field: 'targetTalents.skill',
    label: 'Target Elemental Skill',
  },
  {
    key: 'burst',
    field: 'targetTalents.burst',
    label: 'Target Elemental Burst',
  },
];

/**
 * Extracts meaningful persisted progression diffs between two character records.
 * Excludes derived costs (calculatedCosts), transient UI properties, and object references.
 */
export function extractCharacterMeaningfulChanges(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
): FieldChange[] {
  const changes: FieldChange[] = [];
  if (!before && !after) return changes;

  const b = before || {};
  const a = after || {};

  for (const { key, label } of CHARACTER_SCALAR_FIELDS) {
    const valBefore = b[key];
    const valAfter = a[key];
    if (
      valBefore !== valAfter &&
      (valBefore !== undefined || valAfter !== undefined)
    ) {
      const delta =
        typeof valBefore === 'number' && typeof valAfter === 'number'
          ? valAfter - valBefore > 0
            ? `+${valAfter - valBefore}`
            : `${valAfter - valBefore}`
          : undefined;

      changes.push({
        field: key,
        label,
        before: valBefore ?? null,
        after: valAfter ?? null,
        ...(delta !== undefined ? { delta } : {}),
      });
    }
  }

  // Active talents
  const talentsBefore =
    (b.talents as Record<string, unknown> | undefined) || {};
  const talentsAfter = (a.talents as Record<string, unknown> | undefined) || {};
  for (const { key, field, label } of TALENT_KEYS) {
    const valBefore = talentsBefore[key];
    const valAfter = talentsAfter[key];
    if (
      valBefore !== valAfter &&
      (valBefore !== undefined || valAfter !== undefined)
    ) {
      const delta =
        typeof valBefore === 'number' && typeof valAfter === 'number'
          ? valAfter - valBefore > 0
            ? `+${valAfter - valBefore}`
            : `${valAfter - valBefore}`
          : undefined;

      changes.push({
        field,
        label,
        before: valBefore ?? null,
        after: valAfter ?? null,
        ...(delta !== undefined ? { delta } : {}),
      });
    }
  }

  // Target talents
  const targetTalentsBefore =
    (b.targetTalents as Record<string, unknown> | undefined) || {};
  const targetTalentsAfter =
    (a.targetTalents as Record<string, unknown> | undefined) || {};
  for (const { key, field, label } of TARGET_TALENT_KEYS) {
    const valBefore = targetTalentsBefore[key];
    const valAfter = targetTalentsAfter[key];
    if (
      valBefore !== valAfter &&
      (valBefore !== undefined || valAfter !== undefined)
    ) {
      const delta =
        typeof valBefore === 'number' && typeof valAfter === 'number'
          ? valAfter - valBefore > 0
            ? `+${valAfter - valBefore}`
            : `${valAfter - valBefore}`
          : undefined;

      changes.push({
        field,
        label,
        before: valBefore ?? null,
        after: valAfter ?? null,
        ...(delta !== undefined ? { delta } : {}),
      });
    }
  }

  return changes;
}

const WEAPON_SCALAR_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'level', label: 'Level' },
  { key: 'ascension', label: 'Ascension' },
  { key: 'targetLevel', label: 'Target Level' },
  { key: 'targetAscension', label: 'Target Ascension' },
  { key: 'currentRefinement', label: 'Refinement' },
  { key: 'targetRefinement', label: 'Target Refinement' },
  { key: 'hasEventBonus', label: 'Event Weapon Bonus' },
  { key: 'assignedTo', label: 'Assigned To' },
];

/**
 * Extracts meaningful persisted progression diffs between two weapon records.
 * Excludes calculated weapon costs, data objects, and timestamps.
 */
export function extractWeaponMeaningfulChanges(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
): FieldChange[] {
  const changes: FieldChange[] = [];
  if (!before && !after) return changes;

  const b = before || {};
  const a = after || {};

  for (const { key, label } of WEAPON_SCALAR_FIELDS) {
    const valBefore = b[key];
    const valAfter = a[key];
    if (
      valBefore !== valAfter &&
      (valBefore !== undefined || valAfter !== undefined)
    ) {
      const delta =
        typeof valBefore === 'number' && typeof valAfter === 'number'
          ? valAfter - valBefore > 0
            ? `+${valAfter - valBefore}`
            : `${valAfter - valBefore}`
          : undefined;

      changes.push({
        field: key,
        label,
        before: valBefore ?? null,
        after: valAfter ?? null,
        ...(delta !== undefined ? { delta } : {}),
      });
    }
  }

  return changes;
}
