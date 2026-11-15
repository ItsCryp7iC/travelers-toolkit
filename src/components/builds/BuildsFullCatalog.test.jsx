import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WeaponRecommendations from './WeaponRecommendations';
import ArtifactRecommendations from './ArtifactRecommendations';
import ArtifactStatPriorities from './ArtifactStatPriorities';
import TalentPriorities from './TalentPriorities';
import BuildEditorialNotes from './BuildEditorialNotes';
import rawBuildsCatalog from '../../data/builds.json';

describe('Area 25: Full Catalog 184 Role Builds Rendering Verification', () => {
  it(
    'renders recommendation components for all 184 role builds without throwing any exceptions',
    () => {
      let totalRolesTested = 0;
      const errors = [];

      for (const character of rawBuildsCatalog.characters) {
        for (const role of character.roles) {
          totalRolesTested++;

          try {
            const { unmount: unmountWp } = render(
              <WeaponRecommendations
                weapons={role.weapons}
                weaponType={character.weaponType}
              />,
            );
            unmountWp();

            const { unmount: unmountArt } = render(
              <ArtifactRecommendations artifacts={role.artifacts} />,
            );
            unmountArt();

            const { unmount: unmountStats } = render(
              <ArtifactStatPriorities artifacts={role.artifacts} />,
            );
            unmountStats();

            const { unmount: unmountTalents } = render(
              <TalentPriorities talents={role.talents} />,
            );
            unmountTalents();

            const { unmount: unmountNotes } = render(
              <BuildEditorialNotes
                notes={role.notes}
                gameplayTips={role.gameplayTips}
                calculationCredits={role.calculationCredits}
                guideRoleUrl={role.guideUrl}
              />,
            );
            unmountNotes();
          } catch (err) {
            errors.push({
              character: character.characterName,
              role: role.displayName,
              error: err.message,
            });
          }
        }
      }

      expect(errors).toHaveLength(0);
      expect(totalRolesTested).toBe(184);
      expect(rawBuildsCatalog.characters).toHaveLength(129);
    },
    60_000,
  );
});
