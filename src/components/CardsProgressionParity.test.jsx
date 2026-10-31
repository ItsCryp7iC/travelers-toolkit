import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import CharacterCard from './CharacterCard';
import WeaponCard from './WeaponCard';
import useStore from '../store/useStore';

describe('Cards Progression Parity (C1B)', () => {
  const dummyJean = {
    name: 'Jean',
    element: 'Anemo',
    weapon_type: 'Sword',
    rarity: '5★',
    materials: {
      gem_family_id: 'VayudaTurquoise',
      world_boss_material_id: 'HurricaneSeed',
      local_specialty_id: 'DandelionSeed',
      enemy_material_family_id: 'HilichurlMask',
      talent_material_family_id: 'Resistance',
      weekly_boss_material_id: 'DvalinsPlume',
    },
  };

  const dummyAquila = {
    name: 'Aquila Favonia',
    type: 'Sword',
    rarity: '5★',
    materials: {
      ascension_material_family_id: 'Decarabian',
      elite_material_family_id: 'Horn',
      enemy_material_family_id: 'HilichurlArrowhead',
    },
  };

  beforeEach(() => {
    useStore.setState({
      roster: {
        Jean: {
          level: 80,
          targetLevel: 90,
          ascension: 6,
          targetAscension: 6,
          talents: { normal: 1, skill: 1, burst: 1 },
          targetTalents: { normal: 1, skill: 1, burst: 1 },
        },
      },
      trackedWeapons: [
        {
          id: 'aquila-1',
          weaponName: 'Aquila Favonia',
          level: 80,
          targetLevel: 90,
          ascension: 6,
          targetAscension: 6,
          refinement: 1,
          targetRefinement: 1,
        },
      ],
      inventory: {},
    });
  });

  it('CharacterCard calculates 0 boss materials for Level 80 A6 targeting Level 90 A6', () => {
    const { queryByAltText, getByText } = render(
      <CharacterCard character={dummyJean} />
    );

    // Hurricane Seed, Dandelion Seed, and Gemstone should NOT be required (0)
    expect(queryByAltText(/Hurricane Seed/i)).toBeNull();
    expect(queryByAltText(/Dandelion Seed/i)).toBeNull();
    expect(queryByAltText(/Vayuda Turquoise Gemstone/i)).toBeNull();

    // Level indicator should render 80 -> 90
    expect(getByText(/Lv\. 80/i)).not.toBeNull();
  });

  it('WeaponCard calculates 0 ascension materials for Level 80 A6 targeting Level 90 A6', () => {
    const armoryEntry = useStore.getState().trackedWeapons[0];
    const { queryByAltText, getByText } = render(
      <WeaponCard
        weapon={dummyAquila}
        inArmory={true}
        armoryEntry={armoryEntry}
        inventory={{}}
      />
    );

    // Ascension domain mats should not be rendered
    expect(queryByAltText(/Decarabian/i)).toBeNull();

    // Weapon title renders
    expect(getByText(/Aquila Favonia/i)).not.toBeNull();
  });
});
