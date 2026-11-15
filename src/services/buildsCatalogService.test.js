import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadBuildsCatalog,
  getCachedBuildsCatalog,
  clearBuildsCatalogCache,
  findCharacterBuild,
  getDefaultRoleId,
} from './buildsCatalogService';

describe('buildsCatalogService', () => {
  beforeEach(() => {
    clearBuildsCatalogCache();
  });

  it('loads and caches the character builds catalog in memory', async () => {
    expect(getCachedBuildsCatalog()).toBeNull();

    const catalog1 = await loadBuildsCatalog();
    expect(catalog1).toBeDefined();
    expect(Array.isArray(catalog1.characters)).toBe(true);
    expect(catalog1.characters.length).toBeGreaterThan(100);

    // Verify synchronous accessor returns the cached instance
    expect(getCachedBuildsCatalog()).toBe(catalog1);

    // Verify subsequent calls return the exact memoized instance
    const catalog2 = await loadBuildsCatalog();
    expect(catalog2).toBe(catalog1);
  });

  it('clears the catalog cache when requested', async () => {
    await loadBuildsCatalog();
    expect(getCachedBuildsCatalog()).not.toBeNull();

    clearBuildsCatalogCache();
    expect(getCachedBuildsCatalog()).toBeNull();
  });

  it('finds character by exact characterId or characterSlug', async () => {
    const catalog = await loadBuildsCatalog();

    const charById = findCharacterBuild(catalog, 'raiden-shogun');
    expect(charById).toBeDefined();
    expect(charById.characterName).toBe('Raiden Shogun');

    const charBySlug = findCharacterBuild(catalog, 'shogun-raiden');
    expect(charBySlug).toBeDefined();
    expect(charBySlug.characterName).toBe('Raiden Shogun');
  });

  it('finds character case-insensitively and with loose normalization', async () => {
    const catalog = await loadBuildsCatalog();

    const matchCase = findCharacterBuild(catalog, 'RAIDEN-SHOGUN');
    expect(matchCase).toBeDefined();
    expect(matchCase.characterName).toBe('Raiden Shogun');

    const matchNormalized = findCharacterBuild(catalog, 'kamisato ayaka');
    expect(matchNormalized).toBeDefined();
    expect(matchNormalized.characterName).toBe('Kamisato Ayaka');
  });

  it('finds Traveler variants by element aliases', async () => {
    const catalog = await loadBuildsCatalog();

    const anemo = findCharacterBuild(catalog, 'anemo-traveler');
    expect(anemo).toBeDefined();
    expect(anemo.characterId).toBe('TravelerAnemo');

    const geo = findCharacterBuild(catalog, 'traveler-geo');
    expect(geo).toBeDefined();
    expect(geo.characterId).toBe('TravelerGeo');

    const electro = findCharacterBuild(catalog, 'electro');
    expect(electro).toBeDefined();
    expect(electro.characterId).toBe('TravelerElectro');

    const dendro = findCharacterBuild(catalog, 'dendrotraveler');
    expect(dendro).toBeDefined();
    expect(dendro.characterId).toBe('TravelerDendro');

    const hydro = findCharacterBuild(catalog, 'travelerhydro');
    expect(hydro).toBeDefined();
    expect(hydro.characterId).toBe('TravelerHydro');

    const pyro = findCharacterBuild(catalog, 'pyrotraveler');
    expect(pyro).toBeDefined();
    expect(pyro.characterId).toBe('TravelerPyro');

    const cryo = findCharacterBuild(catalog, 'cryotraveler');
    expect(cryo).toBeDefined();
    expect(cryo.characterId).toBe('TravelerCryo');
  });

  it('returns null for nonexistent characters', async () => {
    const catalog = await loadBuildsCatalog();
    expect(findCharacterBuild(catalog, 'nonexistent-character-999')).toBeNull();
    expect(findCharacterBuild(catalog, '')).toBeNull();
    expect(findCharacterBuild(null, 'raiden-shogun')).toBeNull();
  });

  it('resolves the default role prioritizing isBest', () => {
    const characterWithBest = {
      characterId: 'test-char',
      roles: [
        {
          roleId: 'sub-dps',
          displayName: 'Sub DPS',
          isBest: false,
          status: 'complete',
        },
        {
          roleId: 'main-dps',
          displayName: 'Main DPS',
          isBest: true,
          status: 'complete',
        },
      ],
    };
    expect(getDefaultRoleId(characterWithBest)).toBe('main-dps');

    const characterWithoutBest = {
      characterId: 'test-char-2',
      roles: [
        {
          roleId: 'support',
          displayName: 'Support',
          isBest: false,
          status: 'complete',
        },
        {
          roleId: 'healer',
          displayName: 'Healer',
          isBest: false,
          status: 'complete',
        },
      ],
    };
    expect(getDefaultRoleId(characterWithoutBest)).toBe('support');

    expect(getDefaultRoleId(null)).toBeNull();
    expect(getDefaultRoleId({ roles: [] })).toBeNull();
  });
});
