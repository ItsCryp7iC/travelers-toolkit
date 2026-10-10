import charactersData from '../../utils/characters';
import { calculateProgressionCost, calculateAllTalentsCost } from '../../utils/calculator';

export const recalculateCharacterCosts = (name, charEntry) => {
  const charData = charactersData.find(c => c.name === name);
  if (charData) {
    const ascCosts = calculateProgressionCost(
      charData,
      charEntry.level || 1,
      charEntry.targetLevel || 90,
      charEntry.ascension ?? 0,
      charEntry.targetAscension ?? 6
    );
    const talentCosts = calculateAllTalentsCost(charData, {
      auto: { current: charEntry.talents?.normal || 1, target: charEntry.targetTalents?.normal || 10 },
      skill: { current: charEntry.talents?.skill || 1, target: charEntry.targetTalents?.skill || 10 },
      burst: { current: charEntry.talents?.burst || 1, target: charEntry.targetTalents?.burst || 10 }
    });
    charEntry.calculatedCosts = { ascCosts, talentCosts };
  }
  return charEntry;
};

/**
 * Helper to keep Traveler ascension synchronized.
 * Copies level/ascension fields from sourceName (or the first found traveler) to all other tracked travelers.
 */
export const syncTravelerAscension = (roster, sourceName = null) => {
  const travelers = Object.keys(roster).filter(name => name.startsWith('Traveler '));
  if (travelers.length <= 1) return;

  let source = sourceName;
  if (!source || !roster[source]) {
    source = travelers[0];
  }

  const sourceEntry = roster[source];
  travelers.forEach(name => {
    if (name !== source) {
      const charEntry = {
        ...roster[name],
        level: sourceEntry.level,
        ascension: sourceEntry.ascension,
        targetLevel: sourceEntry.targetLevel,
        targetAscension: sourceEntry.targetAscension
      };

      recalculateCharacterCosts(name, charEntry);
      roster[name] = charEntry;
    }
  });
};

/**
 * Helper to keep Traveler current progression synchronized explicitly (Phase C).
 * Copies ONLY current level/ascension from sourceName to all other tracked travelers.
 * Does NOT touch targetLevel, targetAscension, or targetTalents.
 */
export const syncTravelerCurrentProgression = (roster, sourceName) => {
  const travelers = Object.keys(roster).filter(name => name.startsWith('Traveler '));
  if (travelers.length <= 1) return;

  const sourceEntry = roster[sourceName];
  if (!sourceEntry) return;

  travelers.forEach(name => {
    if (name !== sourceName) {
      const charEntry = {
        ...roster[name],
        level: sourceEntry.level,
        ascension: sourceEntry.ascension
      };

      recalculateCharacterCosts(name, charEntry);
      roster[name] = charEntry;
    }
  });
};
