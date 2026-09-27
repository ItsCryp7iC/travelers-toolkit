import { useState, useEffect, useCallback } from 'react';

const INITIAL_STAGED_STATE = {
  "characters.json": [],
  "weapons.json": [],
  "normal_boss.json": [],
  "local_specialty.json": [],
  "weekly_boss.json": [],
  "talent_materials.json": [],
  "weapon_ascension.json": [],
  "common_enemy.json": [],
  "elite_enemy.json": [],
};

export function useBuilderStaging() {
  const [stagedUpdates, setStagedUpdates] = useState(() => {
    const saved = localStorage.getItem('devBuilder_stagedUpdates');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_STAGED_STATE, ...parsed };
      } catch (e) {
        console.error("Failed to parse stagedUpdates from localStorage", e);
      }
    }
    return INITIAL_STAGED_STATE;
  });

  useEffect(() => {
    localStorage.setItem('devBuilder_stagedUpdates', JSON.stringify(stagedUpdates));
  }, [stagedUpdates]);

  const handleClearStaging = useCallback(() => {
    setStagedUpdates({ ...INITIAL_STAGED_STATE });
    localStorage.removeItem('devBuilder_stagedUpdates');
  }, []);

  return {
    stagedUpdates,
    setStagedUpdates,
    handleClearStaging
  };
}
