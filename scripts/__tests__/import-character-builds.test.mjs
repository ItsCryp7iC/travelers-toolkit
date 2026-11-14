import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  SCHEMA_VERSION,
  NORMALIZER_VERSION,
  LICENSE_NOTICE,
  SOURCE_ATTRIBUTION_URL,
  escapeHtml,
  normalizeVersion,
  toTitleCase,
  parseInlineTokens,
  renderRotationBadges,
  markdownToSafeHtml,
  resolveWeaponItem,
  resolveArtifactItem,
  computeCatalogFingerprint,
  loadCanonicalWeapons,
  verifySourceIntegrity,
  validateCatalogSchema,
  loadProjectMappings,
  runImporter,
} from '../import-character-builds.mjs';

const MAPPINGS_DIR = path.resolve('src/data/mappings');
const BUILDS_PATH = path.resolve('src/data/builds.json');
const WEAPONS_PATH = path.resolve('src/data/weapons.json');
const CHARACTERS_PATH = path.resolve('src/data/characters.json');
const TRAVELER_PATH = path.resolve('src/data/traveler.json');
const SOURCE_DIR = path.resolve(
  'C:/Users/Cryptic/.gemini/antigravity/brain/83029ac3-ae6f-49dd-bc83-f3de1dee8eb1/scratch/genshin-builds',
);

