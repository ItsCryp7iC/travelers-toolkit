import { describe, it, expect } from 'vitest';
import { formatCharData, formatWeaponData } from './builderFormatters';
import { buildMatJson } from './materialBuilders';

describe('builderFormatters', () => {
  describe('formatCharData', () => {
    it('formats character correctly and maps materials', () => {
      const data = {
        name: 'Hu Tao',
        rarity: 5,
        weapon_type: 'Polearm',
        element: 'Pyro',
        materials: {
          world_boss_material_id: 'juvenile_jade',
          weekly_boss_material_id: 'bloodjade_branch',
          talent_material_family_id: 'diligence',
          enemy_material_family_id: 'whopperflower',
          local_specialty_id: 'silk_flower',
          gem_family_id: 'agnidus_agate'
        }
      };

      const lookupMap = {
        'juvenile_jade': 'JuvenileJade',
        'bloodjade_branch': 'BloodjadeBranch',
        'diligence': 'Diligence',
        'whopperflower': 'Whopperflower',
        'silk_flower': 'SilkFlower',
        'agnidus_agate': 'AgnidusAgate'
      };

      const result = formatCharData(data, 15, lookupMap);

      expect(result.id).toBe('HuTao');
      expect(result.name).toBe('Hu Tao');
      expect(result.rarity).toBe('★★★★★');
      expect(result.weapon_type).toBe('Polearm');
      expect(result.element).toBe('Pyro');
      expect(result.release_order).toBe(15);

      expect(result.materials.world_boss_material_id).toBe('JuvenileJade');
      expect(result.materials.weekly_boss_material_id).toBe('BloodjadeBranch');
    });
  });

  describe('formatWeaponData', () => {
    it('formats weapon correctly and determines sequence release order', () => {
      const data = {
        name: 'Staff of Homa',
        rarity: 5,
        type: 'Polearm', // block 3
        materials: {
          ascension_material_family_id: 'aerosiderite',
          enhancement_material_family_id: 'abyss_mage',
          enemy_material_family_id: 'slime'
        }
      };

      const lookupMap = {
        'aerosiderite': 'Aerosiderite',
        'abyss_mage': 'AbyssMage',
        'slime': 'Slime'
      };

      const existingWeapons = [
        { name: 'Primordial Jade Winged-Spear', type: 'Polearm', rarity: '★★★★★', release_order: 5.301 },
        { name: 'Skyward Spine', type: 'Polearm', rarity: 5, release_order: 5.302 }
      ];

      const result = formatWeaponData(data, existingWeapons, lookupMap);

      expect(result.id).toBe('StaffOfHoma');
      expect(result.name).toBe('Staff of Homa');
      expect(result.rarity).toBe('★★★★★');
      expect(result.type).toBe('Polearm');
      expect(result.release_order).toBe(5.303); // Next sequence

      expect(result.materials.ascension_material_family_id).toBe('Aerosiderite');
      expect(result.materials.enemy_material_family_id).toBe('Slime');
    });
  });
});
