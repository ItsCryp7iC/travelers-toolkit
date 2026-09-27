import { describe, it, expect } from 'vitest';
import { getNeededBy, groupTalentBooks } from './plannerGrouping';

describe('plannerGrouping', () => {
  describe('getNeededBy', () => {
    it('does not return duplicate entities with the same name', () => {
      // Mock totals with duplicates
      const totals = {
        breakdown: [
          { name: 'Diluc', character: { id: 'diluc' }, totalCosts: { 'TeachingsOfFreedom': 10 } },
          { name: 'Diluc', character: { id: 'diluc' }, totalCosts: { 'TeachingsOfFreedom': 5 } },
          { name: 'Jean', character: { id: 'jean' }, totalCosts: { 'TeachingsOfFreedom': 2 } }
        ]
      };

      const trackedWeapons = [];

      const needed = getNeededBy({
        matKey: 'TeachingsOfFreedom',
        type: 'talent',
        totals,
        trackedWeapons
      });

      expect(needed).toHaveLength(2);
      expect(needed.map(n => n.name)).toEqual(['Diluc', 'Jean']);
    });

    it('returns character typing for characters and weapon typing for weapons', () => {
      const totals = {
        breakdown: [
          { name: 'Diluc', character: { id: 'diluc' }, totalCosts: { 'mat_id': 10 } },
          { name: 'Wolf\'s Gravestone', totalCosts: { 'mat_id': 5 } } // Assume weaponsData has Wolf's Gravestone
        ]
      };

      const trackedWeapons = [];

      const needed = getNeededBy({
        matKey: 'mat_id',
        type: 'gemstones', // Any type that scans totals
        totals,
        trackedWeapons
      });

      const diluc = needed.find(n => n.name === 'Diluc');
      const weapon = needed.find(n => n.name === 'Wolf\'s Gravestone');

      expect(diluc?.type).toBe('character');
      expect(weapon?.type).toBe('weapon');
    });

    it('excludes completed tracked weapons from needed fallback scan', () => {
      const totals = { breakdown: [] };
      const trackedWeapons = [
        { weaponName: 'Favonius Sword', ascension: 6, targetAscension: 6, level: 90, targetLevel: 90 }, // Maxed
        { weaponName: 'Sacrificial Sword', ascension: 2, targetAscension: 6, level: 50, targetLevel: 90 } // Needs materials
      ];

      // Test with Decabrian which both swords might need.
      const needed = getNeededBy({
        matKey: 'Decarabian_2_star_ascension_material',
        type: 'weapon_ascension',
        totals,
        trackedWeapons
      });

      // Favonius Sword is completed, so it should not be in `needed`
      expect(needed.find(n => n.name === 'Favonius Sword')).toBeUndefined();
    });
  });

  describe('groupTalentBooks', () => {
    it('groups talent books by region, domain, and familyName', () => {
      const talentBooks = [
        { name: 'TeachingsOfFreedom', required: 10 },
        { name: 'GuideToFreedom', required: 5 },
        { name: 'TeachingsOfResistance', required: 5 }
      ];
      const totals = { breakdown: [] };
      const trackedWeapons = [];

      const grouped = groupTalentBooks(talentBooks, totals, trackedWeapons);

      // Structure: groups[region][domainName][familyName]
      expect(grouped).toHaveProperty('Mondstadt');
      expect(grouped['Mondstadt']).toHaveProperty('Forsaken Rift');

      const forsakenRift = grouped['Mondstadt']['Forsaken Rift'];
      expect(forsakenRift).toHaveProperty('Freedom');
      expect(forsakenRift).toHaveProperty('Resistance');

      const freedomFamily = forsakenRift['Freedom'];
      expect(freedomFamily.type).toBe('talent');
      expect(Object.keys(freedomFamily.items)).toHaveLength(2); // 2-star and 3-star
      expect(freedomFamily.items).toHaveProperty('TeachingsOfFreedom');
      expect(freedomFamily.items).toHaveProperty('GuideToFreedom');
    });

    it('safely skips unknown resolver results', () => {
      const talentBooks = [
        { name: 'TeachingsOfFreedom', required: 10 },
        { name: 'Unknown_Book_material', required: 5 } // Not in JSON
      ];
      const totals = { breakdown: [] };
      const trackedWeapons = [];

      const grouped = groupTalentBooks(talentBooks, totals, trackedWeapons);

      // Should contain Mondstadt -> Forsaken Rift -> Freedom
      expect(grouped).toHaveProperty('Mondstadt');

      // Should not contain undefined/Unknown regions or throw
      expect(grouped).not.toHaveProperty('undefined');
      expect(grouped).not.toHaveProperty('Unknown Region');
    });
  });
});
