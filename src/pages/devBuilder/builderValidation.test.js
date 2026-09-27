import { describe, it, expect } from 'vitest';
import { getMissingMaterials } from './builderValidation';

describe('builderValidation', () => {
  describe('getMissingMaterials', () => {
    it('Material mode returns [] because dependency validation does not apply', () => {
      const result = getMissingMaterials('material', null, null, {});
      expect(result).toEqual([]);
    });

    it('Blank values are ignored', () => {
      const charData = { materials: { m1: '', m2: '   ', m3: null } };
      const result = getMissingMaterials('character', charData, null, {});
      expect(result).toEqual([]);
    });

    it('Known ID is accepted', () => {
      const charData = { materials: { m1: 'JuvenileJade' } };
      const lookupMap = { 'JuvenileJade': 'JuvenileJade' };
      const result = getMissingMaterials('character', charData, null, lookupMap);
      expect(result).toEqual([]);
    });

    it('Known name is accepted', () => {
      const charData = { materials: { m1: 'Juvenile Jade' } };
      const lookupMap = { 'Juvenile Jade': 'JuvenileJade' }; // Resolves name -> id
      const result = getMissingMaterials('character', charData, null, lookupMap);
      expect(result).toEqual([]);
    });

    it('Unknown material input is returned as missing', () => {
      const charData = { materials: { m1: 'UnknownBossDrop' } };
      const lookupMap = { 'JuvenileJade': 'JuvenileJade' };
      const result = getMissingMaterials('character', charData, null, lookupMap);
      expect(result).toEqual(['UnknownBossDrop']);
    });
  });
});
