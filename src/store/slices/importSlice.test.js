import { describe, it, expect, beforeEach } from 'vitest';
import useStore from '../useStore';

describe('importGoodData Selective Patch Semantics (C5)', () => {
  beforeEach(() => {
    useStore.getState().resetStore();
  });

  // 1. empty weapons array preserves trackedWeapons
  it('empty weapons array preserves trackedWeapons', () => {
    useStore.getState().addTrackedWeapon('Amenoma Kageuchi', null);
    useStore.getState().addTrackedWeapon('Mistsplitter Reforged', null);
    useStore.getState().addTrackedWeapon('Favonius Sword', null);

    const initialWeapons = useStore.getState().trackedWeapons;
    expect(initialWeapons).toHaveLength(3);

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [],
      materials: {},
    });

    const finalWeapons = useStore.getState().trackedWeapons;
    expect(finalWeapons).toHaveLength(3);
    expect(finalWeapons.map(w => w.weaponName)).toEqual([
      'Amenoma Kageuchi',
      'Mistsplitter Reforged',
      'Favonius Sword',
    ]);
    expect(finalWeapons.map(w => w.id)).toEqual(initialWeapons.map(w => w.id));
  });

  // 2. empty characters array preserves roster
  it('empty characters array preserves roster', () => {
    useStore.getState().addCharacter('Kamisato Ayaka');
    useStore.getState().addCharacter('Kaeya');
    useStore.getState().addCharacter('Jean');

    const initialRoster = useStore.getState().roster;
    expect(Object.keys(initialRoster)).toHaveLength(3);

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [],
      materials: {},
    });

    const finalRoster = useStore.getState().roster;
    expect(Object.keys(finalRoster)).toHaveLength(3);
    expect(finalRoster['Kamisato Ayaka']).toBeDefined();
    expect(finalRoster['Kaeya']).toBeDefined();
    expect(finalRoster['Jean']).toBeDefined();
  });

  // 3. empty materials object preserves inventory
  it('empty materials object preserves inventory', () => {
    useStore.getState().setInventory('Mora', 100);
    useStore.getState().setInventory('Crown', 3);

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [],
      materials: {},
    });

    const finalInventory = useStore.getState().inventory;
    expect(finalInventory['Mora']).toBe(100);
    expect(finalInventory['Crown']).toBe(3);
  });

  // 4. materials-only import preserves roster and weapons
  it('materials-only import preserves roster and weapons', () => {
    useStore.getState().addCharacter('Kaeya');
    const wId = useStore.getState().addTrackedWeapon('Favonius Sword', 'Kaeya');
    useStore.getState().setInventory('Mora', 50);

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [],
      materials: { 'Mora': 500 },
    });

    const afterState = useStore.getState();
    expect(afterState.roster['Kaeya'].equippedWeaponId).toBe(wId);
    expect(afterState.trackedWeapons).toHaveLength(1);
    expect(afterState.trackedWeapons[0].id).toBe(wId);
    expect(afterState.trackedWeapons[0].assignedTo).toBe('Kaeya');
    expect(afterState.inventory['Mora']).toBe(500);
  });

  // 5. characters-only import preserves weapons and inventory except selected character effects
  it('characters-only import preserves weapons and inventory except selected character effects', () => {
    useStore.getState().addCharacter('Jean');
    const wId = useStore.getState().addTrackedWeapon('Aquila Favonia', 'Jean');
    useStore.getState().setInventory('Mora', 100);

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [
        { name: 'Jean', level: 90, ascension: 6, talents: { normal: 8, skill: 8, burst: 8 } },
      ],
      weapons: [],
      materials: {},
    });

    const afterState = useStore.getState();
    expect(afterState.trackedWeapons).toHaveLength(1);
    expect(afterState.trackedWeapons[0].id).toBe(wId);
    expect(afterState.trackedWeapons[0].assignedTo).toBe('Jean');
    expect(afterState.roster['Jean'].level).toBe(90);
    expect(afterState.roster['Jean'].equippedWeaponId).toBe(wId);
    expect(afterState.inventory['Mora']).toBe(100);
  });

  // 6. weapons-only import preserves unrelated roster/inventory
  it('weapons-only import preserves unrelated roster/inventory', () => {
    useStore.getState().addCharacter('Amber');
    useStore.getState().setInventory('Mora', 250);

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [
        { weaponName: 'Favonius Warbow', level: 90, ascension: 6, refinement: 1, location: null },
      ],
      materials: {},
    });

    const afterState = useStore.getState();
    expect(afterState.roster['Amber']).toBeDefined();
    expect(afterState.roster['Amber'].level).toBe(1);
    expect(afterState.inventory['Mora']).toBe(250);
    expect(afterState.trackedWeapons).toHaveLength(1);
    expect(afterState.trackedWeapons[0].weaponName).toBe('Favonius Warbow');
  });

  // 7. partial weapon import updates one and preserves others
  it('partial weapon import updates one and preserves others', () => {
    const amenomaId = useStore.getState().addTrackedWeapon('Amenoma Kageuchi', null, { currentLevel: 80, currentAscension: 5 });
    const mistId = useStore.getState().addTrackedWeapon('Mistsplitter Reforged', null, { currentLevel: 90, currentAscension: 6 });
    const favId = useStore.getState().addTrackedWeapon('Favonius Sword', null, { currentLevel: 70, currentAscension: 4 });

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [
        { weaponName: 'Amenoma Kageuchi', level: 90, ascension: 6, refinement: 1, location: null },
      ],
      materials: {},
    });

    const afterState = useStore.getState();
    expect(afterState.trackedWeapons).toHaveLength(3);

    const amenoma = afterState.trackedWeapons.find(w => w.id === amenomaId);
    const mist = afterState.trackedWeapons.find(w => w.id === mistId);
    const fav = afterState.trackedWeapons.find(w => w.id === favId);

    expect(amenoma.level).toBe(90);
    expect(amenoma.ascension).toBe(6);
    expect(mist.level).toBe(90);
    expect(fav.level).toBe(70);
  });

  // 8. new selected weapon adds without deleting existing
  it('new selected weapon adds without deleting existing', () => {
    const existingId = useStore.getState().addTrackedWeapon('Amenoma Kageuchi', null);

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [
        { weaponName: "Wolf's Gravestone", level: 90, ascension: 6, refinement: 1, location: null },
      ],
      materials: {},
    });

    const afterState = useStore.getState();
    expect(afterState.trackedWeapons).toHaveLength(2);
    expect(afterState.trackedWeapons.some(w => w.id === existingId)).toBe(true);
    expect(afterState.trackedWeapons.some(w => w.weaponName === "Wolf's Gravestone")).toBe(true);
  });

  // 9. duplicate weapon copies not collapsed
  it('duplicate weapon copies not collapsed', () => {
    useStore.getState().addCharacter('Jean');
    useStore.getState().addCharacter('Bennett');

    const jeanFavId = useStore.getState().addTrackedWeapon('Favonius Sword', 'Jean', { currentLevel: 80, currentAscension: 5 });
    const bennettFavId = useStore.getState().addTrackedWeapon('Favonius Sword', 'Bennett', { currentLevel: 70, currentAscension: 4 });

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [
        { weaponName: 'Favonius Sword', level: 90, ascension: 6, refinement: 3, location: 'Jean' },
      ],
      materials: {},
    });

    const afterState = useStore.getState();
    expect(afterState.trackedWeapons).toHaveLength(2);

    const jeanWeapon = afterState.trackedWeapons.find(w => w.id === jeanFavId);
    const bennettWeapon = afterState.trackedWeapons.find(w => w.id === bennettFavId);

    expect(jeanWeapon.level).toBe(90);
    expect(jeanWeapon.assignedTo).toBe('Jean');

    expect(bennettWeapon.level).toBe(70);
    expect(bennettWeapon.assignedTo).toBe('Bennett');
  });

  // 10. unselected weapon assignment preserved
  it('unselected weapon assignment preserved', () => {
    useStore.getState().addCharacter('Bennett');
    useStore.getState().addCharacter('Kamisato Ayaka');

    const bennettFavId = useStore.getState().addTrackedWeapon('Favonius Sword', 'Bennett');

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [
        { weaponName: 'Mistsplitter Reforged', level: 90, ascension: 6, refinement: 1, location: 'Kamisato Ayaka' },
      ],
      materials: {},
    });

    const afterState = useStore.getState();
    expect(afterState.roster['Bennett'].equippedWeaponId).toBe(bennettFavId);
    const bennettFav = afterState.trackedWeapons.find(w => w.id === bennettFavId);
    expect(bennettFav.assignedTo).toBe('Bennett');
  });

  // 11. imported selected weapon UUID preserved when matched
  it('imported selected weapon UUID preserved when matched', () => {
    useStore.getState().addCharacter('Kamisato Ayaka');
    const existingId = useStore.getState().addTrackedWeapon('Amenoma Kageuchi', 'Kamisato Ayaka', { currentLevel: 80 });

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [
        { weaponName: 'Amenoma Kageuchi', level: 90, ascension: 6, refinement: 2, location: 'Kamisato Ayaka' },
      ],
      materials: {},
    });

    const afterState = useStore.getState();
    const updated = afterState.trackedWeapons.find(w => w.weaponName === 'Amenoma Kageuchi');
    expect(updated.id).toBe(existingId);
    expect(updated.level).toBe(90);
    expect(updated.currentRefinement).toBe(2);
    expect(afterState.roster['Kamisato Ayaka'].equippedWeaponId).toBe(existingId);
  });

  // 12. partial material import preserves omitted quantities
  it('partial material import preserves omitted quantities', () => {
    useStore.getState().setInventory('Mora', 10);
    useStore.getState().setInventory('Crown', 3);
    useStore.getState().setInventory('FragileResin', 5);

    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [],
      materials: { 'Mora': 100 },
    });

    const afterState = useStore.getState();
    expect(afterState.inventory['Mora']).toBe(100);
    expect(afterState.inventory['Crown']).toBe(3);
    expect(afterState.inventory['FragileResin']).toBe(5);
  });

  // 13. full mixed selective import
  it('full mixed selective import', () => {
    useStore.getState().addCharacter('Kamisato Ayaka');
    useStore.getState().addCharacter('Kaeya');
    const ayakaWId = useStore.getState().addTrackedWeapon('Amenoma Kageuchi', 'Kamisato Ayaka', { currentLevel: 80, currentRefinement: 1 });
    const kaeyaWId = useStore.getState().addTrackedWeapon('Favonius Sword', 'Kaeya', { currentLevel: 70, currentRefinement: 1 });
    useStore.getState().setInventory('Mora', 1000);
    useStore.getState().setInventory('Crown', 2);

    // Selected payload: only Kaeya character, only Amenoma weapon, only Mora
    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [
        { name: 'Kaeya', level: 80, ascension: 5, talents: { normal: 6, skill: 6, burst: 6 } },
      ],
      weapons: [
        { weaponName: 'Amenoma Kageuchi', level: 90, ascension: 6, refinement: 3, location: 'Kamisato Ayaka' },
      ],
      materials: {
        'Mora': 5000,
      },
    });

    const afterState = useStore.getState();

    // Ayaka unselected => untouched
    expect(afterState.roster['Kamisato Ayaka'].level).toBe(1);
    expect(afterState.roster['Kamisato Ayaka'].equippedWeaponId).toBe(ayakaWId);

    // Kaeya selected => updated
    expect(afterState.roster['Kaeya'].level).toBe(80);
    expect(afterState.roster['Kaeya'].equippedWeaponId).toBe(kaeyaWId);

    // Amenoma selected => updated, preserved UUID and Ayaka link
    const amenoma = afterState.trackedWeapons.find(w => w.id === ayakaWId);
    expect(amenoma.level).toBe(90);
    expect(amenoma.currentRefinement).toBe(3);
    expect(amenoma.assignedTo).toBe('Kamisato Ayaka');

    // Favonius unselected => untouched
    const favonius = afterState.trackedWeapons.find(w => w.id === kaeyaWId);
    expect(favonius.level).toBe(70);
    expect(favonius.assignedTo).toBe('Kaeya');

    // Inventory
    expect(afterState.inventory['Mora']).toBe(5000);
    expect(afterState.inventory['Crown']).toBe(2);
  });

  // 14. Traveler regression
  it('Traveler regression preserves assignment and equippedWeaponId invariant', () => {
    useStore.getState().addCharacter('Traveler Geo');
    const dullBladeId = useStore.getState().addTrackedWeapon('Dull Blade', 'Traveler Geo', { currentLevel: 20 });

    // When weapons and characters are omitted
    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [],
      materials: { 'Mora': 200 },
    });

    let state = useStore.getState();
    expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
    const weapon = state.trackedWeapons.find(w => w.id === dullBladeId);
    expect(weapon.assignedTo).toBe('Traveler Geo');
    expect(weapon.level).toBe(20);

    // When Traveler weapon is updated
    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [
        { weaponName: 'Dull Blade', level: 60, ascension: 3, refinement: 1, location: 'Traveler Geo' },
      ],
      materials: {},
    });

    state = useStore.getState();
    expect(state.roster['Traveler Geo'].equippedWeaponId).toBeNull();
    const updatedWeapon = state.trackedWeapons.find(w => w.id === dullBladeId);
    expect(updatedWeapon.assignedTo).toBe('Traveler Geo');
    expect(updatedWeapon.level).toBe(60);
  });

  // Section 27: Explicit high-level regression named clearly
  it('materials-only GOOD import does not delete existing roster or weapons', () => {
    useStore.getState().addCharacter('Kamisato Ayaka');
    useStore.getState().addCharacter('Kaeya');
    useStore.getState().addCharacter('Jean');

    useStore.getState().addTrackedWeapon('Amenoma Kageuchi', 'Kamisato Ayaka');
    useStore.getState().addTrackedWeapon('Favonius Sword', 'Kaeya');
    useStore.getState().addTrackedWeapon('Mistsplitter Reforged', null);

    useStore.getState().setInventory('Mora', 12345);
    useStore.getState().setInventory('Crown', 5);

    const snapshotBefore = {
      roster: JSON.parse(JSON.stringify(useStore.getState().roster)),
      trackedWeapons: JSON.parse(JSON.stringify(useStore.getState().trackedWeapons)),
    };

    // User deselects all characters and weapons in modal, imports only materials
    useStore.getState().importGoodData({
      format: 'GOOD',
      characters: [],
      weapons: [],
      materials: {
        'Mora': 999999,
      },
    });

    const stateAfter = useStore.getState();

    // Roster and weapons must be deep-equivalent
    expect(stateAfter.roster).toEqual(snapshotBefore.roster);
    expect(stateAfter.trackedWeapons).toEqual(snapshotBefore.trackedWeapons);

    // Inventory updated only for selected material
    expect(stateAfter.inventory['Mora']).toBe(999999);
    expect(stateAfter.inventory['Crown']).toBe(5);
  });
});
