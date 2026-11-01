import { describe, it, expect } from 'vitest';
import { aggregateRosterCosts } from './aggregator';

describe('aggregator — aggregateRosterCosts', () => {
  it('returns empty totals when roster and tracked weapons are empty', () => {
    const result = aggregateRosterCosts({}, []);
    expect(result.totalCosts).toEqual({});
    expect(result.breakdown).toEqual([]);
    expect(result.trackedCount).toBe(0);
  });

  it('aggregates character progression and talent costs without reference errors', () => {
    // Tests character cost path where resolveSpecificItem is called with character data and null weapon
    const roster = {
      'Kamisato Ayaka': {
        level: 1,
        targetLevel: 90,
        ascension: 0,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 10, skill: 10, burst: 10 },
      },
    };

    const result = aggregateRosterCosts(roster, []);
    expect(result.breakdown.length).toBe(1);
    expect(result.breakdown[0].name).toBe('Kamisato Ayaka');

    // Should include Mora, exp materials, talent books, local specialties, and boss mats
    expect(result.totalCosts.Mora).toBeGreaterThan(0);
    expect(Object.keys(result.totalCosts).length).toBeGreaterThan(5);
    expect(Object.keys(result.categories).length).toBeGreaterThan(5);
    expect(Object.keys(result.rarities).length).toBeGreaterThan(5);
  });

  it('aggregates both character and tracked weapon costs simultaneously', () => {
    const roster = {
      'Bennett': {
        level: 70,
        targetLevel: 80,
        ascension: 4,
        targetAscension: 5,
        talents: { normal: 1, skill: 6, burst: 8 },
        targetTalents: { normal: 1, skill: 8, burst: 10 },
      },
    };

    const trackedWeapons = [
      {
        weaponName: 'Mistsplitter Reforged',
        level: 1,
        targetLevel: 90,
        ascension: 0,
        targetAscension: 6,
      },
    ];

    const result = aggregateRosterCosts(roster, trackedWeapons);
    expect(result.breakdown.length).toBe(2);
    expect(result.breakdown.some((b) => b.name === 'Bennett')).toBe(true);
    expect(result.breakdown.some((b) => b.name === 'Mistsplitter Reforged')).toBe(true);
    expect(result.totalCosts.Mora).toBeGreaterThan(0);
  });

  it('charges 0 boss materials, 0 gemstones, and 0 local specialties for Level 80 A6 characters targeting Level 90 A6', () => {
    const roster = {
      'Jean': {
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
    };

    const result = aggregateRosterCosts(roster, []);
    // Jean at 80/90 A6 needs only leveling XP and Mora, 0 boss materials
    expect(result.totalCosts.HurricaneSeed).toBeUndefined();
    expect(result.totalCosts.DandelionSeed).toBeUndefined();
    expect(result.totalCosts.VayudaTurquoiseGemstone).toBeUndefined();
    expect(result.totalCosts.DamagedMask).toBeUndefined();

    // Exact Level 80->90 leveling costs (authoritative Genshin requirements)
    expect(result.totalCosts.HerosWit).toBe(172);
    expect(result.totalCosts.Mora).toBe(684625);
  });

  it('correctly replicates 0 boss materials for user reported characters (Jean, Aloy, Keqing) at 80/90 A6', () => {
    const roster = {
      'Jean': {
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
      'Aloy': {
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
      'Keqing': {
        level: 80,
        targetLevel: 90,
        ascension: 6,
        targetAscension: 6,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
    };

    const result = aggregateRosterCosts(roster, []);
    // None of these max-ascended characters should require boss materials
    expect(result.totalCosts.HurricaneSeed).toBeUndefined();
    expect(result.totalCosts.CrystallineBloom).toBeUndefined();
    expect(result.totalCosts.LightningPrism).toBeUndefined();
  });

  it('charges 0 boss materials for milestone Level 70 A5 characters targeting Level 80 A5', () => {
    const roster = {
      'Jean': {
        level: 70,
        targetLevel: 80,
        ascension: 5,
        targetAscension: 5,
        talents: { normal: 1, skill: 1, burst: 1 },
        targetTalents: { normal: 1, skill: 1, burst: 1 },
      },
    };

    const result = aggregateRosterCosts(roster, []);
    // Phase 5 already completed -> 0 boss mats, 0 gem chunks
    expect(result.totalCosts.HurricaneSeed).toBeUndefined();
    expect(result.totalCosts.VayudaTurquoiseChunk).toBeUndefined();
    expect(result.totalCosts.HerosWit).toBe(80);
    expect(result.totalCosts.Mora).toBe(322375);
  });

  it('provides disambiguated characterCount and weaponCount', () => {
    const roster = {
      'Bennett': {
        level: 70,
        targetLevel: 80,
        ascension: 4,
        targetAscension: 5,
        talents: { normal: 1, skill: 6, burst: 8 },
        targetTalents: { normal: 1, skill: 8, burst: 10 },
      },
    };

    const trackedWeapons = [
      {
        weaponName: 'Mistsplitter Reforged',
        level: 1,
        targetLevel: 90,
        ascension: 0,
        targetAscension: 6,
      },
    ];

    const result = aggregateRosterCosts(roster, trackedWeapons);
    expect(result.trackedCount).toBe(2);
    expect(result.characterCount).toBe(1);
    expect(result.weaponCount).toBe(1);
  });
});
