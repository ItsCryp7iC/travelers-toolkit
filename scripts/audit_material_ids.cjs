/**
 * audit_material_ids.cjs — One-time audit script
 *
 * Loads weapons.json and all material reference files, then checks every
 * weapon's material family IDs resolve to a real entry via direct ID match.
 *
 * Usage:  node scripts/audit_material_ids.cjs
 */

const path = require('path');

const weapons = require(path.resolve(__dirname, '../src/data/weapons.json'));
const weaponAscension = require(path.resolve(__dirname, '../src/data/weapon_ascension.json'));
const commonEnemy = require(path.resolve(__dirname, '../src/data/common_enemy.json'));
const eliteEnemy = require(path.resolve(__dirname, '../src/data/elite_enemy.json'));

// Build lookup sets
const ascIds = new Set(weaponAscension.map(x => x.id));
const commonIds = new Set(commonEnemy.map(x => x.id));
const eliteIds = new Set(eliteEnemy.map(x => x.id));
const allEnemyIds = new Set([...commonIds, ...eliteIds]);

let totalMismatches = 0;

console.log('=== Weapon Material ID Audit ===\n');

// --- Ascension material family ---
console.log('--- ascension_material_family_id ---');
const ascMismatches = [];
weapons.forEach(w => {
  const id = w.materials?.ascension_material_family_id;
  if (id && !ascIds.has(id)) {
    ascMismatches.push({ weapon: w.name, badId: id });
  }
});
if (ascMismatches.length) {
  const grouped = {};
  ascMismatches.forEach(m => {
    if (!grouped[m.badId]) grouped[m.badId] = [];
    grouped[m.badId].push(m.weapon);
  });
  Object.entries(grouped).forEach(([badId, weaponNames]) => {
    console.log(`  MISMATCH: "${badId}" (used by ${weaponNames.length} weapons, e.g. ${weaponNames.slice(0, 3).join(', ')})`);
    totalMismatches++;
  });
} else {
  console.log('  All OK');
}

// --- Enhancement material family (elite enemies) ---
console.log('\n--- enhancement_material_family_id ---');
const enhMismatches = [];
weapons.forEach(w => {
  const id = w.materials?.enhancement_material_family_id;
  if (id && !eliteIds.has(id)) {
    enhMismatches.push({ weapon: w.name, badId: id });
  }
});
if (enhMismatches.length) {
  const grouped = {};
  enhMismatches.forEach(m => {
    if (!grouped[m.badId]) grouped[m.badId] = [];
    grouped[m.badId].push(m.weapon);
  });
  Object.entries(grouped).forEach(([badId, weaponNames]) => {
    console.log(`  MISMATCH: "${badId}" (used by ${weaponNames.length} weapons, e.g. ${weaponNames.slice(0, 3).join(', ')})`);
    totalMismatches++;
  });
} else {
  console.log('  All OK');
}

// --- Enemy material family (common OR elite enemies) ---
console.log('\n--- enemy_material_family_id ---');
const enemyMismatches = [];
weapons.forEach(w => {
  const id = w.materials?.enemy_material_family_id;
  if (id && !allEnemyIds.has(id)) {
    enemyMismatches.push({ weapon: w.name, badId: id });
  }
});
if (enemyMismatches.length) {
  const grouped = {};
  enemyMismatches.forEach(m => {
    if (!grouped[m.badId]) grouped[m.badId] = [];
    grouped[m.badId].push(m.weapon);
  });
  Object.entries(grouped).forEach(([badId, weaponNames]) => {
    console.log(`  MISMATCH: "${badId}" (used by ${weaponNames.length} weapons, e.g. ${weaponNames.slice(0, 3).join(', ')})`);
    totalMismatches++;
  });
} else {
  console.log('  All OK');
}

console.log(`\n=== Total unique mismatched IDs: ${totalMismatches} ===`);

if (totalMismatches > 0) {
  process.exit(1);
} else {
  console.log('✓ All weapon material family IDs resolve directly.');
  process.exit(0);
}
