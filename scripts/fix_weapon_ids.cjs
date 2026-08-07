/**
 * fix_weapon_ids.cjs — One-time script to fix material family IDs in weapons.json
 *
 * Applies the corrections identified by the audit:
 *   14 ascension_material_family_id mismatches
 *   2 enemy_material_family_id mismatches (fatui, fungi)
 *   1 field swap on Nocturne's Curtain Call
 *
 * Usage:  node scripts/fix_weapon_ids.cjs
 */

const fs = require('fs');
const path = require('path');

const weaponsPath = path.resolve(__dirname, '../src/data/weapons.json');
const weapons = JSON.parse(fs.readFileSync(weaponsPath, 'utf-8'));

// Ascension material corrections: old (wrong) -> new (correct, matches weapon_ascension.json)
const ASC_FIXES = {
  decarabian: 'decarabiantiles',
  borealwolf: 'borealwolfteeth',
  dandeliongladiator: 'gladiatorshackles',
  guyun: 'guyunpillar',
  mistveiled: 'elixir',
  distantsea: 'branchesofadistantsea',
  mask: 'onimask',
  narukami: 'narukamismagatama',
  puresacreddewdrop: 'sacreddewdrops',
  ancientchord: 'ancientchords',
  blazingsacrificialheart: 'blazingsacrificialhearts',
  sacredlord: 'deliriousmasksofthesacredlord',
  scorchingmight: 'scorchingmights',
  nightwind: 'nightwindsmystics',
};

// Enemy material corrections: old (wrong) -> new (correct, matches common_enemy.json)
const ENEMY_FIXES = {
  fatui: 'fatuiskirmisher',
  fungi: 'fungus',
};

let ascFixed = 0;
let enemyFixed = 0;
let swapFixed = 0;

weapons.forEach(w => {
  if (!w.materials) return;

  // Fix ascension IDs
  const asc = w.materials.ascension_material_family_id;
  if (asc && ASC_FIXES[asc]) {
    w.materials.ascension_material_family_id = ASC_FIXES[asc];
    ascFixed++;
  }

  // Fix enemy IDs
  const enemy = w.materials.enemy_material_family_id;
  if (enemy && ENEMY_FIXES[enemy]) {
    w.materials.enemy_material_family_id = ENEMY_FIXES[enemy];
    enemyFixed++;
  }

  // Fix Nocturne's Curtain Call field swap
  // enhancement should be elite (fisherofhiddendepths), enemy should be common (fatuioprichniki)
  if (w.id === 'nocturnescurtaincall') {
    if (w.materials.enhancement_material_family_id === 'fatuioprichniki' &&
        w.materials.enemy_material_family_id === 'fisherofhiddendepths') {
      w.materials.enhancement_material_family_id = 'fisherofhiddendepths';
      w.materials.enemy_material_family_id = 'fatuioprichniki';
      swapFixed++;
      console.log(`  SWAP FIX: ${w.name} — swapped enhancement/enemy fields`);
    }
  }
});

// Write back with same formatting (2-space indent)
fs.writeFileSync(weaponsPath, JSON.stringify(weapons, null, 2) + '\n', 'utf-8');

console.log(`\nDone. Fixed ${ascFixed} ascension IDs, ${enemyFixed} enemy IDs, ${swapFixed} field swaps.`);
