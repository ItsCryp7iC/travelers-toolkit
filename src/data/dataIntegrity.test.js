import { describe, it, expect } from 'vitest';
import baseCharacters from './characters.json';
import travelers from './traveler.json';
import weapons from './weapons.json';
import normalBoss from './normal_boss.json';
import weeklyBoss from './weekly_boss.json';
import localSpecialty from './local_specialty.json';
import characterGems from './character_gems.json';
import talentMaterials from './talent_materials.json';
import commonEnemy from './common_enemy.json';
import eliteEnemy from './elite_enemy.json';
import weaponAscension from './weapon_ascension.json';

const allCharacters = [...travelers, ...baseCharacters];

const normalizeId = (val) => String(val).toLowerCase().replace(/[^a-z0-9]/g, '');

describe('Canonical Data Integrity', () => {
  describe('Characters Dataset', () => {
    it('has unique character names and IDs across all characters and travelers', () => {
      const seenNames = new Set();
      const seenIds = new Set();
      const normalizedNames = new Map();

      allCharacters.forEach((c) => {
        expect(seenNames.has(c.name), `Duplicate character name: ${c.name}`).toBe(false);
        seenNames.add(c.name);

        const idStr = String(c.id);
        expect(seenIds.has(idStr), `Duplicate character ID: ${idStr}`).toBe(false);
        seenIds.add(idStr);

        const norm = normalizeId(c.name);
        expect(
          normalizedNames.has(norm),
          `Normalized collision for '${c.name}' with '${normalizedNames.get(norm)}'`
        ).toBe(false);
        normalizedNames.set(norm, c.name);
      });

      expect(allCharacters.length).toBe(127);
    });

    it('all character material references resolve to canonical datasets', () => {
      const bossIds = new Set([...normalBoss, ...weeklyBoss].map((b) => b.id));
      const localIds = new Set(localSpecialty.map((l) => l.id));
      const gemIds = new Set(characterGems.map((g) => g.id));
      const talentIds = new Set(talentMaterials.map((t) => t.id));
      const enemyIds = new Set([...commonEnemy, ...eliteEnemy].map((e) => e.id));

      allCharacters.forEach((c) => {
        const m = c.materials;
        if (!m) return;

        if (m.world_boss_material_id) {
          expect(bossIds.has(m.world_boss_material_id), `${c.name} invalid world boss: ${m.world_boss_material_id}`).toBe(true);
        }
        if (m.weekly_boss_material_id) {
          expect(bossIds.has(m.weekly_boss_material_id), `${c.name} invalid weekly boss: ${m.weekly_boss_material_id}`).toBe(true);
        }
        if (m.local_specialty_id) {
          expect(localIds.has(m.local_specialty_id), `${c.name} invalid local specialty: ${m.local_specialty_id}`).toBe(true);
        }
        if (m.gem_family_id) {
          expect(gemIds.has(m.gem_family_id), `${c.name} invalid gem family: ${m.gem_family_id}`).toBe(true);
        }
        if (m.talent_material_family_id) {
          expect(talentIds.has(m.talent_material_family_id), `${c.name} invalid talent family: ${m.talent_material_family_id}`).toBe(true);
        }
        if (Array.isArray(m.talent_material_family_ids)) {
          m.talent_material_family_ids.forEach((tId) => {
            expect(talentIds.has(tId), `${c.name} invalid rotating talent: ${tId}`).toBe(true);
          });
        }
        if (m.enemy_material_family_id) {
          expect(enemyIds.has(m.enemy_material_family_id), `${c.name} invalid enemy family: ${m.enemy_material_family_id}`).toBe(true);
        }
        if (m.ascension_enemy_material_family_id) {
          expect(enemyIds.has(m.ascension_enemy_material_family_id), `${c.name} invalid asc enemy: ${m.ascension_enemy_material_family_id}`).toBe(true);
        }
      });
    });

    it('correctly identifies all 7 Traveler variants and rotating talent books', () => {
      const expectedElements = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo'];
      expect(travelers.length).toBe(7);

      expectedElements.forEach((element) => {
        const variant = travelers.find((t) => t.name === `Traveler ${element}`);
        expect(variant, `Missing Traveler ${element}`).toBeDefined();
        expect(variant.element).toBe(element);
        expect(variant.materials?.gem_family_id).toBe('BrilliantDiamond');
        expect(Array.isArray(variant.materials?.talent_material_family_ids)).toBe(true);
        expect(variant.materials?.talent_material_family_ids.length).toBe(3);
      });
    });
  });

  describe('Weapons Dataset', () => {
    it('has unique weapon names, IDs, and normalized forms with zero collisions', () => {
      const seenNames = new Set();
      const seenIds = new Set();
      const normalizedNames = new Map();

      weapons.forEach((w) => {
        expect(seenNames.has(w.name), `Duplicate weapon name: ${w.name}`).toBe(false);
        seenNames.add(w.name);

        const idStr = String(w.id);
        expect(seenIds.has(idStr), `Duplicate weapon ID: ${idStr}`).toBe(false);
        seenIds.add(idStr);

        const norm = normalizeId(w.name);
        expect(
          normalizedNames.has(norm),
          `Normalized collision for weapon '${w.name}' with '${normalizedNames.get(norm)}'`
        ).toBe(false);
        normalizedNames.set(norm, w.name);
      });

      expect(weapons.length).toBe(251);
    });

    it('all weapon material references resolve 100% to canonical datasets', () => {
      const ascIds = new Set(weaponAscension.map((a) => a.id));
      const enemyIds = new Set([...commonEnemy, ...eliteEnemy].map((e) => e.id));

      weapons.forEach((w) => {
        expect(w.materials, `${w.name} missing materials definition`).toBeDefined();
        const { ascension_material_family_id, enhancement_material_family_id, enemy_material_family_id } = w.materials;

        expect(ascIds.has(ascension_material_family_id), `${w.name} invalid asc family: ${ascension_material_family_id}`).toBe(true);
        expect(enemyIds.has(enhancement_material_family_id), `${w.name} invalid elite family: ${enhancement_material_family_id}`).toBe(true);
        expect(enemyIds.has(enemy_material_family_id), `${w.name} invalid common enemy family: ${enemy_material_family_id}`).toBe(true);
      });
    });
  });
});
