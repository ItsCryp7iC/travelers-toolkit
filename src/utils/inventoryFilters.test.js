import { expect, test, describe } from 'vitest';
import { getInventoryTabId, filterMaterialsByTab } from './inventoryFilters';

describe('inventoryFilters', () => {
  describe('getInventoryTabId', () => {
    test('legacy IDs map safely', () => {
      expect(getInventoryTabId('boss_drops')).toBe('normal_boss');
      expect(getInventoryTabId('enemy_drops')).toBe('common_mats');
      expect(getInventoryTabId('forging_mats')).toBe('billet');
    });

    test('valid IDs pass through', () => {
      expect(getInventoryTabId('normal_boss')).toBe('normal_boss');
      expect(getInventoryTabId('talent_mats')).toBe('talent_mats');
      expect(getInventoryTabId('local_spec')).toBe('local_spec');
    });

    test('invalid or missing IDs fallback to currency_exp', () => {
      expect(getInventoryTabId('')).toBe('currency_exp');
      expect(getInventoryTabId(null)).toBe('currency_exp');
      expect(getInventoryTabId('invalid_id')).toBe('currency_exp');
    });
  });

  describe('filterMaterialsByTab', () => {
    const mockMaterials = [
      { matKey: '1', category: 'Currency', subCategory: '' },
      { matKey: '2', category: 'Experience', subCategory: '' },
      { matKey: '3', category: 'Boss Drops', subCategory: 'Normal Boss' },
      { matKey: '4', category: 'Boss Drops', subCategory: 'Weekly Boss' },
      { matKey: '5', category: 'Talent Materials', subCategory: '' },
      { matKey: '6', category: 'Enemy Drops', subCategory: 'Common Enhancement Material' },
      { matKey: '7', category: 'Enemy Drops', subCategory: 'Elite Enhancement Material' },
      { matKey: '8', category: 'Weapon Ascension Material', subCategory: '' },
      { matKey: '9', category: 'Local Specialty', subCategory: '' },
      { matKey: '10', category: 'Character Ascension Gem', subCategory: '' },
      { matKey: '11', category: 'Forging Material', subCategory: 'Billet' },
      { matKey: '12', category: 'Forging Material', subCategory: 'Forging Ore' },
    ];

    test('currency_exp includes Currency + Experience', () => {
      const filtered = filterMaterialsByTab(mockMaterials, 'currency_exp');
      expect(filtered.length).toBe(2);
      expect(filtered.map(m => m.matKey)).toEqual(['1', '2']);
    });

    test('normal_boss selects only Normal Boss', () => {
      const filtered = filterMaterialsByTab(mockMaterials, 'normal_boss');
      expect(filtered.length).toBe(1);
      expect(filtered[0].matKey).toBe('3');
    });

    test('weekly_boss selects only Weekly Boss', () => {
      const filtered = filterMaterialsByTab(mockMaterials, 'weekly_boss');
      expect(filtered.length).toBe(1);
      expect(filtered[0].matKey).toBe('4');
    });

    test('common_mats selects only Common Enhancement Material', () => {
      const filtered = filterMaterialsByTab(mockMaterials, 'common_mats');
      expect(filtered.length).toBe(1);
      expect(filtered[0].matKey).toBe('6');
    });

    test('elite_mats selects only Elite Enhancement Material', () => {
      const filtered = filterMaterialsByTab(mockMaterials, 'elite_mats');
      expect(filtered.length).toBe(1);
      expect(filtered[0].matKey).toBe('7');
    });

    test('billet selects only Billet', () => {
      const filtered = filterMaterialsByTab(mockMaterials, 'billet');
      expect(filtered.length).toBe(1);
      expect(filtered[0].matKey).toBe('11');
    });

    test('forging_ore selects only Forging Ore', () => {
      const filtered = filterMaterialsByTab(mockMaterials, 'forging_ore');
      expect(filtered.length).toBe(1);
      expect(filtered[0].matKey).toBe('12');
    });
  });
});
