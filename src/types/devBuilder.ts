/**
 * Modes available in the DevBuilder tool.
 */
export type DevBuilderMode = 'material' | 'character' | 'weapon';

/**
 * MaterialSubcategory maps to the explicit form types handled by the DevBuilder for materials.
 */
export type MaterialSubcategory =
  | 'normal_boss'
  | 'local_spec'
  | 'weekly_boss'
  | 'talent'
  | 'weapon_asc'
  | 'common_drop'
  | 'elite_drop';

/**
 * CharacterBuilderInput represents the draft fields within the DevBuilder Character form.
 */
export interface CharacterBuilderInput {
  name: string;
  rarity: number;
  weapon_type: string;
  element: string;
  materials: {
    world_boss_material_id: string;
    weekly_boss_material_id: string;
    talent_material_family_id: string;
    enemy_material_family_id: string;
    local_specialty_id: string;
    gem_family_id: string;
  };
}

/**
 * WeaponBuilderInput represents the draft fields within the DevBuilder Weapon form.
 */
export interface WeaponBuilderInput {
  name: string;
  rarity: number;
  type: string;
  materials: {
    ascension_material_family_id: string;
    enhancement_material_family_id: string;
    enemy_material_family_id: string;
  };
}

/**
 * MaterialBuilderInput represents the variants of material payload draft fields.
 * Currently represented dynamically using a Record.
 */
export type MaterialBuilderInput = Record<string, string>;

/**
 * StagedUpdates represents the pending JSON file alterations waiting in localStorage.
 */
export interface StagedUpdates {
  'characters.json': unknown[];
  'weapons.json': unknown[];
  'normal_boss.json': unknown[];
  'local_specialty.json': unknown[];
  'weekly_boss.json': unknown[];
  'talent_materials.json': unknown[];
  'weapon_ascension.json': unknown[];
  'common_enemy.json': unknown[];
  'elite_enemy.json': unknown[];
}
