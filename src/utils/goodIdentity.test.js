import { describe, it, expect } from 'vitest';
import { resolveGoodCharacterKey, resolveGoodWeaponKey, resolveGoodMaterialKey } from './goodIdentity';

describe('GOOD Identity Resolvers', () => {
  it('resolves materials correctly', () => {
    expect(resolveGoodMaterialKey('HerosWit')).toBe('HerosWit');
    expect(resolveGoodMaterialKey('unknown material')).toBeNull();
  });

  it('resolves characters correctly', () => {
    expect(resolveGoodCharacterKey('RaidenShogun')).toBe('Raiden Shogun');
    expect(resolveGoodCharacterKey('unknown character')).toBeNull();
  });

  it('resolves weapons correctly', () => {
    expect(resolveGoodWeaponKey('WolfsGravestone')).toBe("Wolf's Gravestone");
    expect(resolveGoodWeaponKey('unknown weapon')).toBeNull();
  });
});