describe('Character Builds Importer & Normalization Engine (CB2A)', () => {
  // Mock dictionaries for fast unit testing of pure functions
  const mockDictionaries = {
    characters: {
      furina: 'Furina',
      'shogun-raiden': 'Raiden Shogun',
    },
    weapons: {
      'staff-of-homa': 'Staff of Homa',
      'the-catch': 'The Catch',
      'exaiphanes-blade': 'Exaiphanes Blade',
    },
    artifactSets: {
      'viridescent-venerer': 'Viridescent Venerer',
      'emblem-of-severed-fate': 'Emblem of Severed Fate',
    },
    stats: {
      er: 'Energy Recharge',
      'atk%': 'ATK%',
      'atk-set': '+18% ATK set',
      'em-set': '+80 EM set',
    },
    elements: {
      pyro: 'Pyro',
      hydro: 'Hydro',
      anemo: 'Anemo',
      vaporize: 'Vaporize',
    },
    abilities: {
      burst: 'Elemental Burst',
      skill: 'Elemental Skill',
      na: 'Normal Attack',
    },
    notes: {
      'er-req': 'Energy Recharge requirement',
    },
    aliases: {
      weapon: {
        homa: 'staff-of-homa',
        catch: 'the-catch',
      },
      set: {
        vv: 'viridescent-venerer',
        emblem: 'emblem-of-severed-fate',
      },
    },
    sharedWeapons: {
      polearm: {
        'staff-of-homa': { rarity: 5 },
        'the-catch': { rarity: 4 },
      },
      sword: {
        'exaiphanes-blade': { rarity: 5 },
      },
    },
  };

  const mockWeaponMap = {
    'staff-of-homa': 'StaffOfHoma',
    'the-catch': 'TheCatch',
    'exaiphanes-blade': null,
  };

  const mockPseudoSetMap = {
    'atk-set': { label: '+18% ATK set', tag: 'atk-set' },
    'em-set': { label: '+80 EM set', tag: 'em-set' },
  };

  describe('1. Pure Normalization & Token Parsing Functions', () => {
    it('normalizes version strings with multiple slash variations and whitespace', () => {
      expect(normalizeVersion(' 6.7/Luna VIII ')).toBe('6.7 / Luna VIII');
      expect(normalizeVersion('5.4')).toBe('5.4');
      expect(normalizeVersion('  7.0  ')).toBe('7.0');
      expect(normalizeVersion(null)).toBe('');
      expect(normalizeVersion(undefined)).toBe('');
    });

    it('converts slugs to Title Case', () => {
      expect(toTitleCase('shogun-raiden')).toBe('Shogun Raiden');
      expect(toTitleCase('dps-energy-support')).toBe('Dps Energy Support');
      expect(toTitleCase('traveler')).toBe('Traveler');
    });

    it('escapes raw HTML entities accurately', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
      );
      expect(escapeHtml("Tom & 'Jerry'")).toBe('Tom &amp; &#39;Jerry&#39;');
    });

    it('resolves explicit token labels without modification', () => {
      const input = 'Equip [[weapon:the-catch|Custom Catch Label]]';
      const output = parseInlineTokens(input, mockDictionaries);
      expect(output).toBe('Equip Custom Catch Label');
    });

    it('resolves category tokens from respective dictionaries', () => {
      expect(parseInlineTokens('[[character:furina]]', mockDictionaries)).toBe(
        'Furina',
      );
      expect(
        parseInlineTokens('[[weapon:staff-of-homa]]', mockDictionaries),
      ).toBe('Staff of Homa');
      expect(parseInlineTokens('[[stat:er]]', mockDictionaries)).toBe(
        'Energy Recharge',
      );
      expect(parseInlineTokens('[[element:pyro]]', mockDictionaries)).toBe(
        'Pyro',
      );
      expect(parseInlineTokens('[[ability:burst]]', mockDictionaries)).toBe(
        'Elemental Burst',
      );
    });

    it('resolves weapon and set aliases inside tokens', () => {
      expect(parseInlineTokens('[[weapon:homa]]', mockDictionaries)).toBe(
        'Staff of Homa',
      );
      expect(parseInlineTokens('[[set:vv]]', mockDictionaries)).toBe(
        'Viridescent Venerer',
      );
    });

    it('recovers from misspelled token categories', () => {
      expect(parseInlineTokens('[[abillity:burst]]', mockDictionaries)).toBe(
        'Elemental Burst',
      );
      expect(parseInlineTokens('[[elemento:pyro]]', mockDictionaries)).toBe(
        'Pyro',
      );
      expect(
        parseInlineTokens('[[personaggio:furina]]', mockDictionaries),
      ).toBe('Furina');
    });

    it('resolves case-insensitive element tokens like Vaporize', () => {
      expect(parseInlineTokens('[[element:Vaporize]]', mockDictionaries)).toBe(
        'Vaporize',
      );
    });

    it('performs cascading lookup for untagged tokens', () => {
      expect(parseInlineTokens('[[furina]]', mockDictionaries)).toBe('Furina');
      expect(parseInlineTokens('[[staff-of-homa]]', mockDictionaries)).toBe(
        'Staff of Homa',
      );
      expect(parseInlineTokens('[[er]]', mockDictionaries)).toBe(
        'Energy Recharge',
      );
    });

    it('renders rotation markers into semantic badges with attribute escaping', () => {
      const input = 'Rotation: {rot:E C Q} then repeat';
      const output = renderRotationBadges(input);
      expect(output).toBe(
        'Rotation: <span class="tt-rotation-badge" data-rotation="E C Q">E C Q</span> then repeat',
      );
    });
  });

  describe('2. Comprehensive Markdown & HTML Security Tests', () => {
    it('converts markdown syntax into safe HTML', () => {
      const input =
        '**Bold text**, *italic text*, and `code snippet`.\n\n[Docs Link](https://example.com/guide)';
      const output = markdownToSafeHtml(input, mockDictionaries);
      expect(output).toContain('<strong>Bold text</strong>');
      expect(output).toContain('<em>italic text</em>');
      expect(output).toContain('<code>code snippet</code>');
      expect(output).toContain(
        '<a href="https://example.com/guide" target="_blank" rel="noopener noreferrer">Docs Link</a>',
      );
      expect(output).toContain('<p>');
    });

    it('defangs and neutralizes script and event-handler attacks', () => {
      const hostile = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<body onload=alert(1)>',
        '<a href="https://example.com" onclick="alert(1)">click</a>',
        '<input autofocus onfocus=alert(1)>',
      ];
      for (const h of hostile) {
        const out = markdownToSafeHtml(h, mockDictionaries);
        expect(out).not.toContain('<script');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('<svg');
        expect(out).not.toContain('<body');
        expect(out).not.toContain('onerror=');
        expect(out).not.toContain('onload=');
        expect(out).not.toContain('onclick=');
        expect(out).not.toContain('onfocus=');
      }
    });

    it('neutralizes dangerous and obfuscated URI schemes in markdown links', () => {
      const dangerousLinks = [
        '[Link](javascript:alert(1))',
        '[Link](data:text/html,<script>alert(1)</script>)',
        '[Link](vbscript:msgbox(1))',
        '[Link](  javascript:alert(1))',
        '[Link](https://example.com" onclick="alert(1))',
        '[Link](http://insecure-http-link.com)',
      ];
      for (const link of dangerousLinks) {
        const out = markdownToSafeHtml(link, mockDictionaries);
        expect(out).not.toContain('href="javascript:');
        expect(out).not.toContain('href="data:');
        expect(out).not.toContain('href="vbscript:');
        expect(out).not.toContain('href="http://');
        expect(out).not.toContain('onclick=');
        // Renders safe link label text only
        expect(out).toContain('Link');
      }
    });

    it('prevents attribute breakout in rotation notation', () => {
      const hostileRot = '{rot:E" onmouseover="alert(1)}';
      const out = markdownToSafeHtml(hostileRot, mockDictionaries);
      expect(out).not.toContain('onmouseover="alert(1)}"');
      expect(out).toContain('&quot; onmouseover=&quot;alert(1)');
      expect(out).toContain('class="tt-rotation-badge"');
    });

    it('safely escapes custom token labels containing markup', () => {
      const hostileToken = '[[weapon:staff-of-homa|<script>alert(1)</script>]]';
      const out = markdownToSafeHtml(hostileToken, mockDictionaries);
      expect(out).not.toContain('<script>');
      expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('defangs nested and malformed tags', () => {
      const malformed = '<<script>script>alert(1)<</script>/script>';
      const out = markdownToSafeHtml(malformed, mockDictionaries);
      expect(out).not.toContain('<script>');
      expect(out).toContain('&lt;&lt;script&gt;script&gt;');
    });

    it('formats single-line notes when stripParagraphs option is enabled', () => {
      const input = 'Line 1\nLine 2';
      const output = markdownToSafeHtml(input, mockDictionaries, {
        stripParagraphs: true,
      });
      expect(output).toBe('Line 1<br />Line 2');
      expect(output).not.toContain('<p>');
    });
  });

  describe('3. Weapon & Artifact Resolution Invariants', () => {
    it('resolves mapped weapons with toolkitWeaponId and isToolkitItem: true', () => {
      const weapon = resolveWeaponItem(
        { name: 'staff-of-homa', refinement: '5' },
        'polearm',
        mockDictionaries,
        mockWeaponMap,
      );
      expect(weapon.sourceWeaponId).toBe('staff-of-homa');
      expect(weapon.toolkitWeaponId).toBe('StaffOfHoma');
      expect(weapon.isToolkitItem).toBe(true);
      expect(weapon.name).toBe('Staff of Homa');
      expect(weapon.rarity).toBe(5);
      expect(weapon.refinement).toBe(5);
    });

    it('strictly preserves unmapped weapon exaiphanes-blade as source-only with null toolkitWeaponId', () => {
      const weapon = resolveWeaponItem(
        'exaiphanes-blade',
        'sword',
        mockDictionaries,
        mockWeaponMap,
      );
      expect(weapon.sourceWeaponId).toBe('exaiphanes-blade');
      expect(weapon.toolkitWeaponId).toBeNull();
      expect(weapon.isToolkitItem).toBe(false);
      expect(weapon.name).toBe('Exaiphanes Blade');
      expect(weapon.rarity).toBe(5);
    });

    it('correctly classifies pseudo-sets as non-equipable categories', () => {
      const item = resolveArtifactItem(
        { name: 'atk-set', pieces: 2 },
        mockDictionaries,
        mockPseudoSetMap,
        {},
      );
      expect(item.sourceSetId).toBe('atk-set');
      expect(item.isPseudoSet).toBe(true);
      expect(item.pseudoStatTag).toBe('atk-set');
      expect(item.name).toBe('+18% ATK set');
      expect(item.toolkitSetId).toBeNull();
      expect(item.isToolkitItem).toBe(false);
      expect(item.pieces).toBe(2);
    });

    it('correctly handles real artifact sets without synthetic entity creation', () => {
      const item = resolveArtifactItem(
        { name: 'viridescent-venerer', pieces: 4 },
        mockDictionaries,
        mockPseudoSetMap,
        {},
      );
      expect(item.sourceSetId).toBe('viridescent-venerer');
      expect(item.isPseudoSet).toBe(false);
      expect(item.pseudoStatTag).toBeUndefined();
      expect(item.name).toBe('Viridescent Venerer');
      expect(item.toolkitSetId).toBeNull();
      expect(item.isToolkitItem).toBe(false);
      expect(item.pieces).toBe(4);
    });

    it('canonical weapons database contains exactly 252 weapons loaded without filtering', () => {
      const canonical = JSON.parse(fs.readFileSync(WEAPONS_PATH, 'utf8'));
      expect(canonical).toHaveLength(252);
      const { byId, byName } = loadCanonicalWeapons(WEAPONS_PATH);
      expect(byId.size).toBe(252);
      expect(byName.size).toBe(252);
    });
  });

  describe('4. Exaiphanes Blade Automatic Resolution & Fingerprint Regression Test', () => {
    it('executes full Exaiphanes Blade regression lifecycle', () => {
      // Step 1: Base state with canonical weapons.json
      const canonicalWeaponsBase = loadCanonicalWeapons(WEAPONS_PATH);
      const mappings = loadProjectMappings(MAPPINGS_DIR);

      // Step 2: Confirm Exaiphanes Blade has toolkitWeaponId: null
      const baseWeapon = resolveWeaponItem(
        'exaiphanes-blade',
        'sword',
        mockDictionaries,
        mappings.weaponMap,
        canonicalWeaponsBase,
      );
      expect(baseWeapon.sourceWeaponId).toBe('exaiphanes-blade');
      expect(baseWeapon.toolkitWeaponId).toBeNull();
      expect(baseWeapon.isToolkitItem).toBe(false);

      const baseFingerprint = computeCatalogFingerprint({
        mappingsDir: MAPPINGS_DIR,
        weaponsFile: WEAPONS_PATH,
      });

      // Step 3: Create temporary copy of canonical weapon data with Exaiphanes Blade
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-test-'));
      const tempWeaponsFile = path.join(tempDir, 'weapons.json');
      const canonicalWeaponsData = JSON.parse(
        fs.readFileSync(WEAPONS_PATH, 'utf8'),
      );
      const augmentedWeaponsData = [
        ...canonicalWeaponsData,
        {
          id: 'ExaiphanesBlade',
          name: 'Exaiphanes Blade',
          rarity: '★★★★★',
          weapon_type: 'Sword',
        },
      ];
      fs.writeFileSync(
        tempWeaponsFile,
        JSON.stringify(augmentedWeaponsData, null, 2),
        'utf8',
      );

      // Step 4 & 5: Rebuild / recompute fingerprint; verify it changes
      const augmentedFingerprint = computeCatalogFingerprint({
        mappingsDir: MAPPINGS_DIR,
        weaponsFile: tempWeaponsFile,
      });
      expect(augmentedFingerprint).not.toBe(baseFingerprint);

      // Step 6: Verify Exaiphanes Blade resolves automatically without editing weaponMap.json
      const augmentedCanonicalWeapons =
        loadCanonicalWeapons(tempWeaponsFile);
      const resolvedWeapon = resolveWeaponItem(
        'exaiphanes-blade',
        'sword',
        mockDictionaries,
        mappings.weaponMap,
        augmentedCanonicalWeapons,
      );
      expect(resolvedWeapon.sourceWeaponId).toBe('exaiphanes-blade');
      expect(resolvedWeapon.toolkitWeaponId).toBe('ExaiphanesBlade');
      expect(resolvedWeapon.isToolkitItem).toBe(true);

      // Step 7: Confirm real Toolkit weapon database remains unmodified
      const unmodifiedWeapons = JSON.parse(
        fs.readFileSync(WEAPONS_PATH, 'utf8'),
      );
      expect(unmodifiedWeapons).toHaveLength(252);
      expect(
        unmodifiedWeapons.some((w) => w.id === 'ExaiphanesBlade'),
      ).toBe(false);

      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('5. Source Integrity & Checkout Safeguards', () => {
    it('verifies valid source checkout and required directories', () => {
      expect(verifySourceIntegrity(SOURCE_DIR)).toBe(true);
    });

    it('rejects invalid or missing source directories', () => {
      expect(() =>
        verifySourceIntegrity('C:/non-existent-directory-path'),
      ).toThrow(/Source checkout directory not found/);
    });

    it('rejects source checkouts missing required core element directories', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-source-test-'));
      // Incomplete structure
      fs.mkdirSync(path.join(tempDir, 'src', 'content'), { recursive: true });
      expect(() => verifySourceIntegrity(tempDir)).toThrow(
        /Required upstream source file or directory missing/,
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('6. Atomic Publishing, Staging & Failure Recovery', () => {
    it('never overwrites existing catalog when validation fails', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-atomic-test-'));
      const testOutputFile = path.join(tempDir, 'builds.json');
      const originalContent = '{"preserved": true}';
      fs.writeFileSync(testOutputFile, originalContent, 'utf8');

      // Attempt import with non-existent source dir
      await expect(
        runImporter({
          sourceDir: 'C:/non-existent-source',
          outputFile: testOutputFile,
          force: true,
        }),
      ).rejects.toThrow();

      // Confirm existing file preserved byte-for-byte
      expect(fs.readFileSync(testOutputFile, 'utf8')).toBe(originalContent);

      // Confirm no staging files left behind
      const files = fs.readdirSync(tempDir);
      expect(files).toEqual(['builds.json']);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('respects --validate-only without creating or modifying the output file', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-valonly-test-'));
      const testOutputFile = path.join(tempDir, 'builds.json');

      const result = await runImporter({
        sourceDir: SOURCE_DIR,
        outputFile: testOutputFile,
        validateOnly: true,
        force: true,
      });

      expect(result.upToDate).toBe(false);
      expect(fs.existsSync(testOutputFile)).toBe(false);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('preserves existing catalog byte-for-byte when atomic replacement fails', async () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'tt-atomic-fail-test-'),
      );
      const testOutputFile = path.join(tempDir, 'builds.json');
      const originalContent = '{"existingCatalog": true, "version": 1}\n';
      fs.writeFileSync(testOutputFile, originalContent, 'utf8');

      // Mock fs.renameSync to simulate an atomic replacement failure (e.g. locked file / EBUSY)
      const renameSpy = vi
        .spyOn(fs, 'renameSync')
        .mockImplementationOnce(() => {
          throw new Error('EBUSY: resource busy or locked');
        });

      await expect(
        runImporter({
          sourceDir: SOURCE_DIR,
          outputFile: testOutputFile,
          force: true,
        }),
      ).rejects.toThrow(/Failed to atomically replace destination file/);

      // Verify spy was called and restore original
      expect(renameSpy).toHaveBeenCalled();
      renameSpy.mockRestore();

      // Confirm existing destination file remains 100% preserved byte-for-byte
      expect(fs.readFileSync(testOutputFile, 'utf8')).toBe(originalContent);

      // Confirm temporary staging file was cleaned up by best-effort cleanup
      const remainingFiles = fs.readdirSync(tempDir);
      expect(remainingFiles).toEqual(['builds.json']);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('7. Mapping Tables & Fingerprints', () => {
    it('computes a deterministic 64-character SHA-256 fingerprint', () => {
      const fingerprint1 = computeCatalogFingerprint({
        mappingsDir: MAPPINGS_DIR,
      });
      const fingerprint2 = computeCatalogFingerprint({
        mappingsDir: MAPPINGS_DIR,
      });
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(fingerprint1)).toBe(true);
    });

    it('detects changes to normalizer implementation script', () => {
      const baseFingerprint = computeCatalogFingerprint({
        mappingsDir: MAPPINGS_DIR,
      });
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-script-test-'));
      const tempScript = path.join(tempDir, 'dummy-normalizer.mjs');
      fs.writeFileSync(tempScript, '// Modified normalizer code\n', 'utf8');

      const alteredFingerprint = computeCatalogFingerprint({
        mappingsDir: MAPPINGS_DIR,
        normalizerScriptFile: tempScript,
      });
      expect(alteredFingerprint).not.toBe(baseFingerprint);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('detects changes to canonical game datasets', () => {
      const baseFingerprint = computeCatalogFingerprint({
        mappingsDir: MAPPINGS_DIR,
        weaponsFile: WEAPONS_PATH,
      });
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-fp-test-'));
      const tempWeapons = path.join(tempDir, 'weapons.json');
      fs.writeFileSync(tempWeapons, '[]', 'utf8');

      const changedFingerprint = computeCatalogFingerprint({
        mappingsDir: MAPPINGS_DIR,
        weaponsFile: tempWeapons,
      });
      expect(changedFingerprint).not.toBe(baseFingerprint);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('mapping tables contain expected counts and valid JSON structures', () => {
      const mappings = loadProjectMappings(MAPPINGS_DIR);
      expect(Object.keys(mappings.characterMap)).toHaveLength(129);
      expect(Object.keys(mappings.weaponMap).length).toBeGreaterThanOrEqual(253);
      expect(Object.keys(mappings.pseudoSetMap)).toHaveLength(14);
      expect(mappings.weaponMap['exaiphanes-blade']).toBeNull();
    });
  });

  describe('8. Generated Catalog Static Verification (src/data/builds.json)', () => {
    const catalog = JSON.parse(fs.readFileSync(BUILDS_PATH, 'utf8'));

    it('validates catalog top-level metadata', () => {
      expect(catalog.schemaVersion).toBe(SCHEMA_VERSION);
      expect(catalog.normalizerVersion).toBe(NORMALIZER_VERSION);
      expect(catalog.licenseNotice).toBe(LICENSE_NOTICE);
      expect(catalog.sourceAttribution).toBe(SOURCE_ATTRIBUTION_URL);
      expect(catalog.sourceCommitSha).toBe(
        'be542cba19de28f31e4a352f8711ffaff9d2c838',
      );
      expect(catalog.mappingFingerprint).toHaveLength(64);
      expect(new Date(catalog.generatedAt).getTime()).not.toBeNaN();
    });

    it('passes complete schema and sanity validation gate', () => {
      expect(validateCatalogSchema(catalog)).toBe(true);
    });

    it('contains exactly 129 characters and 184 role builds', () => {
      expect(catalog.characters).toHaveLength(129);
      const totalRoles = catalog.characters.reduce(
        (sum, c) => sum + c.roles.length,
        0,
      );
      expect(totalRoles).toBe(184);
    });

    it('matches exact role distribution per character (83 with 1 role, 37 with 2 roles, 9 with 3 roles)', () => {
      const counts = { 1: 0, 2: 0, 3: 0 };
      for (const char of catalog.characters) {
        counts[char.roles.length] = (counts[char.roles.length] || 0) + 1;
      }
      expect(counts[1]).toBe(83);
      expect(counts[2]).toBe(37);
      expect(counts[3]).toBe(9);
    });

    it('contains all 7 Traveler elements mapped cleanly', () => {
      const travelers = catalog.characters.filter((c) =>
        c.characterId.startsWith('Traveler'),
      );
      expect(travelers).toHaveLength(7);
      const expectedIds = [
        'TravelerAnemo',
        'TravelerGeo',
        'TravelerElectro',
        'TravelerDendro',
        'TravelerHydro',
        'TravelerPyro',
        'TravelerCryo',
      ];
      const actualIds = travelers.map((c) => c.characterId).sort();
      expect(actualIds).toEqual(expectedIds.sort());
      for (const t of travelers) {
        expect(t.weaponType).toBe('Sword');
        expect(t.rarity).toBe(5);
      }
    });

    it('preserves multiple best builds across 23 characters', () => {
      const multiBest = catalog.characters.filter(
        (c) => c.roles.filter((r) => r.isBest).length > 1,
      );
      expect(multiBest).toHaveLength(23);
    });

    it('preserves exaiphanes-blade as an unmapped weapon without synthetic entity in weapons.json', () => {
      const toolkitWeapons = JSON.parse(fs.readFileSync(WEAPONS_PATH, 'utf8'));
      const hasSynthetic = toolkitWeapons.some(
        (w) => w.id === 'ExaiphanesBlade' || w.id === 'exaiphanes-blade',
      );
      expect(hasSynthetic).toBe(false);

      let exaiphanesFound = 0;
      for (const char of catalog.characters) {
        for (const role of char.roles) {
          for (const grp of role.weapons.rankedGroups) {
            for (const item of grp.items) {
              if (item.sourceWeaponId === 'exaiphanes-blade') {
                exaiphanesFound++;
                expect(item.toolkitWeaponId).toBeNull();
                expect(item.isToolkitItem).toBe(false);
                expect(item.name).toBe('Exaiphanes Blade');
                expect(item.rarity).toBe(5);
              }
            }
          }
        }
      }
      expect(exaiphanesFound).toBe(14);
    });

    it('ensures every mapped weapon corresponds to an existing Toolkit weapon ID', () => {
      const toolkitWeapons = JSON.parse(fs.readFileSync(WEAPONS_PATH, 'utf8'));
      const toolkitWeaponIds = new Set(toolkitWeapons.map((w) => w.id));

      for (const char of catalog.characters) {
        for (const role of char.roles) {
          for (const grp of role.weapons.rankedGroups) {
            for (const item of grp.items) {
              if (item.isToolkitItem) {
                expect(toolkitWeaponIds.has(item.toolkitWeaponId)).toBe(true);
              }
            }
          }
        }
      }
    });

    it('ensures all calculation credit URLs use strict HTTPS', () => {
      let creditCount = 0;
      for (const char of catalog.characters) {
        for (const role of char.roles) {
          for (const credit of role.calculationCredits) {
            creditCount++;
            expect(credit.link.startsWith('https://')).toBe(true);
            expect(['global', 'weapon', 'artifact', 'talent']).toContain(
              credit.category,
            );
          }
        }
      }
      expect(creditCount).toBe(102);
    });

    it('ensures canonical game datasets remain completely unmodified', () => {
      const chars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8'));
      const traveler = JSON.parse(fs.readFileSync(TRAVELER_PATH, 'utf8'));
      const weapons = JSON.parse(fs.readFileSync(WEAPONS_PATH, 'utf8'));

      expect(chars).toHaveLength(122);
      expect(traveler).toHaveLength(7);
      expect(weapons).toHaveLength(252);
    });
  });
});
