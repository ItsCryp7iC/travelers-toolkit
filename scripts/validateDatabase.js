import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../src/data');

// Load JSON files
const loadJson = (filename) => {
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const characters = loadJson('characters.json');
const bossMaterials = loadJson('boss_materials.json');
const talentMaterials = loadJson('talent_materials.json');
const enemyMaterials = loadJson('enemy_materials.json');
const localSpecialty = loadJson('local_specialty.json');

// Build sets of valid IDs
const validWorldBossIds = bossMaterials
  .filter(b => b.type === 'normal_boss')
  .map(b => b.id);
const validWeeklyBossIds = bossMaterials
  .filter(b => b.type === 'weekly_boss')
  .map(b => b.id);
const validTalentIds = talentMaterials.map(t => t.id);
const validEnemyIds = enemyMaterials.map(e => e.id);
const validLocalIds = localSpecialty.map(l => l.id);

// Levenshtein distance function
const levenshtein = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const findClosestId = (id, validIds) => {
  if (!id || id === 'nan') return null;
  let minDistance = Infinity;
  let closestId = null;

  for (const validId of validIds) {
    const dist = levenshtein(id, validId);
    if (dist < minDistance) {
      minDistance = dist;
      closestId = validId;
    }
  }

  // Double check simple substring matching if distance is somewhat high
  for (const validId of validIds) {
    if (validId.includes(id) || id.includes(validId)) {
      const dist = Math.abs(validId.length - id.length);
      if (dist < minDistance) {
        minDistance = dist;
        closestId = validId;
      }
    }
  }

  return closestId;
};

let changesCount = 0;

characters.forEach(char => {
  if (!char.materials) return;

  const validateField = (field, validIds, fieldName) => {
    const currentId = char.materials[field];
    if (currentId && currentId !== 'nan' && !validIds.includes(currentId)) {
      const closestId = findClosestId(currentId, validIds);
      if (closestId) {
        console.log(`[${char.name}] ${fieldName} mismatch: "${currentId}" -> Corrected to "${closestId}"`);
        char.materials[field] = closestId;
        changesCount++;
      } else {
        console.warn(`[${char.name}] ${fieldName} mismatch: "${currentId}" -> No valid replacement found.`);
      }
    }
  };

  validateField('world_boss_material_id', validWorldBossIds, 'World Boss');
  validateField('weekly_boss_material_id', validWeeklyBossIds, 'Weekly Boss');
  validateField('talent_material_family_id', validTalentIds, 'Talent Material');
  validateField('enemy_material_family_id', validEnemyIds, 'Enemy Material');
  validateField('local_specialty_id', validLocalIds, 'Local Specialty');
});

if (changesCount > 0) {
  const outputPath = path.join(dataDir, 'characters.json');
  fs.writeFileSync(outputPath, JSON.stringify(characters, null, 2));
  console.log(`\nSuccessfully applied ${changesCount} fixes to characters.json.`);
} else {
  console.log('\nNo mismatches found. Database is perfectly aligned.');
}
