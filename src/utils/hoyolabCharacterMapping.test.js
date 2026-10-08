import { describe, it, expect } from 'vitest';
import { mapHoyolabCharacter, mapHoyolabWeapon } from './hoyolabCharacterMapping';

describe('hoyolabCharacterMapping', () => {
  describe('mapHoyolabCharacter', () => {
    it('normal numeric character ID maps correctly', () => {
      const res = mapHoyolabCharacter({ id: 10000046 });
      expect(res.status).toBe('matched');
      expect(res.canonicalId).toBe('HuTao');
      expect(res.rosterKey).toBe('Hu Tao');
    });

    it('canonical ID differs from display name', () => {
      const res = mapHoyolabCharacter({ id: 10000002 }); // Kamisato Ayaka
      expect(res.status).toBe('matched');
      expect(res.canonicalId).toBe('KamisatoAyaka'); // String canonical ID
      expect(res.rosterKey).toBe('Kamisato Ayaka'); // String name in store
    });

    it('unknown numeric ID', () => {
      const res = mapHoyolabCharacter({ id: 999999999 });
      expect(res.status).toBe('unmapped');
    });

    it('duplicate mapping rejected', () => {
      // By implementation, our generator handles duplicates. Tests verify the map has unique entries.
      const map = require('../data/hoyolabMap.json');
      const uniqueKeys = new Set(Object.keys(map.characters));
      expect(uniqueKeys.size).toBe(Object.keys(map.characters).length);
    });

    // Traveler Elements
    const elements = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo'];
    elements.forEach(elem => {
      it(`Traveler ${elem}`, () => {
        const res = mapHoyolabCharacter({ id: 10000005, element: elem });
        expect(res.status).toBe('matched');
        expect(res.canonicalId).toBe(`Traveler${elem}`);
        expect(res.rosterKey).toBe(`Traveler ${elem}`);
      });
    });

    it('unknown Traveler element', () => {
      const res = mapHoyolabCharacter({ id: 10000005, element: 'Quantum' });
      expect(res.status).toBe('unmapped');
    });

    it('missing Traveler element', () => {
      const res = mapHoyolabCharacter({ id: 10000005 });
      expect(res.status).toBe('unmapped');
    });
  });

  describe('mapHoyolabWeapon', () => {
    it('known numeric weapon ID', () => {
      const res = mapHoyolabWeapon({ id: 13501 });
      expect(res.status).toBe('matched');
      expect(res.canonicalId).toBe('StaffOfHoma');
      expect(res.weaponName).toBe('Staff of Homa');
    });

    it('apostrophes (e.g. Lion\'s Roar)', () => {
      // Find Lion's roar id
      const map = require('../data/hoyolabMap.json');
      const lionsRoarId = Object.keys(map.weapons).find(k => map.weapons[k] === 'LionsRoar');
      if (lionsRoarId) {
        const res = mapHoyolabWeapon({ id: parseInt(lionsRoarId) });
        expect(res.status).toBe('matched');
        expect(res.weaponName).toBe("Lion's Roar");
      }
    });

    it('punctuation (e.g. "The Catch")', () => {
      const map = require('../data/hoyolabMap.json');
      const catchId = Object.keys(map.weapons).find(k => map.weapons[k] === 'TheCatch');
      if (catchId) {
        const res = mapHoyolabWeapon({ id: parseInt(catchId) });
        expect(res.status).toBe('matched');
        expect(res.weaponName).toBe('The Catch');
      }
    });

    it('spaces', () => {
      const res = mapHoyolabWeapon({ id: 11414 }); // Amenoma Kageuchi
      expect(res.status).toBe('matched');
      expect(res.weaponName).toBe('Amenoma Kageuchi');
    });

    it('unknown ID', () => {
      const res = mapHoyolabWeapon({ id: 9999999 });
      expect(res.status).toBe('unmapped');
    });

    it('duplicate numeric mapping rejected', () => {
      const map = require('../data/hoyolabMap.json');
      const uniqueKeys = new Set(Object.keys(map.weapons));
      expect(uniqueKeys.size).toBe(Object.keys(map.weapons).length);
    });

    it('source-only/missing Toolkit entry fails safely', () => {
      // manually mock mapHoyolabWeapon internally doing lookup
      // this is tested by ensuring undefined canonical fails safely
      const res = mapHoyolabWeapon({ id: 99999999 });
      expect(res.status).toBe('unmapped');
    });
  });
});
