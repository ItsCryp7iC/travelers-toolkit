/**
 * Character Builds Catalog Service
 *
 * Provides route-scoped lazy loading and in-memory caching of the
 * generated character build recommendations catalog (`src/data/builds.json`).
 *
 * Guarantees:
 * - Lazy loaded on demand; never fetched or bundled on initial Dashboard visit
 * - Memoized in memory for zero refetches across within-feature navigation
 * - Supports character lookup by characterId, characterSlug, or normalized name
 * - Purely client-side and offline; zero network requests to external APIs
 */

let cachedCatalogPromise = null;
let resolvedCatalog = null;

/**
 * Dynamically loads and caches the character builds catalog.
 * @returns {Promise<Object>} The parsed builds catalog
 */
export async function loadBuildsCatalog() {
  if (resolvedCatalog) {
    return resolvedCatalog;
  }

  if (!cachedCatalogPromise) {
    cachedCatalogPromise = import('../data/builds.json')
      .then((module) => {
        const catalog = module.default || module;
        resolvedCatalog = catalog;
        return catalog;
      })
      .catch((err) => {
        cachedCatalogPromise = null;
        throw new Error(
          `Failed to load Character Builds catalog: ${err.message}`,
          {
            cause: err,
          }
        );
      });
  }

  return cachedCatalogPromise;
}

/**
 * Returns the synchronously cached catalog if already loaded, or null.
 */
export function getCachedBuildsCatalog() {
  return resolvedCatalog;
}

/**
 * Clears the cached catalog in memory (primarily for isolated unit tests).
 */
export function clearBuildsCatalogCache() {
  cachedCatalogPromise = null;
  resolvedCatalog = null;
}

/**
 * Normalizes an identifier string for resilient case-insensitive matching.
 */
function normalizeKey(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds a character in the catalog by characterId, characterSlug, or displayName.
 * Handles Traveler variants and name variations gracefully.
 *
 * @param {Object} catalog The builds catalog
 * @param {string} idOrSlug The character identifier from route parameters
 * @returns {Object|null} Matching character entry or null
 */
export function findCharacterBuild(catalog, idOrSlug) {
  if (!catalog || !Array.isArray(catalog.characters) || !idOrSlug) {
    return null;
  }

  const target = String(idOrSlug).trim();
  const targetNorm = normalizeKey(target);

  // 1. Direct exact match on characterId or characterSlug
  const exact = catalog.characters.find(
    (c) => c.characterId === target || c.characterSlug === target
  );
  if (exact) return exact;

  // 2. Case-insensitive exact match
  const ciMatch = catalog.characters.find(
    (c) =>
      c.characterId.toLowerCase() === target.toLowerCase() ||
      c.characterSlug.toLowerCase() === target.toLowerCase()
  );
  if (ciMatch) return ciMatch;

  // 3. Normalized stripped match
  const normMatch = catalog.characters.find((c) => {
    return (
      normalizeKey(c.characterId) === targetNorm ||
      normalizeKey(c.characterSlug) === targetNorm ||
      normalizeKey(c.characterName) === targetNorm
    );
  });
  if (normMatch) return normMatch;

  // 4. Traveler element aliases (e.g. "anemo", "geo", "anemo-traveler", "traveler-anemo")
  const travelerElements = [
    'anemo',
    'geo',
    'electro',
    'dendro',
    'hydro',
    'pyro',
    'cryo',
  ];
  for (const elem of travelerElements) {
    if (
      targetNorm === elem ||
      targetNorm === `${elem}traveler` ||
      targetNorm === `traveler${elem}`
    ) {
      const match = catalog.characters.find(
        (c) => c.characterId.toLowerCase() === `traveler${elem}`
      );
      if (match) return match;
    }
  }

  return null;
}

/**
 * Resolves the default role ID for a character build.
 * Prioritizes the first role flagged with `isBest: true`, falling back
 * to the first available role in the array.
 *
 * @param {Object} character The character build entry
 * @returns {string|null} The default roleId, or null if character has no roles
 */
export function getDefaultRoleId(character) {
  if (
    !character ||
    !Array.isArray(character.roles) ||
    character.roles.length === 0
  ) {
    return null;
  }

  // Find first role with isBest
  const bestRole = character.roles.find((r) => r.isBest && r.status !== 'wip');
  if (bestRole) {
    return bestRole.roleId;
  }

  // Fallback to any isBest role (even if WIP)
  const anyBestRole = character.roles.find((r) => r.isBest);
  if (anyBestRole) {
    return anyBestRole.roleId;
  }

  // Fallback to first available role
  const firstAvailable = character.roles.find((r) => r.status !== 'wip');
  if (firstAvailable) {
    return firstAvailable.roleId;
  }

  return character.roles[0].roleId;
}
