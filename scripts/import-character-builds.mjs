#!/usr/bin/env node

/**
 * Character Builds Importer & Validation Engine (CB2A)
 * 
 * Imports, normalizes, validates, and stages character build recommendations
 * from the local Genshin Impact Helper Team content checkout into Traveler's Toolkit.
 * 
 * Features:
 * - 100% offline local processing (zero remote network requests)
 * - Safe HTML rendering and sanitization (defense against XSS)
 * - Deterministic schema generation with SHA fingerprints
 * - Staging and atomic publication with Windows cross-device safety
 * - Source checkout verification and uncommitted changes detection
 * - Comprehensive schema & integrity validation
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 1;
export const NORMALIZER_VERSION = '1.0.0';
export const NORMALIZER_SCRIPT_PATH = fileURLToPath(import.meta.url);
export const LICENSE_NOTICE =
  'Character build recommendations and editorial notes are Copyright © Genshin Impact Helper Team contributors. Used with explicit permission. Not licensed under MIT.';
export const SOURCE_ATTRIBUTION_URL =
  'https://github.com/Genshin-Impact-Helper-Team/genshin-builds';

/**
 * Escapes HTML characters for safe insertion into HTML markup.
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes version string (e.g. "6.7 / Luna VIII", "5.4").
 */
export function normalizeVersion(version) {
  return typeof version === 'string'
    ? version
      .trim()
      .replace(/\s*\/\s*/g, ' / ')
      .replace(/\s+/g, ' ')
    : '';
}

/**
 * Converts kebab-case slug to Title Case.
 */
