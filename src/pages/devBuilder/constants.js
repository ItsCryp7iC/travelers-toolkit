export const ELEMENTS = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo'];
export const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Catalyst', 'Bow'];
export const REGIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai', 'Snezhnaya'];

export const getGemFamily = (element) => {
  const gems = {
    Anemo: "VayudaTurquoise", Cryo: "ShivadaJade",
    Electro: "VajradaAmethyst", Geo: "PrithivaTopaz",
    Hydro: "VarunadaLazulite", Pyro: "AgnidusAgate",
    Dendro: "NagadusEmerald"
  }
  return gems[element] || ""
};

export const MATERIAL_CATEGORIES = [
  { value: 'Local Specialty', label: '🌿 Local Specialty' },
  { value: 'Normal Boss Material', label: '🐲 Normal Boss' },
  { value: 'Weekly Boss Material', label: '👑 Weekly Boss' },
  { value: 'Talent Material', label: '📚 Talent Book' },
  { value: 'Common Enhancement Material', label: '💧 Common Drop' },
  { value: 'Elite Enhancement Material', label: '🏵️ Elite Drop' },
  { value: 'Weapon Ascension Material', label: '🔮 Weapon Ascension' },
  { value: 'Character Ascension Gem', label: '💎 Ascension Gem' },
  { value: 'Ores', label: '⛏️ Ores / EXP' },
  { value: 'Currency', label: '🪙 Currency' },
];

export const DEFAULT_CHAR = {
  name: '', rarity: 5, weapon_type: 'Sword', element: 'Pyro',
  materials: {
    world_boss_material_id: '', weekly_boss_material_id: '',
    talent_material_family_id: '', enemy_material_family_id: '',
    local_specialty_id: '', gem_family_id: 'AgnidusAgate'
  },
};

export const DEFAULT_WEAPON = {
  name: '', rarity: 5, type: 'Sword',
  materials: { ascension_material_family_id: '', enhancement_material_family_id: '', enemy_material_family_id: '' },
};

export const MAT_SUB_CATEGORIES = [
  { key: 'normal_boss', label: '🐲 Normal Boss' },
  { key: 'local_spec', label: '🌿 Local Specialty' },
  { key: 'weekly_boss', label: '👑 Weekly Boss' },
  { key: 'talent', label: '📚 Talent Material' },
  { key: 'weapon_asc', label: '🔮 Weapon Asc' },
  { key: 'common_drop', label: '💧 Common Enemy Drop' },
  { key: 'elite_drop', label: '🏵️ Elite Enemy Drop' },
];

export const MAT_DEFAULTS = {
  normal_boss: { name: '', bossName: '', region: REGIONS[REGIONS.length - 1] },
  local_spec: { name: '', region: REGIONS[REGIONS.length - 1] },
  weekly_boss: { bossName: '', region: REGIONS[REGIONS.length - 1], mat1: '', mat2: '', mat3: '' },
  talent: { series1: '', series2: '', series3: '', domain: '', region: REGIONS[REGIONS.length - 1] },
  weapon_asc: {
    series1Name: '', s1_5: '', s1_4: '', s1_3: '', s1_2: '',
    series2Name: '', s2_5: '', s2_4: '', s2_3: '', s2_2: '',
    series3Name: '', s3_5: '', s3_4: '', s3_3: '', s3_2: '',
    domain: '', region: REGIONS[REGIONS.length - 1]
  },
  common_drop: { groupName: '', star1: '', star2: '', star3: '' },
  elite_drop: { groupName: '', star2: '', star3: '', star4: '' },
};

export const FILE_MAP = {
  character: 'characters.json',
  weapon: 'weapons.json',
  normal_boss: 'normal_boss.json',
  local_spec: 'local_specialty.json',
  weekly_boss: 'weekly_boss.json',
  talent: 'talent_materials.json',
  weapon_asc: 'weapon_ascension.json',
  common_drop: 'common_enemy.json',
  elite_drop: 'elite_enemy.json',
};

export const WEAPON_TYPE_MAP = { Sword: 1, Claymore: 2, Polearm: 3, Catalyst: 4, Bow: 5 };
