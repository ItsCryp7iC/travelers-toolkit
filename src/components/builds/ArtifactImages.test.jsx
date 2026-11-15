import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ArtifactRecommendations from './ArtifactRecommendations';
import ArtifactStatPriorities from './ArtifactStatPriorities';
import {
  getArtifactSetIcon,
  getAttributeIcon,
  getAttributeIcons,
  getArtifactSlotIcon,
  ARTIFACT_SET_FILENAMES,
  ATTRIBUTE_FILENAMES,
  PSEUDO_SET_ATTRIBUTE_MAP,
  ARTIFACT_SLOT_MAP,
} from '../../utils/assetHelper';
import rawBuildsCatalog from '../../data/builds.json';

const CDN_BASE = 'https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main';

describe('CB4D: Artifact & Attribute Image Integration Test Suite', () => {
  // ── Area 1: Correct exact artifact filename mappings and case sensitivity ──
  it('1. maps exact artifact filenames with strict case sensitivity', () => {
    // Emblem of Severed Fate uses lowercase 'of'
    expect(getArtifactSetIcon('Emblem of Severed Fate')).toBe(
      `${CDN_BASE}/artifact_sets/EmblemofSeveredFate.png`,
    );
    // Flower of Paradise Lost uses lowercase 'of'
    expect(getArtifactSetIcon('Flower of Paradise Lost')).toBe(
      `${CDN_BASE}/artifact_sets/FlowerofParadiseLost.png`,
    );
    // Echoes of an Offering uses lowercase 'ofan'
    expect(getArtifactSetIcon('Echoes of an Offering')).toBe(
      `${CDN_BASE}/artifact_sets/EchoesofanOffering.png`,
    );
    // Scroll of the Hero of Cinder City uses lowercase 'ofthe' and 'of'
    expect(getArtifactSetIcon('Scroll of the Hero of Cinder City')).toBe(
      `${CDN_BASE}/artifact_sets/ScrolloftheHeroofCinderCity.png`,
    );
    // Tenacity of the Millelith uses lowercase 'ofthe'
    expect(getArtifactSetIcon('Tenacity of the Millelith')).toBe(
      `${CDN_BASE}/artifact_sets/TenacityoftheMillelith.png`,
    );
    // Heart of Depth uses lowercase 'of'
    expect(getArtifactSetIcon('Heart of Depth')).toBe(
      `${CDN_BASE}/artifact_sets/HeartofDepth.png`,
    );
    // Night of the Sky's Unveiling
    expect(getArtifactSetIcon("Night of the Sky's Unveiling")).toBe(
      `${CDN_BASE}/artifact_sets/NightoftheSkysUnveiling.png`,
    );
    // Nighttime Whispers in the Echoing Woods uses lowercase 'inthe'
    expect(getArtifactSetIcon('Nighttime Whispers in the Echoing Woods')).toBe(
      `${CDN_BASE}/artifact_sets/NighttimeWhispersintheEchoingWoods.png`,
    );
    // Blizzard Strayer
    expect(getArtifactSetIcon('Blizzard Strayer')).toBe(
      `${CDN_BASE}/artifact_sets/BlizzardStrayer.png`,
    );
    // Crimson Witch of Flames
    expect(getArtifactSetIcon('Crimson Witch of Flames')).toBe(
      `${CDN_BASE}/artifact_sets/CrimsonWitchofFlames.png`,
    );
    // Silken Moon's Serenade
    expect(getArtifactSetIcon("Silken Moon's Serenade")).toBe(
      `${CDN_BASE}/artifact_sets/SilkenMoonsSerenade.png`,
    );
    expect(getArtifactSetIcon(null, 'sms')).toBe(
      `${CDN_BASE}/artifact_sets/SilkenMoonsSerenade.png`,
    );
  });

  // ── Area 2: Proper set icon rendering for Lisa Aggravate DPS ──
  it('2. renders proper set icons for Lisa Aggravate DPS (Thundering Fury, Gilded Dreams, Thundersoother)', () => {
    const lisa = rawBuildsCatalog.characters.find((c) => c.characterId === 'Lisa');
    const aggRole = lisa.roles.find((r) => r.roleId === 'aggravate-dps');

    const { container } = render(<ArtifactRecommendations artifacts={aggRole.artifacts} />);

    const images = Array.from(container.querySelectorAll('img'));
    const srcs = images.map((img) => img.getAttribute('src'));

    // Thundering Fury
    expect(srcs).toContain(`${CDN_BASE}/artifact_sets/ThunderingFury.png`);
    // Gilded Dreams
    expect(srcs).toContain(`${CDN_BASE}/artifact_sets/GildedDreams.png`);
    // Thundersoother
    expect(srcs).toContain(`${CDN_BASE}/artifact_sets/Thundersoother.png`);
    // +18% ATK pseudo set in chooseTwo pool
    expect(srcs).toContain(`${CDN_BASE}/attributes/ATKPercentage.png`);
  });

  // ── Area 3: Ayaka and Raiden set icon verification ──
  it('3. renders Blizzard Strayer for Ayaka and Emblem of Severed Fate for Raiden', () => {
    const ayaka = rawBuildsCatalog.characters.find(
      (c) => c.characterId === 'KamisatoAyaka' || c.toolkitCharacterId === 'KamisatoAyaka',
    );
    expect(ayaka).toBeDefined();
    const ayakaRole = ayaka.roles[0];
    const { container: ayakaContainer } = render(
      <ArtifactRecommendations artifacts={ayakaRole.artifacts} />,
    );
    const ayakaImages = Array.from(ayakaContainer.querySelectorAll('img'));
    expect(
      ayakaImages.some((img) =>
        img.getAttribute('src')?.includes('BlizzardStrayer.png'),
      ),
    ).toBe(true);

    const raiden = rawBuildsCatalog.characters.find(
      (c) => c.characterId === 'Raiden' || c.toolkitCharacterId === 'RaidenShogun',
    );
    expect(raiden).toBeDefined();
    const raidenRole = raiden.roles.find((r) => r.roleId === 'dps-energy-support');
    const { container: raidenContainer } = render(
      <ArtifactRecommendations artifacts={raidenRole.artifacts} />,
    );
    const raidenImages = Array.from(raidenContainer.querySelectorAll('img'));
    expect(
      raidenImages.some((img) =>
        img.getAttribute('src')?.includes('EmblemofSeveredFate.png'),
      ),
    ).toBe(true);
  });

  // ── Area 4: Real set icons inside choose-two and choice pool structures ──
  it('4. renders authentic set icons inside choose-two and choice pool structures', () => {
    const lisa = rawBuildsCatalog.characters.find((c) => c.characterId === 'Lisa');
    const aggRole = lisa.roles.find((r) => r.roleId === 'aggravate-dps');
    const chooseTwoGroup = aggRole.artifacts.rankedGroups[3].groups[0];
    expect(chooseTwoGroup.chooseTwo).toBe(true);

    const { container } = render(<ArtifactRecommendations artifacts={aggRole.artifacts} />);
    const chooseTwoSection = container.querySelector('.bg-slate-950\\/70');
    expect(chooseTwoSection).toBeInTheDocument();

    const chooseTwoImages = Array.from(chooseTwoSection.querySelectorAll('img'));
    expect(chooseTwoImages.length).toBeGreaterThanOrEqual(3);
  });

  // ── Area 5: Pseudo-set category attribute icons ──
  it('5. resolves all pseudo-set categories to semantic attribute icons', () => {
    expect(getArtifactSetIcon('+18% ATK set', 'atk-set')).toBe(
      `${CDN_BASE}/attributes/ATKPercentage.png`,
    );
    expect(getArtifactSetIcon('+80 EM set', 'em-set')).toBe(
      `${CDN_BASE}/attributes/ElementalMastery.png`,
    );
    expect(getArtifactSetIcon('+20% ER set', 'er-set')).toBe(
      `${CDN_BASE}/attributes/EnergyRecharge.png`,
    );
    expect(getArtifactSetIcon('+20% HP set', 'hp-set')).toBe(
      `${CDN_BASE}/attributes/HPPercentage.png`,
    );
    expect(getArtifactSetIcon('+15% Healing Bonus set', 'healing-set')).toBe(
      `${CDN_BASE}/attributes/HealingBonus.png`,
    );
    expect(getArtifactSetIcon('+15% Hydro DMG Bonus set', 'hydro-set')).toBe(
      `${CDN_BASE}/attributes/HydroDMGBonus.png`,
    );
    expect(getArtifactSetIcon('+15% Cryo DMG Bonus set', 'cryo-set')).toBe(
      `${CDN_BASE}/attributes/CryoDMGBonus.png`,
    );
    expect(getArtifactSetIcon('+15% Anemo DMG Bonus set', 'anemo-set')).toBe(
      `${CDN_BASE}/attributes/AnemoDMGBonus.png`,
    );
    expect(getArtifactSetIcon('+25% Physical DMG set', 'physical-set')).toBe(
      `${CDN_BASE}/attributes/PhysicalDMGBonus.png`,
    );
    expect(getArtifactSetIcon('+30% DEF set', 'def-set')).toBe(
      `${CDN_BASE}/attributes/DEFPercentage.png`,
    );
  });

  // ── Area 6: Correct Sands, Goblet and Circlet PNG paths ──
  it('6. resolves correct slot icon PNG paths and renders them in ArtifactStatPriorities', () => {
    expect(getArtifactSlotIcon('sands')).toBe(`${CDN_BASE}/attributes/Sands.png`);
    expect(getArtifactSlotIcon('goblet')).toBe(`${CDN_BASE}/attributes/Goblet.png`);
    expect(getArtifactSlotIcon('circlet')).toBe(`${CDN_BASE}/attributes/Circlet.png`);
    expect(getArtifactSlotIcon('flower')).toBe(`${CDN_BASE}/attributes/Flower.png`);
    expect(getArtifactSlotIcon('plume')).toBe(`${CDN_BASE}/attributes/Plume.png`);
    expect(getArtifactSlotIcon('invalid')).toBeNull();

    const sampleArtifacts = {
      mainStats: {
        sands: [{ name: 'ATK%', statKey: 'atk%' }],
        goblet: [{ name: 'Electro DMG', statKey: 'electro-dmg' }],
        circlet: [{ name: 'CRIT Rate', statKey: 'cr' }],
      },
      substats: {
        priorityGroups: [
          { rank: 1, items: [{ name: 'CRIT Rate', statKey: 'cr' }] },
        ],
      },
    };

    const { container } = render(<ArtifactStatPriorities artifacts={sampleArtifacts} />);
    const images = Array.from(container.querySelectorAll('img'));
    const srcs = images.map((img) => img.getAttribute('src'));

    expect(srcs).toContain(`${CDN_BASE}/attributes/Sands.png`);
    expect(srcs).toContain(`${CDN_BASE}/attributes/Goblet.png`);
    expect(srcs).toContain(`${CDN_BASE}/attributes/Circlet.png`);
  });

  // ── Area 7: Flat versus percentage stat icon distinction ──
  it('7. strictly distinguishes flat versus percentage stat icons', () => {
    // ATK vs ATK%
    expect(getAttributeIcon('ATK%')).toBe(`${CDN_BASE}/attributes/ATKPercentage.png`);
    expect(getAttributeIcon('Flat ATK')).toBe(`${CDN_BASE}/attributes/ATK.png`);
    expect(getAttributeIcon('ATK')).toBe(`${CDN_BASE}/attributes/ATK.png`);
    expect(getAttributeIcon(null, 'atk%')).toBe(`${CDN_BASE}/attributes/ATKPercentage.png`);
    expect(getAttributeIcon(null, 'atk')).toBe(`${CDN_BASE}/attributes/ATK.png`);

    // HP vs HP%
    expect(getAttributeIcon('HP%')).toBe(`${CDN_BASE}/attributes/HPPercentage.png`);
    expect(getAttributeIcon('Flat HP')).toBe(`${CDN_BASE}/attributes/HP.png`);
    expect(getAttributeIcon('HP')).toBe(`${CDN_BASE}/attributes/HP.png`);
    expect(getAttributeIcon(null, 'hp%')).toBe(`${CDN_BASE}/attributes/HPPercentage.png`);
    expect(getAttributeIcon(null, 'hp')).toBe(`${CDN_BASE}/attributes/HP.png`);

    // DEF vs DEF%
    expect(getAttributeIcon('DEF%')).toBe(`${CDN_BASE}/attributes/DEFPercentage.png`);
    expect(getAttributeIcon('Flat DEF')).toBe(`${CDN_BASE}/attributes/DEF.png`);
    expect(getAttributeIcon('DEF')).toBe(`${CDN_BASE}/attributes/DEF.png`);
    expect(getAttributeIcon(null, 'def%')).toBe(`${CDN_BASE}/attributes/DEFPercentage.png`);
    expect(getAttributeIcon(null, 'def')).toBe(`${CDN_BASE}/attributes/DEF.png`);
  });

  // ── Area 8: Main stats and substats use stat icons without removing text ──
  it('8. renders attribute icons alongside main stats and substats without dropping text labels', () => {
    const lisa = rawBuildsCatalog.characters.find((c) => c.characterId === 'Lisa');
    const aggRole = lisa.roles.find((r) => r.roleId === 'aggravate-dps');

    const { container } = render(<ArtifactStatPriorities artifacts={aggRole.artifacts} />);

    // Textual labels must be present
    expect(screen.getByText('Sands of Eon')).toBeInTheDocument();
    expect(screen.getByText('Goblet of Eonothem')).toBeInTheDocument();
    expect(screen.getByText('Circlet of Logos')).toBeInTheDocument();
    expect(screen.getAllByText('Elemental Mastery').length).toBe(2); // Sands main stat & Substats rank 2
    expect(screen.getAllByText('ATK%').length).toBe(2); // Sands main stat & Substats rank 2
    expect(screen.getByText('Electro DMG')).toBeInTheDocument(); // Goblet main stat
    expect(screen.getAllByText('CRIT Rate / CRIT DMG').length).toBe(2); // Circlet main stat & Substats rank 1
    expect(screen.getByText('Energy Recharge')).toBeInTheDocument(); // Substats rank 3

    // Attribute images must be present
    const images = Array.from(container.querySelectorAll('img'));
    const srcs = images.map((img) => img.getAttribute('src'));

    expect(srcs).toContain(`${CDN_BASE}/attributes/ElementalMastery.png`);
    expect(srcs).toContain(`${CDN_BASE}/attributes/ElectroDMGBonus.png`);
    expect(srcs).toContain(`${CDN_BASE}/attributes/CRITRate.png`);
    expect(srcs).toContain(`${CDN_BASE}/attributes/CRITDMG.png`);
  });

  // ── Area 9: Safe fallback for unknown, composite, or unavailable names ──
  it('9. provides safe fallback for unknown, composite, or unavailable names', () => {
    // Unknown non-existent set returns null
    expect(getArtifactSetIcon('Unknown NonExistent Set')).toBeNull();

    // Composite stat in single-icon lookup returns null to prevent mis-mapping
    expect(getAttributeIcon('CRIT Rate / CRIT DMG')).toBeNull();
    expect(getAttributeIcon(null, 'cr/cd')).toBeNull();

    // Multi-icon lookup resolves composite stat into array of individual icons
    const compositeIcons = getAttributeIcons('CRIT Rate / CRIT DMG');
    expect(compositeIcons).toEqual([
      `${CDN_BASE}/attributes/CRITRate.png`,
      `${CDN_BASE}/attributes/CRITDMG.png`,
    ]);

    // Triple composite
    const tripleIcons = getAttributeIcons('CRIT Rate / CRIT DMG / HP%');
    expect(tripleIcons).toEqual([
      `${CDN_BASE}/attributes/CRITRate.png`,
      `${CDN_BASE}/attributes/CRITDMG.png`,
      `${CDN_BASE}/attributes/HPPercentage.png`,
    ]);

    // Unknown stat returns empty array in multi-lookup
    expect(getAttributeIcons('Unknown NonExistent Stat')).toEqual([]);

    // Unknown set in ArtifactRecommendations renders fallback emoji without error
    const testMissingSet = {
      rankedGroups: [
        {
          rank: 1,
          groups: [
            {
              items: [{ name: 'Unknown NonExistent Set', pieces: 4 }],
            },
          ],
        },
      ],
    };
    render(<ArtifactRecommendations artifacts={testMissingSet} />);
    expect(screen.getByText('Unknown NonExistent Set')).toBeInTheDocument();
    // 🏺 appears in the section header and as the item fallback
    expect(screen.getAllByText('🏺')).toHaveLength(2);
  });

  // ── Area 10: Responsive wrapping and no horizontal overflow ──
  it('10. uses responsive wrapping classes without rigid width constraints', () => {
    const sampleArtifacts = {
      mainStats: {
        sands: [{ name: 'ATK%', statKey: 'atk%' }, { name: 'Energy Recharge', statKey: 'er' }],
        goblet: [{ name: 'Electro DMG', statKey: 'electro-dmg' }],
        circlet: [{ name: 'CRIT Rate / CRIT DMG', statKey: 'cr/cd' }],
      },
      substats: {
        priorityGroups: [
          {
            rank: 1,
            items: [
              { name: 'CRIT Rate', statKey: 'cr' },
              { name: 'CRIT DMG', statKey: 'cd' },
              { name: 'Energy Recharge', statKey: 'er' },
            ],
          },
        ],
      },
    };

    const { container } = render(<ArtifactStatPriorities artifacts={sampleArtifacts} />);
    // Check flex-wrap on stat items container
    const wrapElements = container.querySelectorAll('.flex-wrap');
    expect(wrapElements.length).toBeGreaterThan(0);
  });

  // ── Area 11: Full source catalog coverage scan ──
  it('11. verifies catalog-wide artifact set and stat coverage across all 129 characters and 184 builds', () => {
    let resolvedSetsCount = 0;
    let missingSetsCount = 0;
    const missingSetNames = new Set();
    const uniqueRealSetNames = new Set();
    const uniquePseudoSets = new Set();
    const uniqueMainStats = new Set();
    const uniqueSubstats = new Set();

    for (const char of rawBuildsCatalog.characters) {
      for (const role of char.roles || []) {
        const arts = role.artifacts || {};

        const checkItem = (it) => {
          if (!it) return;
          if (it.isPseudoSet) {
            uniquePseudoSets.add(it.pseudoStatTag || it.name);
            const url = getArtifactSetIcon(it.name, it.pseudoStatTag);
            expect(url).toBeTruthy();
          } else {
            uniqueRealSetNames.add(it.name);
            const url = getArtifactSetIcon(it.name, it.sourceSetId);
            if (url) {
              resolvedSetsCount++;
            } else {
              missingSetsCount++;
              missingSetNames.add(it.name);
            }
          }
        };

        (arts.rankedGroups || []).forEach((rg) => {
          (rg.groups || []).forEach((g) => {
            (g.items || []).forEach(checkItem);
            (g.choices || []).forEach((ch) => (ch.items || []).forEach(checkItem));
          });
        });

        (arts.conditional || []).forEach((g) => {
          (g.items || []).forEach(checkItem);
          (g.choices || []).forEach((ch) => (ch.items || []).forEach(checkItem));
        });

        // Main stats
        ['sands', 'goblet', 'circlet'].forEach((slot) => {
          (arts.mainStats?.[slot] || []).forEach((st) => {
            uniqueMainStats.add(st.name);
            const icons = getAttributeIcons(st.name, st.statKey);
            expect(icons.length).toBeGreaterThan(0);
          });
        });

        // Substats
        (arts.substats?.priorityGroups || []).forEach((pg) => {
          (pg.items || []).forEach((st) => {
            uniqueSubstats.add(st.name);
            const icons = getAttributeIcons(st.name, st.statKey);
            expect(icons.length).toBeGreaterThan(0);
          });
        });
      }
    }

    // Exactly 0 missing sets across the entire catalog (48/48 real sets resolved)
    expect(uniqueRealSetNames.size).toBe(48);
    expect(Array.from(missingSetNames)).toEqual([]);
    expect(missingSetsCount).toBe(0);
    expect(resolvedSetsCount).toBeGreaterThan(300);

    // Exactly 10 pseudo-set categories resolved
    expect(uniquePseudoSets.size).toBe(10);

    // Exactly 3 artifact slot icons resolved
    ['sands', 'goblet', 'circlet'].forEach((slot) => {
      expect(getArtifactSlotIcon(slot)).toBeTruthy();
    });

    // Exactly 17 main stats and 14 substats mapped
    expect(uniqueMainStats.size).toBe(17);
    expect(uniqueSubstats.size).toBe(14);
  });

  // ── Area 12: Zero mutation guarantee ──
  it('12. guarantees zero mutation to recommendations catalog data', () => {
    const lisa = rawBuildsCatalog.characters.find((c) => c.characterId === 'Lisa');
    const aggRole = lisa.roles.find((r) => r.roleId === 'aggravate-dps');

    // Deep freeze
    const deepFreeze = (obj) => {
      Object.freeze(obj);
      Object.values(obj).forEach((val) => {
        if (val && typeof val === 'object' && !Object.isFrozen(val)) {
          deepFreeze(val);
        }
      });
      return obj;
    };

    const frozenArtifacts = JSON.parse(JSON.stringify(aggRole.artifacts));
    deepFreeze(frozenArtifacts);

    expect(() => {
      render(<ArtifactRecommendations artifacts={frozenArtifacts} />);
      render(<ArtifactStatPriorities artifacts={frozenArtifacts} />);
    }).not.toThrow();
  });

  // ── Area 13: Silken Moon's Serenade rendering for Aino ──
  it('13. renders Silken Moon\'s Serenade authentic CDN icon for Aino Reaction Support', () => {
    const aino = rawBuildsCatalog.characters.find((c) => c.characterId === 'Aino');
    const reactionRole = aino.roles.find((r) => r.roleId === 'reaction-support');

    const { container } = render(<ArtifactRecommendations artifacts={reactionRole.artifacts} />);

    expect(screen.getByText("Silken Moon's Serenade")).toBeInTheDocument();

    const imgs = Array.from(container.querySelectorAll('img'));
    const smsImg = imgs.find((img) =>
      img.getAttribute('src')?.includes('SilkenMoonsSerenade.png'),
    );
    expect(smsImg).toBeDefined();
    expect(smsImg.getAttribute('src')).toBe(
      `${CDN_BASE}/artifact_sets/SilkenMoonsSerenade.png`,
    );
  });
});
