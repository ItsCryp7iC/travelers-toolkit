import { describe, it, expect } from 'vitest';
import commissionsData from './commissions.json';
import allAchievementsData from './achievements.json';

describe('Commissions Metadata Validation', () => {
  it('every commissions.json key is a valid canonical achievement ID', () => {
    const canonicalIds = new Set(allAchievementsData.map(a => String(a.id)));
    for (const key of Object.keys(commissionsData)) {
      expect(canonicalIds.has(key)).toBe(true);
    }
  });

  it('every value is a non-empty array', () => {
    for (const [key, value] of Object.entries(commissionsData)) {
      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('commission names are non-empty strings', () => {
    for (const value of Object.values(commissionsData)) {
      for (const commission of value) {
        expect(typeof commission.name).toBe('string');
        expect(commission.name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('wiki URLs use HTTPS and target the approved Genshin Wiki host', () => {
    for (const value of Object.values(commissionsData)) {
      for (const commission of value) {
        expect(commission.wikiUrl.startsWith('https://genshin-impact.fandom.com/wiki/')).toBe(true);
      }
    }
  });

  it('duplicate commission entries per achievement are rejected', () => {
    for (const value of Object.values(commissionsData)) {
      const seen = new Set();
      for (const commission of value) {
        const identifier = `${commission.name}::${commission.wikiUrl}`;
        expect(seen.has(identifier)).toBe(false);
        seen.add(identifier);
      }
    }
  });

  it('deterministic ordering', () => {
    // Keys should be sorted in commissions.json for deterministic backups/exports
    const keys = Object.keys(commissionsData);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });

  it('prototype-pollution keys are impossible/rejected', () => {
    const keys = Object.keys(commissionsData);
    expect(keys).not.toContain('__proto__');
    expect(keys).not.toContain('constructor');
  });
});