export function toTitleCase(str) {
  return String(str ?? '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Safely reads and parses JSON file, removing potential UTF-8 BOM.
 */
export function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON file at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/**
 * Resolves Git commit SHA of the source repository.
 */
export function getSourceCommitSha(sourceDir, fallbackSha = null) {
  if (fallbackSha && /^[0-9a-f]{40}$/i.test(fallbackSha.trim())) {
    return fallbackSha.trim();
  }

  try {
    const stdout = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const sha = stdout.trim();
    if (/^[0-9a-f]{40}$/i.test(sha)) {
      return sha;
    }
  } catch {
    // Fall back to reading .git/HEAD directly if git binary not in PATH
    try {
      const gitHeadPath = path.join(sourceDir, '.git', 'HEAD');
      if (fs.existsSync(gitHeadPath)) {
        const headContent = fs.readFileSync(gitHeadPath, 'utf8').trim();
        if (/^[0-9a-f]{40}$/i.test(headContent)) {
          return headContent;
        }
        if (headContent.startsWith('ref: ')) {
          const refPath = path.join(
            sourceDir,
            '.git',
            headContent.slice(5).trim(),
          );
          if (fs.existsSync(refPath)) {
            const refSha = fs.readFileSync(refPath, 'utf8').trim();
            if (/^[0-9a-f]{40}$/i.test(refSha)) {
              return refSha;
            }
          }
        }
      }
    } catch {
      // Ignored
    }
  }

  throw new Error(
    `Unable to determine Git commit SHA in source directory: ${sourceDir}. Ensure it is a valid git repository or specify --source-commit.`,
  );
}

/**
 * Verifies source directory existence, required directories and files, and git status.
 */
export function verifySourceIntegrity(sourceDir, { allowDirty = false } = {}) {
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    throw new Error(`Source checkout directory not found: ${sourceDir}`);
  }

  // 1. Verify required files and directories
  const requiredPaths = [
    path.join(sourceDir, 'src', 'content'),
    path.join(sourceDir, 'src', 'data', 'weapons'),
    path.join(sourceDir, 'src', 'data', 'translation-aliases.json'),
    path.join(sourceDir, 'src', 'i18n', 'en', 'characters.json'),
    path.join(sourceDir, 'src', 'i18n', 'en', 'weapons.json'),
    path.join(sourceDir, 'src', 'i18n', 'en', 'artifact-sets.json'),
    path.join(sourceDir, 'src', 'i18n', 'en', 'stats.json'),
    path.join(sourceDir, 'src', 'i18n', 'en', 'elements.json'),
    path.join(sourceDir, 'src', 'i18n', 'en', 'abilities.json'),
  ];

  for (const reqPath of requiredPaths) {
    if (!fs.existsSync(reqPath)) {
      throw new Error(
        `Required upstream source file or directory missing: ${reqPath}`,
      );
    }
  }

  // 2. Verify all 7 core elements exist in content
  const contentDir = path.join(sourceDir, 'src', 'content');
  const coreElements = [
    'anemo',
    'geo',
    'electro',
    'dendro',
    'hydro',
    'pyro',
    'cryo',
  ];
  for (const elem of coreElements) {
    const elemDir = path.join(contentDir, elem);
    if (!fs.existsSync(elemDir) || !fs.statSync(elemDir).isDirectory()) {
      throw new Error(`Core element content directory missing: ${elemDir}`);
    }
  }

  // 3. Check for modified tracked files in content/data/i18n via git
  try {
    const statusOutput = execFileSync(
      'git',
      ['-C', sourceDir, 'status', '--porcelain'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();

    if (statusOutput && !allowDirty) {
      const lines = statusOutput.split('\n').map((l) => l.trim());
      const trackedModifications = lines.filter((l) => {
        if (l.startsWith('??')) return false; // Untracked files are ignored
        const filePath = l.slice(3).trim();
        return (
          filePath.startsWith('src/content/') ||
          filePath.startsWith('src/data/') ||
          filePath.startsWith('src/i18n/')
        );
      });

      if (trackedModifications.length > 0) {
        throw new Error(
          `Source checkout has uncommitted tracked changes in content/data/i18n directories:\n${trackedModifications.join(
            '\n',
          )}\nCannot guarantee reproducibility for commit SHA. Use --allow-dirty to override for testing.`,
        );
      }
    }
  } catch (error) {
    if (error.message && error.message.includes('uncommitted tracked changes')) {
      throw error;
    }
    // Git might not be in PATH; non-fatal if files are verified
  }

  return true;
}

/**
 * Computes deterministic SHA-256 hash across all local mapping tables,
 * canonical game datasets, implementation source code, and schema version.
 */
export function computeCatalogFingerprint({
  mappingsDir = 'src/data/mappings',
  charactersFile = 'src/data/characters.json',
  travelerFile = 'src/data/traveler.json',
  weaponsFile = 'src/data/weapons.json',
  artifactsFile = 'src/data/artifacts.json',
  normalizerScriptFile = NORMALIZER_SCRIPT_PATH,
  normalizerVersion = NORMALIZER_VERSION,
  schemaVersion = SCHEMA_VERSION,
} = {}) {
  const hash = crypto.createHash('sha256');

  // 1. Implementation source code hash & schema version
  if (normalizerScriptFile && fs.existsSync(normalizerScriptFile)) {
    const scriptContent = fs
      .readFileSync(normalizerScriptFile, 'utf8')
      .replace(/\r\n/g, '\n');
    const scriptHash = crypto
      .createHash('sha256')
      .update(scriptContent)
      .digest('hex');
    hash.update(`normalizerScriptHash:${scriptHash}\n`);
  } else {
    hash.update(`normalizerVersion:${normalizerVersion}\n`);
  }
  hash.update(`schemaVersion:${schemaVersion}\n`);

  // 2. Mapping tables (sorted by filename)
  if (fs.existsSync(mappingsDir)) {
    const files = fs
      .readdirSync(mappingsDir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    for (const file of files) {
      const content = fs.readFileSync(path.join(mappingsDir, file), 'utf8');
      hash.update(`mapping:${file}:${content}\n`);
    }
  }

  // 3. Local canonical game datasets
  const canonicalEntries = [
    { label: 'characters', path: charactersFile },
    { label: 'traveler', path: travelerFile },
    { label: 'weapons', path: weaponsFile },
    { label: 'artifacts', path: artifactsFile },
  ];

  for (const entry of canonicalEntries) {
    if (entry.path && fs.existsSync(entry.path)) {
      const content = fs.readFileSync(entry.path, 'utf8');
      hash.update(`catalog:${entry.label}:${content}\n`);
    }
  }

  return hash.digest('hex');
}

/**
 * Backward compatibility alias for computeCatalogFingerprint.
 */
export function computeMappingFingerprint(mappingsDir) {
  return computeCatalogFingerprint({ mappingsDir });
}

/**
 * Loads canonical Toolkit weapons catalog into lookup maps for safe deterministic matching.
 */
export function loadCanonicalWeapons(weaponsPath = 'src/data/weapons.json') {
  if (!weaponsPath || !fs.existsSync(weaponsPath)) {
    return { byId: new Map(), byName: new Map() };
  }
  const weapons = readJsonFile(weaponsPath);
  const byId = new Map();
  const byName = new Map();
  for (const w of weapons) {
    if (w && w.id) {
      const strippedId = String(w.id).toLowerCase().replace(/[^a-z0-9]/g, '');
      byId.set(strippedId, w.id);
      if (w.name) {
        const normName = String(w.name).toLowerCase().replace(/[^a-z0-9]/g, '');
        byName.set(normName, w.id);
      }
    }
  }
  return { byId, byName };
}

/**
 * Loads upstream English dictionaries and shared equipment definitions.
 */
export function loadUpstreamDictionaries(sourceDir) {
  const i18nDir = path.join(sourceDir, 'src', 'i18n', 'en');
  if (!fs.existsSync(i18nDir)) {
    throw new Error(`Upstream i18n directory not found: ${i18nDir}`);
  }

  const aliasesPath = path.join(
    sourceDir,
    'src',
    'data',
    'translation-aliases.json',
  );
  const aliases = fs.existsSync(aliasesPath) ? readJsonFile(aliasesPath) : {};

  const enCharacters = readJsonFile(path.join(i18nDir, 'characters.json'));
  const enWeapons = readJsonFile(path.join(i18nDir, 'weapons.json'));
  const enArtifactSets = readJsonFile(path.join(i18nDir, 'artifact-sets.json'));
  const enStats = readJsonFile(path.join(i18nDir, 'stats.json'));
  const enElements = readJsonFile(path.join(i18nDir, 'elements.json'));
  const enAbilities = readJsonFile(path.join(i18nDir, 'abilities.json'));
  const enNotes = fs.existsSync(path.join(i18nDir, 'notes.json'))
    ? readJsonFile(path.join(i18nDir, 'notes.json'))
    : {};

  // Load shared weapon definitions for rarity resolution
  const weaponsDataDir = path.join(sourceDir, 'src', 'data', 'weapons');
  const sharedWeapons = {};
  if (fs.existsSync(weaponsDataDir)) {
    for (const type of ['sword', 'claymore', 'polearm', 'bow', 'catalyst']) {
      const typePath = path.join(weaponsDataDir, `${type}.json`);
      if (fs.existsSync(typePath)) {
        sharedWeapons[type] = readJsonFile(typePath);
      }
    }
  }

  return {
    characters: enCharacters,
    weapons: enWeapons,
    artifactSets: enArtifactSets,
    stats: enStats,
    elements: enElements,
    abilities: enAbilities,
    notes: enNotes,
    aliases,
    sharedWeapons,
  };
}

/**
 * Loads project mapping tables.
 */
export function loadProjectMappings(mappingsDir) {
  const characterMapPath = path.join(mappingsDir, 'characterMap.json');
  const weaponMapPath = path.join(mappingsDir, 'weaponMap.json');
  const pseudoSetMapPath = path.join(mappingsDir, 'pseudoSetMap.json');
  const artifactSetMapPath = path.join(mappingsDir, 'artifactSetMap.json');

  if (!fs.existsSync(characterMapPath)) {
    throw new Error(`Required mapping file missing: ${characterMapPath}`);
  }
  if (!fs.existsSync(weaponMapPath)) {
    throw new Error(`Required mapping file missing: ${weaponMapPath}`);
  }
  if (!fs.existsSync(pseudoSetMapPath)) {
    throw new Error(`Required mapping file missing: ${pseudoSetMapPath}`);
  }

  return {
    characterMap: readJsonFile(characterMapPath),
    weaponMap: readJsonFile(weaponMapPath),
    pseudoSetMap: readJsonFile(pseudoSetMapPath),
    artifactSetMap: fs.existsSync(artifactSetMapPath)
      ? readJsonFile(artifactSetMapPath)
      : {},
  };
}

/**
 * Resolves an inline translation token ([[category:id|label]]).
 */
export function resolveInlineToken(match, rawCat, rawId, label, dictionaries) {
  if (label && label.trim().length > 0) {
    return label.trim();
  }

  let cat = (rawCat || '').toLowerCase().trim();
  // Handle typo tolerance
  if (cat === 'abillity') cat = 'ability';
  if (cat === 'elemento') cat = 'element';
  if (cat === 'personaggio') cat = 'character';
  if (cat === 'set') cat = 'artifact';

  const id = (rawId || '').trim();

  const lookupInCategory = (category, targetId) => {
    const targetLower = targetId.toLowerCase();
    switch (category) {
      case 'character': {
        if (targetLower.endsWith('-traveler')) {
          const elem = targetLower.replace('-traveler', '');
          const elemName = dictionaries.elements[elem] || toTitleCase(elem);
          return `${elemName} Traveler`;
        }
        return (
          dictionaries.characters[targetId] ||
          dictionaries.characters[targetLower] ||
          null
        );
      }
      case 'weapon': {
        const canonicalId =
          dictionaries.aliases.weapon?.[targetId] ||
          dictionaries.aliases.weapon?.[targetLower] ||
          targetId;
        return (
          dictionaries.weapons[canonicalId] ||
          dictionaries.weapons[canonicalId.toLowerCase()] ||
          null
        );
      }
      case 'artifact': {
        const canonicalId =
          dictionaries.aliases.set?.[targetId] ||
          dictionaries.aliases.set?.[targetLower] ||
          targetId;
        return (
          dictionaries.artifactSets[canonicalId] ||
          dictionaries.artifactSets[canonicalId.toLowerCase()] ||
          dictionaries.stats[canonicalId] ||
          dictionaries.stats[canonicalId.toLowerCase()] ||
          null
        );
      }
      case 'stat': {
        return (
          dictionaries.stats[targetId] ||
          dictionaries.stats[targetLower] ||
          null
        );
      }
      case 'element': {
        return (
          dictionaries.elements[targetId] ||
          dictionaries.elements[targetLower] ||
          null
        );
      }
      case 'ability': {
        return (
          dictionaries.abilities[targetId] ||
          dictionaries.abilities[targetLower] ||
          null
        );
      }
      case 'note': {
        return (
          dictionaries.notes[targetId] ||
          dictionaries.notes[targetLower] ||
          null
        );
      }
      default:
        return null;
    }
  };

  if (cat) {
    const resolved = lookupInCategory(cat, id);
    if (resolved) return resolved;
  } else {
    // Untagged token: cascading category search
    const searchOrder = [
      'character',
      'weapon',
      'artifact',
      'stat',
      'element',
      'ability',
      'note',
    ];
    for (const category of searchOrder) {
      const resolved = lookupInCategory(category, id);
      if (resolved) return resolved;
    }
  }

  // Fallback: unresolvable token
  return match;
}

/**
 * Replaces all [[...]] inline tokens in text with translated labels.
 */
export function parseInlineTokens(text, dictionaries) {
  if (typeof text !== 'string') return '';
  const tokenPattern =
    /\[\[(?:([a-z0-9_-]+):)?([a-z0-9%/_.-]+)(?:\|([^\]\n]+))?\]\]/gi;
  return text.replace(
    tokenPattern,
    (match, category, id, label) =>
      resolveInlineToken(match, category, id, label, dictionaries),
  );
}

/**
 * Renders {rot:...} rotation markers into semantic badges.
 */
export function renderRotationBadges(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\{rot:([^}\n]+)\}/g, (_, notation) => {
    const trimmed = notation.trim();
    if (!trimmed) return '';
    return `<span class="tt-rotation-badge" data-rotation="${escapeHtml(trimmed)}">${escapeHtml(trimmed)}</span>`;
  });
}

/**
 * Converts markdown text into sanitized, safe HTML.
 * Ensures strict security against XSS.
 */
export function markdownToSafeHtml(markdown, dictionaries, options = {}) {
  if (typeof markdown !== 'string') return '';

  // 1. Expand inline reference tokens [[...]]
  let text = parseInlineTokens(markdown, dictionaries);

  // 2. Defang event handlers inside any raw HTML tags (e.g. <img src=x onerror=alert(1)>)
  text = text.replace(/<[^>]+>/g, (tag) =>
    tag.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ''),
  );

  // 3. HTML-escape raw text so that any raw HTML tags (<script>, <img>, etc.) become safe entities (&lt;script&gt;)
  text = escapeHtml(text);

  // 4. Expand rotation notation {rot:...}
  // Note: text is already HTML-escaped, so trimmed notation has quotes and special characters escaped safely
  text = text.replace(/\{rot:([^}\n]+)\}/g, (_, notation) => {
    const trimmed = notation.trim();
    if (!trimmed) return '';
    return `<span class="tt-rotation-badge" data-rotation="${trimmed}">${trimmed}</span>`;
  });

  // 5. Safe Markdown Conversions:
  // Code spans: `code`
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Bold: **text** or __text__
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');

  // Italics: *text* or _text_
  text = text.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
  text = text.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1<em>$2</em>$3');

  // Markdown links: [label](url)
  // Only permit strict https:// URLs with valid URI characters.
  // Reject javascript:, data:, vbscript:, encoded schemes, quotes, spaces.
  text = text.replace(
    /\[([^\]\n]+)\]\(([^)\n]+)\)/g,
    (match, label, rawUrl) => {
      const trimmedUrl = rawUrl.trim();
      const isSafeHttps =
        /^https:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(trimmedUrl) &&
        !trimmedUrl.includes('&quot;') &&
        !trimmedUrl.includes('&#39;') &&
        !trimmedUrl.includes('"') &&
        !trimmedUrl.includes("'");

      if (isSafeHttps) {
        return `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      }
      // If unsafe or non-HTTPS: strip link syntax and render only the label
      return label;
    },
  );

  if (options.stripParagraphs) {
    // Single-line note: replace newlines with <br />
    text = text.replace(/\r\n/g, '\n').replace(/\n+/g, '<br />');
    return text.trim();
  }

  // Multi-line block formatting (for editorial notes and gameplay tips)
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const paragraphs = normalized.split(/\n{2,}/);

  const htmlParagraphs = paragraphs.map((para) => {
    const trimmed = para.trim();
    if (!trimmed) return '';

    // Unordered lists
    if (/^[-*]\s+/.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li>${item}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }

    // Ordered lists
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .map((line) => line.replace(/^\d+\.\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li>${item}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    }

    const withBreaks = trimmed.replace(/\n/g, '<br />');
    return `<p>${withBreaks}</p>`;
  });

  return htmlParagraphs.filter(Boolean).join('');
}

/**
 * Extracts localized English note string.
 */
export function extractEnglishNote(noteField) {
  if (!noteField) return null;
  if (typeof noteField === 'string') return noteField;
  if (typeof noteField === 'object' && noteField !== null) {
    return noteField.en ?? null;
  }
  return null;
}

/**
 * Normalizes one weapon item recommendation.
 */
export function resolveWeaponItem(
  rawItem,
  weaponType,
  dictionaries,
  weaponMap,
  canonicalWeapons = null,
) {
  const item = typeof rawItem === 'string' ? { name: rawItem } : rawItem;
  const sourceWeaponId = (item.name || item.id || '').trim();
  if (!sourceWeaponId) {
    throw new Error('Weapon item is missing name or ID');
  }

  const canonicalSlug =
    dictionaries.aliases.weapon?.[sourceWeaponId] ||
    dictionaries.aliases.weapon?.[sourceWeaponId.toLowerCase()] ||
    sourceWeaponId;

  const name =
    dictionaries.weapons[canonicalSlug] ||
    dictionaries.weapons[canonicalSlug.toLowerCase()] ||
    dictionaries.weapons[sourceWeaponId] ||
    toTitleCase(sourceWeaponId);

  // Weapon rarity from shared weapon data or fallback to 5
  const rarity =
    dictionaries.sharedWeapons[weaponType]?.[canonicalSlug]?.rarity ||
    dictionaries.sharedWeapons[weaponType]?.[sourceWeaponId]?.rarity ||
    5;

  const rawNote = extractEnglishNote(item.note);
  const note = rawNote
    ? markdownToSafeHtml(rawNote, dictionaries, { stripParagraphs: true })
    : null;

  // Refinement: number or string (e.g. 5, "3+", "3-5")
  let refinement = null;
  if (item.refinement !== undefined && item.refinement !== null) {
    if (
      typeof item.refinement === 'string' &&
      /^\d+$/.test(item.refinement.trim())
    ) {
      refinement = parseInt(item.refinement.trim(), 10);
    } else {
      refinement = item.refinement;
    }
  }

  // Canonical mapping lookup:
  // 1. Explicit valid string mapping in weaponMap is authoritative
  // 2. Otherwise (null or undefined), fallback to safe deterministic matching against canonical weapons
  let toolkitWeaponId = null;
  let isToolkitItem = false;

  const explicit = weaponMap?.[sourceWeaponId] ?? weaponMap?.[canonicalSlug];

  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    toolkitWeaponId = explicit.trim();
    isToolkitItem = true;
  } else if (canonicalWeapons) {
    const strippedSlug = canonicalSlug.replace(/[^a-z0-9]/g, '');
    if (canonicalWeapons.byId?.has(strippedSlug)) {
      toolkitWeaponId = canonicalWeapons.byId.get(strippedSlug);
      isToolkitItem = true;
    } else {
      const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (canonicalWeapons.byName?.has(normName)) {
        toolkitWeaponId = canonicalWeapons.byName.get(normName);
        isToolkitItem = true;
      }
    }
  }

  return {
    sourceWeaponId,
    toolkitWeaponId,
    name,
    rarity,
    refinement,
    note,
    isToolkitItem,
  };
}

/**
 * Normalizes one artifact set item recommendation.
 */
export function resolveArtifactItem(
  rawItem,
  dictionaries,
  pseudoSetMap,
  artifactSetMap,
) {
  const item = typeof rawItem === 'string' ? { name: rawItem } : rawItem;
  const sourceSetId = (item.name || item.id || '').trim();
  if (!sourceSetId) {
    throw new Error('Artifact set item is missing name or ID');
  }

  const canonicalSlug =
    dictionaries.aliases.set?.[sourceSetId] ||
    dictionaries.aliases.set?.[sourceSetId.toLowerCase()] ||
    sourceSetId;

  const isPseudoSet = Boolean(
    pseudoSetMap[sourceSetId] || pseudoSetMap[canonicalSlug],
  );
  const pseudoDef = pseudoSetMap[sourceSetId] || pseudoSetMap[canonicalSlug];
  const pseudoStatTag = isPseudoSet ? pseudoDef?.tag || sourceSetId : undefined;

  const name = isPseudoSet
    ? pseudoDef?.label ||
    dictionaries.stats[sourceSetId] ||
    dictionaries.stats[canonicalSlug] ||
    toTitleCase(sourceSetId)
    : dictionaries.artifactSets[canonicalSlug] ||
    dictionaries.artifactSets[sourceSetId] ||
    toTitleCase(sourceSetId);

  const rawNote = extractEnglishNote(item.note);
  const note = rawNote
    ? markdownToSafeHtml(rawNote, dictionaries, { stripParagraphs: true })
    : null;

  const pieces = item.pieces === 4 ? 4 : 2;

  // Catalog independence: Toolkit does not maintain canonical artifacts.json yet
  const mapped =
    !isPseudoSet && artifactSetMap
      ? (artifactSetMap[sourceSetId] ?? artifactSetMap[canonicalSlug] ?? null)
      : null;

  const toolkitSetId = mapped !== undefined ? mapped : null;
  const isToolkitItem = false;

  const result = {
    sourceSetId,
    toolkitSetId,
    name,
    pieces,
    note,
    isToolkitItem,
    isPseudoSet,
  };

  if (pseudoStatTag) {
    result.pseudoStatTag = pseudoStatTag;
  }

  return result;
}

/**
 * Normalizes one artifact combination group.
 */
export function normalizeArtifactCombinationGroup(
  group,
  dictionaries,
  pseudoSetMap,
  artifactSetMap,
) {
  const combinationGroup = {};

  if (group.choose) {
    combinationGroup.chooseTwo = true;
  }

  if (Array.isArray(group.items) && group.items.length > 0) {
    combinationGroup.items = group.items.map((item) =>
      resolveArtifactItem(item, dictionaries, pseudoSetMap, artifactSetMap),
    );
  }

  if (Array.isArray(group.choices) && group.choices.length > 0) {
    combinationGroup.choices = group.choices.map((choice) => ({
      ...(choice.label ? { label: String(choice.label) } : {}),
      items: (choice.items || []).map((item) =>
        resolveArtifactItem(item, dictionaries, pseudoSetMap, artifactSetMap),
      ),
    }));
  }

  return combinationGroup;
}

/**
 * Normalizes one stat option for main stats or substats.
 */
export function resolveStatOption(rawStat, dictionaries) {
  const item = typeof rawStat === 'string' ? { name: rawStat } : rawStat;
  const rawKey = (item.name || item.id || '').trim();

  const name = rawKey.includes('[[')
    ? parseInlineTokens(rawKey, dictionaries)
    : dictionaries.stats[rawKey] ||
    dictionaries.stats[rawKey.toLowerCase()] ||
    rawKey;

  const rawNote = extractEnglishNote(item.note);
  const note = rawNote
    ? markdownToSafeHtml(rawNote, dictionaries, { stripParagraphs: true })
    : null;

  return {
    statKey: rawKey,
    name,
    note,
  };
}

/**
 * Normalizes one talent item.
 */
export function resolveTalentItem(rawTalent, dictionaries) {
  const item = typeof rawTalent === 'string' ? { name: rawTalent } : rawTalent;
  const talentKey = (item.name || item.id || '').trim().toLowerCase();

  let name;
  if (talentKey === 'burst') {
    name = dictionaries.abilities.burst || 'Elemental Burst';
  } else if (talentKey === 'skill') {
    name = dictionaries.abilities.skill || 'Elemental Skill';
  } else if (talentKey === 'na') {
    name = dictionaries.abilities.na || 'Normal Attack';
  } else {
    name = dictionaries.abilities[talentKey] || toTitleCase(talentKey);
  }

  const rawNote = extractEnglishNote(item.note);
  const note = rawNote
    ? markdownToSafeHtml(rawNote, dictionaries, { stripParagraphs: true })
    : null;

  return {
    talentKey,
    name,
    note,
  };
}

/**
 * Loads JSON file with fallback from role directory to character directory.
 */
export function loadWithFallback(roleDir, charDir, fileName) {
  const roleFile = path.join(roleDir, fileName);
  if (fs.existsSync(roleFile)) {
    return { data: readJsonFile(roleFile), source: roleFile };
  }

  const charFile = path.join(charDir, fileName);
  if (fs.existsSync(charFile)) {
    return { data: readJsonFile(charFile), source: charFile };
  }

  return { data: null, source: null };
}

/**
 * Collects section notes from JSON data.
 */
export function collectSectionNotes(data, dictionaries) {
  if (!data || !Array.isArray(data.notes)) return [];
  return data.notes
    .map((n) => extractEnglishNote(n))
    .filter(Boolean)
    .map((note) =>
      markdownToSafeHtml(note, dictionaries, { stripParagraphs: true }),
    );
}

/**
 * Normalizes one role build.
 */
export function normalizeRoleBuild({
  roleId,
  roleDir,
  charDir,
  characterMetadata,
  weaponType,
  dictionaries,
  mappings,
  canonicalWeapons = null,
}) {
  const buildNotesFile = path.join(roleDir, 'build-notes.json');
  const buildNotes = fs.existsSync(buildNotesFile)
    ? readJsonFile(buildNotesFile)
    : {};

  // Display Name
  const rawRoleName = extractEnglishNote(buildNotes?.name);
  const displayName = rawRoleName
    ? parseInlineTokens(rawRoleName, dictionaries)
    : toTitleCase(roleId);

  // Version and status
  const roleVersion = normalizeVersion(buildNotes?.last_updated);
  const defaultVersion = normalizeVersion(characterMetadata?.last_updated);
  const reviewedVersion = roleVersion || defaultVersion || '';
  const isWip = reviewedVersion.toUpperCase() === 'WIP';
  const isBest = Boolean(buildNotes?.best);
  const status = isWip ? 'wip' : 'available';

  // 1. Weapons Section
  const weaponsResult = loadWithFallback(roleDir, charDir, 'weapons.json');
  const rawWeapons = weaponsResult.data || {};
  const weaponGroups = Array.isArray(rawWeapons.weapons)
    ? rawWeapons.weapons
    : [];

  const rankedWeaponGroups = weaponGroups.map((group, idx) => ({
    rank: idx + 1,
    items: (group.items || []).map((item) =>
      resolveWeaponItem(
        item,
        weaponType.toLowerCase(),
        dictionaries,
        mappings.weaponMap,
        canonicalWeapons,
      ),
    ),
  }));

  const conditionalWeapons = Array.isArray(rawWeapons.conditional)
    ? rawWeapons.conditional.map((item) =>
      resolveWeaponItem(
        item,
        weaponType.toLowerCase(),
        dictionaries,
        mappings.weaponMap,
        canonicalWeapons,
      ),
    )
    : [];

  const weapons = {
    rankedGroups: rankedWeaponGroups,
    conditional: conditionalWeapons,
    sectionNotes: collectSectionNotes(rawWeapons, dictionaries),
  };

  // 2. Artifacts Section
  const setsResult = loadWithFallback(roleDir, charDir, 'artifacts-sets.json');
  const rawSets = setsResult.data || {};
  const rankedArtifactGroups = (rawSets.artifact_sets || []).map(
    (rank, idx) => ({
      rank: idx + 1,
      groups: (rank.groups || []).map((grp) =>
        normalizeArtifactCombinationGroup(
          grp,
          dictionaries,
          mappings.pseudoSetMap,
          mappings.artifactSetMap,
        ),
      ),
    }),
  );

  const conditionalArtifacts = (rawSets.conditional || [])
    .flatMap((c) => c.groups || [c])
    .map((grp) =>
      normalizeArtifactCombinationGroup(
        grp,
        dictionaries,
        mappings.pseudoSetMap,
        mappings.artifactSetMap,
      ),
    );

  const mainStatsResult = loadWithFallback(
    roleDir,
    charDir,
    'artifacts-mainstats.json',
  );
  const rawMainStats = mainStatsResult.data || {};
  const mainStatsData = rawMainStats.main_stats || {};

  const mainStats = {
    sands: (mainStatsData.sands || []).map((stat) =>
      resolveStatOption(stat, dictionaries),
    ),
    goblet: (mainStatsData.goblet || []).map((stat) =>
      resolveStatOption(stat, dictionaries),
    ),
    circlet: (mainStatsData.circlet || []).map((stat) =>
      resolveStatOption(stat, dictionaries),
    ),
    sectionNotes: collectSectionNotes(rawMainStats, dictionaries),
  };

  const substatsResult = loadWithFallback(
    roleDir,
    charDir,
    'artifacts-substats.json',
  );
  const rawSubstats = substatsResult.data || {};
  const substatsPriority = rawSubstats.substats_priority || [];

  const substatPriorityGroups = substatsPriority.map((entry, idx) => {
    const items =
      entry && Array.isArray(entry.items)
        ? entry.items.map((sub) => resolveStatOption(sub, dictionaries))
        : [resolveStatOption(entry, dictionaries)];
    return {
      rank: idx + 1,
      items,
    };
  });

  const substats = {
    priorityGroups: substatPriorityGroups,
    sectionNotes: collectSectionNotes(rawSubstats, dictionaries),
  };

  const artifacts = {
    rankedGroups: rankedArtifactGroups,
    conditional: conditionalArtifacts,
    mainStats,
    substats,
    sectionNotes: collectSectionNotes(rawSets, dictionaries),
  };

  // 3. Talents Section
  const talentsResult = loadWithFallback(roleDir, charDir, 'talents.json');
  const rawTalents = talentsResult.data || {};
  const talentPriorities = rawTalents.talents || [];

  const talentPriorityGroups = talentPriorities.map((entry, idx) => ({
    rank: idx + 1,
    isApproximate: Boolean(entry.approx),
    items: (entry.items || []).map((item) =>
      resolveTalentItem(item, dictionaries),
    ),
  }));

  const talents = {
    priorityGroups: talentPriorityGroups,
    sectionNotes: collectSectionNotes(rawTalents, dictionaries),
  };

  // 4. Notes Section
  const rawNotesList = Array.isArray(buildNotes?.notes) ? buildNotes.notes : [];
  const notes = rawNotesList
    .map((n) => extractEnglishNote(n))
    .filter(Boolean)
    .map((rawMarkdown) => ({
      rawMarkdown,
      renderedHtml: markdownToSafeHtml(rawMarkdown, dictionaries),
    }));

  // 5. Gameplay Tips
  const rawTipsList = Array.isArray(buildNotes?.tips) ? buildNotes.tips : [];
  const gameplayTips = rawTipsList.map((tip) => {
    const rawTitle = extractEnglishNote(tip?.title) || '';
    const rawContent = extractEnglishNote(tip?.content) || '';
    return {
      title: parseInlineTokens(rawTitle, dictionaries),
      rawContentMarkdown: rawContent,
      renderedHtml: markdownToSafeHtml(rawContent, dictionaries),
    };
  });

  // 6. Calculation Credits
  const calculationCredits = [];
  const creditCategories = [
    { key: 'global', cat: 'global' },
    { key: 'weapons', cat: 'weapon' },
    { key: 'artifacts', cat: 'artifact' },
    { key: 'artifact', cat: 'artifact' },
    { key: 'talents', cat: 'talent' },
    { key: 'talent', cat: 'talent' },
  ];

  for (const { key, cat } of creditCategories) {
    if (buildNotes?.[key]) {
      const items = Array.isArray(buildNotes[key])
        ? buildNotes[key]
        : [buildNotes[key]];
      for (const item of items) {
        if (!item || !item.link) continue;
        const link = String(item.link).trim();
        if (!link.startsWith('https://')) {
          throw new Error(
            `Insecure or invalid credit URL detected in ${roleDir}: "${link}". HTTPS is strictly required.`,
          );
        }

        const credit = {
          category: cat,
          author: String(item.author || '').trim(),
          link,
        };

        if (item.detail) {
          const detailEn =
            extractEnglishNote(item.detail) || String(item.detail);
          credit.detail = markdownToSafeHtml(detailEn, dictionaries, {
            stripParagraphs: true,
          });
        }

        calculationCredits.push(credit);
      }
    }
  }

  return {
    roleId,
    displayName,
    isBest,
    reviewedVersion,
    isWip,
    status,
    weapons,
    artifacts,
    talents,
    notes,
    gameplayTips,
    calculationCredits,
  };
}

/**
 * Normalizes one character entry with all of its roles.
 */
export function normalizeCharacterBuild({
  element,
  rarity,
  characterSlug,
  characterDir,
  dictionaries,
  mappings,
  canonicalWeapons = null,
}) {
  const metadataPath = path.join(characterDir, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing metadata.json for character at ${characterDir}`);
  }

  const metadata = readJsonFile(metadataPath);
  const rawWeaponType = String(
    metadata.weapon || metadata.weapon_type || 'sword',
  ).toLowerCase();
  const weaponType = toTitleCase(rawWeaponType);
  const charRarity =
    typeof metadata.rarity === 'number'
      ? metadata.rarity
      : parseInt(String(rarity || '5'), 10);

  const publicSlug =
    characterSlug === 'traveler' ? `${element}-traveler` : characterSlug;

  const characterId = mappings.characterMap[publicSlug];
  if (!characterId) {
    throw new Error(
      `Character slug "${publicSlug}" (${characterDir}) is not mapped in characterMap.json!`,
    );
  }

  const characterName =
    characterSlug === 'traveler'
      ? `${dictionaries.elements[element] || toTitleCase(element)} Traveler`
      : dictionaries.characters[characterSlug] ||
      dictionaries.characters[characterSlug.toLowerCase()] ||
      toTitleCase(characterSlug);

  // Scan role subdirectories
  const roleEntries = fs
    .readdirSync(characterDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();

  if (roleEntries.length === 0) {
    throw new Error(`Character "${publicSlug}" has no role build directories!`);
  }

  const roles = roleEntries.map((roleId) => {
    const roleDir = path.join(characterDir, roleId);
    return normalizeRoleBuild({
      roleId,
      roleDir,
      charDir: characterDir,
      characterMetadata: metadata,
      weaponType,
      dictionaries,
      mappings,
      canonicalWeapons,
    });
  });

  return {
    characterId,
    characterSlug: publicSlug,
    characterName,
    element: toTitleCase(element),
    rarity: charRarity,
    weaponType,
    roles,
  };
}

