import { expect, test, describe } from 'vitest';
import { buildCurrencyExpItems } from './currencyUtils';

describe('currencyUtils', () => {
  test('buildCurrencyExpItems returns zero-requirement fallbacks properly', () => {
    const toFarm = {}; // No requirements
    const inventory = {
      CrownOfInsight: 30,
      MasterlessStellaFortuna: 2,
      HerosWit: 50,
      MysticEnhancementOre: 100,
    };

    const result = buildCurrencyExpItems(toFarm, inventory);

    const crown = result.find(r => r.config.key === 'crown');
    expect(crown.item.owned).toBe(30);
    expect(crown.item.toFarm).toBe(0);

    const stella = result.find(r => r.config.key === 'stellaFortuna');
    expect(stella.item.owned).toBe(2);
    expect(stella.item.toFarm).toBe(0);

    const wits = result.find(r => r.config.key === 'heroWits');
    expect(wits.item.owned).toBe(50);

    const ore = result.find(r => r.config.key === 'mysticOre');
    expect(ore.item.owned).toBe(100);
  });
});
