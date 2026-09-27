import { describe, it, expect } from 'vitest';
import { buildMatJson, floatAdd } from './materialBuilders';

describe('materialBuilders', () => {
  describe('buildMatJson', () => {
    it('normal_boss: exact output shape and values', () => {
      const data = { name: 'Basalt Pillar', bossName: 'Geo Hypostasis', region: 'Liyue' };
      const res = buildMatJson('normal_boss', data, 0);
      expect(res.id).toBe('BasaltPillar');
      expect(res.name).toBe('Basalt Pillar');
      expect(res.type).toBe('normal_boss');
      expect(res.boss_name).toBe('Geo Hypostasis');
      expect(res.region).toBe('Liyue');
      expect(res.sortOrder).toBeGreaterThan(2.0);
    });

    it('local_spec: exact output shape and values', () => {
      const data = { name: 'Qingxin', region: 'Liyue' };
      const res = buildMatJson('local_spec', data, 1);
      expect(res.id).toBe('Qingxin');
      expect(res.name).toBe('Qingxin');
      expect(res.region).toBe('Liyue');
      expect(res.type).toBeUndefined(); // It doesn't have type
      expect(res.sortOrder).toBeGreaterThan(8.0);
    });

    it('weekly_boss: array/object behavior exactly', () => {
      const data = { bossName: 'Childe', region: 'Liyue', mat1: 'Tusk of Monoceros Caeli', mat2: 'Shard of a Foul Legacy', mat3: 'Shadow of the Warrior' };
      const res = buildMatJson('weekly_boss', data, 0);
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(3);

      expect(res[0].id).toBe('TuskOfMonocerosCaeli');
      expect(res[0].name).toBe('Tusk of Monoceros Caeli');
      expect(res[0].type).toBe('weekly_boss');
      expect(res[0].boss_name).toBe('Childe');
      expect(res[0].region).toBe('Liyue');

      expect(res[1].id).toBe('ShardOfAFoulLegacy');
      expect(res[2].id).toBe('ShadowOfTheWarrior');

      // Sort order progression
      expect(res[1].sortOrder).toBe(floatAdd(res[0].sortOrder, 0.001));
      expect(res[2].sortOrder).toBe(floatAdd(res[0].sortOrder, 0.002));
    });

    it('talent: all three talent families are generated correctly', () => {
      const data = { series1: 'Freedom', series2: 'Resistance', series3: 'Ballad', domain: 'Forsaken Rift', region: 'Mondstadt' };
      const res = buildMatJson('talent', data, 0);

      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(3);

      expect(res[0].id).toBe('Freedom');
      expect(res[0].name).toBe('Freedom');
      expect(res[0].domain).toBe('Forsaken Rift');
      expect(res[0].region).toBe('Mondstadt');
      expect(res[0].days).toEqual([1, 4]); // Mon/Thu
      expect(res[0].tiers['4_star'].id).toBe('PhilosophiesOfFreedom');
      expect(res[0].tiers['4_star'].name).toBe('Philosophies of Freedom');
      expect(res[0].tiers['3_star'].name).toBe('Guide to Freedom');
      expect(res[0].tiers['2_star'].name).toBe('Teachings of Freedom');

      expect(res[1].id).toBe('Resistance');
      expect(res[1].days).toEqual([2, 5]); // Tue/Fri
      expect(res[2].id).toBe('Ballad');
      expect(res[2].days).toEqual([3, 6]); // Wed/Sat
    });

    it('weapon_asc: all three groups and four rarities', () => {
      const data = {
        series1Name: 'Decarabian', s1_5: 'Dec5', s1_4: 'Dec4', s1_3: 'Dec3', s1_2: 'Dec2',
        series2Name: 'Boreal Wolf', s2_5: 'Bor5', s2_4: 'Bor4', s2_3: 'Bor3', s2_2: 'Bor2',
        series3Name: 'Dandelion Gladiator', s3_5: 'Dan5', s3_4: 'Dan4', s3_3: 'Dan3', s3_2: 'Dan2',
        domain: 'Cecilia Garden', region: 'Mondstadt'
      };
      const res = buildMatJson('weapon_asc', data, 0);

      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(3);

      expect(res[0].id).toBe('Decarabian');
      expect(res[0].days).toEqual([1, 4]);
      expect(res[0].tiers['5_star'].id).toBe('Dec5');
      expect(res[0].tiers['4_star'].id).toBe('Dec4');
      expect(res[0].tiers['3_star'].id).toBe('Dec3');
      expect(res[0].tiers['2_star'].id).toBe('Dec2');

      expect(res[1].id).toBe('BorealWolf');
      expect(res[1].days).toEqual([2, 5]);
      expect(res[2].id).toBe('DandelionGladiator');
      expect(res[2].days).toEqual([3, 6]);
    });

    it('common_drop: tier structure and exact order increments', () => {
      const data = { groupName: 'Slime', star3: 'Slime Concentrate', star2: 'Slime Secretions', star1: 'Slime Condensate' };
      const res = buildMatJson('common_drop', data, 0);

      expect(res.id).toBe('Slime');
      expect(res.name).toBe('Slime');
      expect(res.type).toBe('common_enemy');
      expect(res.tiers['3_star'].id).toBe('SlimeConcentrate');
      expect(res.tiers['2_star'].id).toBe('SlimeSecretions');
      expect(res.tiers['1_star'].id).toBe('SlimeCondensate');

      // Sort order increments
      const startOrder = res.tiers['3_star'].sortOrder;
      expect(res.tiers['2_star'].sortOrder).toBe(floatAdd(startOrder, 0.001)); // It is start + 0.002 but let's check exact logic
      // In source:
      // 3_star: floatAdd(startOrder, 0.001)
      // 2_star: floatAdd(startOrder, 0.002)
      // 1_star: floatAdd(startOrder, 0.003)
      const baseOrder = floatAdd(startOrder, -0.001); // back calculate
      expect(res.tiers['2_star'].sortOrder).toBe(floatAdd(baseOrder, 0.002));
      expect(res.tiers['1_star'].sortOrder).toBe(floatAdd(baseOrder, 0.003));
    });

    it('elite_drop: tier structure and exact order increments', () => {
      const data = { groupName: 'Mitachurl', star4: 'Black Crystal Horn', star3: 'Black Bronze Horn', star2: 'Heavy Horn' };
      const res = buildMatJson('elite_drop', data, 0);

      expect(res.id).toBe('Mitachurl');
      expect(res.type).toBe('elite_enemy');
      expect(res.tiers['4_star'].id).toBe('BlackCrystalHorn');
      expect(res.tiers['3_star'].id).toBe('BlackBronzeHorn');
      expect(res.tiers['2_star'].id).toBe('HeavyHorn');

      // In source:
      // 4_star: 0.001, 3_star: 0.002, 2_star: 0.003
      const baseOrder = floatAdd(res.tiers['4_star'].sortOrder, -0.001);
      expect(res.tiers['3_star'].sortOrder).toBe(floatAdd(baseOrder, 0.002));
      expect(res.tiers['2_star'].sortOrder).toBe(floatAdd(baseOrder, 0.003));
    });

    it('sort-order regression: queueLength affects order exactly', () => {
      const data = { name: 'Item', region: 'Test' };
      const res0 = buildMatJson('local_spec', data, 0);
      const res1 = buildMatJson('local_spec', data, 1);

      expect(res1.sortOrder).toBe(floatAdd(res0.sortOrder, 0.001));
    });
  });
});