/**
 * Validates the complete normalized catalog against schema and sanity invariants.
 */
export function validateCatalogSchema(catalog) {
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('Catalog root is not an object');
  }

  if (catalog.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Invalid schemaVersion: expected ${SCHEMA_VERSION}, received ${catalog.schemaVersion}`,
    );
  }

  if (!catalog.generatedAt || typeof catalog.generatedAt !== 'string') {
    throw new Error('Missing or invalid generatedAt timestamp');
  }

  if (
    !catalog.sourceCommitSha ||
    !/^[0-9a-f]{40}$/i.test(catalog.sourceCommitSha)
  ) {
    throw new Error(
      `Invalid sourceCommitSha: expected 40-character hex SHA, received "${catalog.sourceCommitSha}"`,
    );
  }

  if (catalog.normalizerVersion !== NORMALIZER_VERSION) {
    throw new Error(
      `Invalid normalizerVersion: expected ${NORMALIZER_VERSION}, received "${catalog.normalizerVersion}"`,
    );
  }

  if (
    !catalog.mappingFingerprint ||
    !/^[0-9a-f]{64}$/i.test(catalog.mappingFingerprint)
  ) {
    throw new Error(
      `Invalid mappingFingerprint: expected 64-character SHA256 hex, received "${catalog.mappingFingerprint}"`,
    );
  }

  if (!Array.isArray(catalog.characters)) {
    throw new Error('Catalog characters is not an array');
  }

  if (catalog.characters.length !== 129) {
    throw new Error(
      `Character count mismatch: expected 129 characters, found ${catalog.characters.length}`,
    );
  }

  const characterIds = new Set();
  const characterSlugs = new Set();
  let totalRoles = 0;
  const travelerVariants = new Set();

  for (const char of catalog.characters) {
    if (!char.characterId || typeof char.characterId !== 'string') {
      throw new Error(
        `Character entry missing characterId: ${JSON.stringify(char)}`,
      );
    }
    if (characterIds.has(char.characterId)) {
      throw new Error(`Duplicate characterId in catalog: ${char.characterId}`);
    }
    characterIds.add(char.characterId);

    if (characterSlugs.has(char.characterSlug)) {
      throw new Error(
        `Duplicate characterSlug in catalog: ${char.characterSlug}`,
      );
    }
    characterSlugs.add(char.characterSlug);

    if (char.characterId.startsWith('Traveler')) {
      travelerVariants.add(char.characterId);
    }

    if (!Array.isArray(char.roles) || char.roles.length === 0) {
      throw new Error(`Character ${char.characterId} has no roles`);
    }

    totalRoles += char.roles.length;

    for (const role of char.roles) {
      if (!role.roleId || !role.displayName) {
        throw new Error(
          `Character ${char.characterId} role missing roleId or displayName`,
        );
      }

      // Check weapon invariants
      for (const group of role.weapons.rankedGroups) {
        for (const item of group.items) {
          if (item.isToolkitItem && !item.toolkitWeaponId) {
            throw new Error(
              `Weapon ${item.sourceWeaponId} flagged as isToolkitItem but has null toolkitWeaponId`,
            );
          }
          if (!item.isToolkitItem && item.toolkitWeaponId !== null) {
            throw new Error(
              `Weapon ${item.sourceWeaponId} not flagged as isToolkitItem but has non-null toolkitWeaponId`,
            );
          }
        }
      }

      // Check calculation credit URL invariant
      for (const credit of role.calculationCredits) {
        if (!credit.link || !credit.link.startsWith('https://')) {
          throw new Error(
            `Calculation credit has non-HTTPS URL in role ${role.roleId}: ${credit.link}`,
          );
        }
      }
    }
  }

  if (totalRoles !== 184) {
    throw new Error(
      `Total role builds mismatch: expected 184 roles, found ${totalRoles}`,
    );
  }

  const expectedTravelers = [
    'TravelerAnemo',
    'TravelerGeo',
    'TravelerElectro',
    'TravelerDendro',
    'TravelerHydro',
    'TravelerPyro',
    'TravelerCryo',
  ];
  for (const t of expectedTravelers) {
    if (!travelerVariants.has(t)) {
      throw new Error(`Missing expected Traveler variant: ${t}`);
    }
  }

  return true;
}

/**
 * Main importer orchestrator.
 */
export async function runImporter({
  sourceDir,
  outputFile = 'src/data/builds.json',
  mappingsDir = 'src/data/mappings',
  charactersFile = 'src/data/characters.json',
  travelerFile = 'src/data/traveler.json',
  weaponsFile = 'src/data/weapons.json',
  artifactsFile = 'src/data/artifacts.json',
  sourceCommit = null,
  force = false,
  validateOnly = false,
  allowDirty = false,
}) {
  const startTime = Date.now();
  console.log('--- Starting Character Builds Normalization Engine (CB2A) ---');

  // 1. Verify source checkout integrity & commit SHA
  verifySourceIntegrity(sourceDir, { allowDirty });
  const sourceCommitSha = getSourceCommitSha(sourceDir, sourceCommit);

  // 2. Compute comprehensive catalog fingerprint
  const mappingFingerprint = computeCatalogFingerprint({
    mappingsDir,
    charactersFile,
    travelerFile,
    weaponsFile,
    artifactsFile,
    normalizerVersion: NORMALIZER_VERSION,
    schemaVersion: SCHEMA_VERSION,
  });

  console.log(`Source Commit SHA:     ${sourceCommitSha}`);
  console.log(`Normalizer Version:    ${NORMALIZER_VERSION}`);
  console.log(`Schema Version:        ${SCHEMA_VERSION}`);
  console.log(`Mapping Fingerprint:   ${mappingFingerprint}`);

  // 3. Check if output is already up to date (fingerprint cache check)
  if (!force && fs.existsSync(outputFile)) {
    try {
      const existing = readJsonFile(outputFile);
      if (
        existing.sourceCommitSha === sourceCommitSha &&
        existing.mappingFingerprint === mappingFingerprint &&
        existing.normalizerVersion === NORMALIZER_VERSION &&
        existing.schemaVersion === SCHEMA_VERSION
      ) {
        if (validateOnly) {
          validateCatalogSchema(existing);
          console.log(
            'Existing catalog matches fingerprints and passed schema validation (--validate-only).',
          );
        } else {
          console.log(
            'Output file is already up to date with matching SHA and mapping fingerprint.',
          );
          console.log('Use --force to regenerate regardless.');
        }
        return {
          upToDate: true,
          catalog: existing,
          sourceCommitSha,
          mappingFingerprint,
        };
      }
    } catch {
      // If unparseable, proceed to regenerate
    }
  }

  // 4. Load dictionaries, mappings, and canonical game catalogs
  console.log('Loading upstream dictionaries and project mappings...');
  const dictionaries = loadUpstreamDictionaries(sourceDir);
  const mappings = loadProjectMappings(mappingsDir);
  const canonicalWeapons = loadCanonicalWeapons(weaponsFile);

  // 5. Discover and traverse content tree
  console.log('Traversing content tree and normalizing builds...');
  const characters = [];
  const contentDir = path.join(sourceDir, 'src', 'content');

  const elements = fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'site')
    .map((e) => e.name)
    .sort();

  for (const element of elements) {
    const elementDir = path.join(contentDir, element);
    const rarities = fs
      .readdirSync(elementDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const rarity of rarities) {
      const rarityDir = path.join(elementDir, rarity);
      const chars = fs
        .readdirSync(rarityDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();

      for (const characterSlug of chars) {
        const characterDir = path.join(rarityDir, characterSlug);
        const metadataPath = path.join(characterDir, 'metadata.json');
        if (!fs.existsSync(metadataPath)) continue;

        const normalizedChar = normalizeCharacterBuild({
          element,
          rarity,
          characterSlug,
          characterDir,
          dictionaries,
          mappings,
          canonicalWeapons,
        });

        characters.push(normalizedChar);
      }
    }
  }

  // Sort characters by characterId for deterministic catalog order
  characters.sort((a, b) => a.characterId.localeCompare(b.characterId));

  const catalog = {
    schemaVersion: SCHEMA_VERSION,
    licenseNotice: LICENSE_NOTICE,
    sourceAttribution: SOURCE_ATTRIBUTION_URL,
    sourceCommitSha,
    normalizerVersion: NORMALIZER_VERSION,
    mappingFingerprint,
    generatedAt: new Date().toISOString(),
    characters,
  };

  // 6. Validation gate
  console.log('Executing schema validation and integrity assertions...');
  validateCatalogSchema(catalog);

  if (validateOnly) {
    console.log(
      'Validation passed! (--validate-only set: no output file written)',
    );
    return { upToDate: false, catalog, sourceCommitSha, mappingFingerprint };
  }

  // 7. Safe atomic publishing via same-directory staging
  const targetDir = path.dirname(path.resolve(outputFile));
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Create staging file strictly in the same directory as destination to ensure same-filesystem atomic rename
  const stagingFile = path.join(
    targetDir,
    `.builds-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.tmp`,
  );

  try {
    console.log(`Writing staged catalog to ${stagingFile}...`);
    fs.writeFileSync(
      stagingFile,
      JSON.stringify(catalog, null, 2) + '\n',
      'utf8',
    );

    // Validate staged file by reading it back from disk prior to publication
    const stagedContent = readJsonFile(stagingFile);
    validateCatalogSchema(stagedContent);

    // Atomic replacement using same-filesystem renameSync
    // Guarantees existing published destination is never deleted or truncated before replacement
    console.log(`Atomically publishing catalog to ${outputFile}...`);
    try {
      fs.renameSync(stagingFile, outputFile);
    } catch (renameError) {
      throw new Error(
        `Failed to atomically replace destination file ${outputFile} with staged catalog: ${renameError.message}. Existing destination preserved byte-for-byte.`,
        { cause: renameError },
      );
    }
  } finally {
    // Attempt best-effort cleanup of temporary staging file if still present
    // Note: Staging cleanup in finally cannot execute after abrupt process termination or power failure
    if (fs.existsSync(stagingFile)) {
      try {
        fs.unlinkSync(stagingFile);
      } catch {
        // Ignored best-effort cleanup
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const fileSizeKb = Math.round(fs.statSync(outputFile).size / 1024);

  console.log('--- Character Builds Catalog Generation Complete ---');
  console.log(`Published catalog:   ${outputFile} (${fileSizeKb} KB)`);
  console.log(`Total Characters:    ${catalog.characters.length}`);
  const totalRolesCount = catalog.characters.reduce(
    (acc, c) => acc + c.roles.length,
    0,
  );
  console.log(`Total Role Builds:   ${totalRolesCount}`);
  console.log(`Execution Duration:  ${durationMs}ms`);

  return { upToDate: false, catalog, sourceCommitSha, mappingFingerprint };
}

// CLI Entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let sourceDir = null;
  let outputFile = 'src/data/builds.json';
  let mappingsDir = 'src/data/mappings';
  let charactersFile = 'src/data/characters.json';
  let travelerFile = 'src/data/traveler.json';
  let weaponsFile = 'src/data/weapons.json';
  let artifactsFile = 'src/data/artifacts.json';
  let sourceCommit = null;
  let force = false;
  let validateOnly = false;
  let allowDirty = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--source-dir' && i + 1 < args.length) {
      sourceDir = args[++i];
    } else if (arg === '--output-file' && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (arg === '--mappings-dir' && i + 1 < args.length) {
      mappingsDir = args[++i];
    } else if (arg === '--characters-file' && i + 1 < args.length) {
      charactersFile = args[++i];
    } else if (arg === '--traveler-file' && i + 1 < args.length) {
      travelerFile = args[++i];
    } else if (arg === '--weapons-file' && i + 1 < args.length) {
      weaponsFile = args[++i];
    } else if (arg === '--artifacts-file' && i + 1 < args.length) {
      artifactsFile = args[++i];
    } else if (arg === '--source-commit' && i + 1 < args.length) {
      sourceCommit = args[++i];
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--validate-only') {
      validateOnly = true;
    } else if (arg === '--allow-dirty') {
      allowDirty = true;
    }
  }

  if (!sourceDir) {
    const defaultScratch = path.resolve(
      process.cwd(),
      '../.gemini/antigravity/brain/83029ac3-ae6f-49dd-bc83-f3de1dee8eb1/scratch/genshin-builds',
    );
    if (fs.existsSync(defaultScratch)) {
      sourceDir = defaultScratch;
    } else {
      console.error('Error: --source-dir <path> argument is required.');
      process.exit(1);
    }
  }

  runImporter({
    sourceDir,
    outputFile,
    mappingsDir,
    charactersFile,
    travelerFile,
    weaponsFile,
    artifactsFile,
    sourceCommit,
    force,
    validateOnly,
    allowDirty,
  }).catch((err) => {
    console.error('Importer Error:', err.message);
    process.exit(1);
  });
}
