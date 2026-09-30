import https from 'https';
import zlib from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SOURCE_REPO = 'theBowja/genshin-db-dist';
export const SOURCE_REVISION = '371c228cabc9e182995919e595d67409823a0bbe';
export const METADATA_REPO = 'theBowja/genshin-db';
export const METADATA_REVISION = 'fab708f16795231fde199f39ecfb6ffb9eeb0b4e';
export const GAME_VERSION = '7.1';
export const GENSHIN_DB_VERSION = '5.2.14';

const BASE_URL = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_REVISION}`;
const GROUPS_URL = `${BASE_URL}/data/gzips/english-achievementgroups.min.json.gzip`;
const ACHIEVEMENTS_URL = `${BASE_URL}/data/gzips/english-achievements.min.json.gzip`;

const META_BASE_URL = `https://raw.githubusercontent.com/${METADATA_REPO}/${METADATA_REVISION}`;
const VERSION_URL = `${META_BASE_URL}/src/data/version/achievements.json`;

const OUTPUT_DIR = path.join(__dirname, '../src/data/achievements');

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchGzipBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseGzipJson(buffer) {
  const gunzip = zlib.gunzipSync(buffer);
  return JSON.parse(gunzip.toString('utf8'));
}

export function normalizeCategories(rawGroups) {
  let groupsDict = rawGroups.data.English;
  if (groupsDict.achievementgroups) groupsDict = groupsDict.achievementgroups;
  
  const categories = Object.values(groupsDict).map(g => {
    if (g.id === undefined || !g.name) {
      throw new Error(`Invalid category object: ${JSON.stringify(g)}`);
    }
    return {
      id: g.id.toString(),
      name: g.name,
      order: g.sortOrder,
      icon: g.icon || null
    };
  });
  
  categories.sort((a, b) => a.order - b.order);
  return categories;
}

export function normalizeAchievements(rawAchievements, versionDict, stats = {}) {
  let achDict = rawAchievements.data.English;
  if (achDict.achievements) achDict = achDict.achievements;
  
  const canonicalVersionMap = new Map();
  for (const [stringKey, version] of Object.entries(versionDict || {})) {
    const rawData = achDict[stringKey];
    if (!rawData) {
      throw new Error(`Version metadata contains unknown string key: ${stringKey}`);
    }
    for (const canonicalId of rawData.id) {
      if (canonicalVersionMap.has(canonicalId)) {
        throw new Error(`Duplicate canonical ID in version metadata: ${canonicalId}`);
      }
      canonicalVersionMap.set(canonicalId, version);
    }
  }

  const achievements = [];
  stats.sourceObjects = 0;
  stats.scalarSourceObjects = 0;
  stats.multiStageSourceObjects = 0;
  stats.multiStageCanonicalRecords = 0;
  stats.canonicalRecords = 0;

  for (const key of Object.keys(achDict).sort()) {
    const raw = achDict[key];
    stats.sourceObjects++;
    if (!raw.id || !Array.isArray(raw.id)) throw new Error(`Invalid id array for ${raw.name}`);
    if (raw.stages !== raw.id.length) throw new Error(`Stage count mismatch for ${raw.name}`);
    
    if (raw.id.length === 1) stats.scalarSourceObjects++;
    else stats.multiStageSourceObjects++;
    
    for (let i = 0; i < raw.stages; i++) {
      const stageKey = `stage${i + 1}`;
      const stageData = raw[stageKey];
      if (!stageData) throw new Error(`Missing stage ${stageKey} for ${raw.name}`);
      
      let primogems = 0;
      if (stageData.reward) {
        if (stageData.reward.id !== 201) throw new Error(`Unexpected reward item ${stageData.reward.id} in ${raw.name}`);
        primogems = stageData.reward.count;
        if (![5, 10, 20].includes(primogems)) throw new Error(`Unexpected primogem count ${primogems} in ${raw.name}`);
      } else {
        throw new Error(`Missing reward for ${raw.name} stage ${i+1}`);
      }
      
      const canonicalId = raw.id[i].toString();
      let version = canonicalVersionMap.get(raw.id[i]);
      if (version === undefined) version = null; // null policy

      achievements.push({
        id: canonicalId,
        categoryId: raw.achievementGroupId.toString(),
        name: stageData.title || raw.name,
        description: stageData.description || "",
        primogems,
        hidden: raw.isHidden === true,
        version: version,
        order: raw.sortOrder
      });
      
      stats.canonicalRecords++;
      if (raw.id.length > 1) stats.multiStageCanonicalRecords++;
    }
  }
  
  achievements.sort((a, b) => {
    if (a.categoryId !== b.categoryId) return parseInt(a.categoryId) - parseInt(b.categoryId);
    if (a.order !== b.order) return a.order - b.order;
    return parseInt(a.id) - parseInt(b.id);
  });
  
  return achievements;
}

export function validateDataset(categories, achievements) {
  if (categories.length !== 73) throw new Error(`Category count mismatch: expected 73, got ${categories.length}`);
  const catIds = new Set(categories.map(c => c.id));
  if (catIds.size !== categories.length) throw new Error('Duplicate category IDs');
  if (!catIds.has("0")) throw new Error('Missing ID 0 in categories');
  
  const achIds = new Set(achievements.map(a => a.id));
  if (achIds.size !== achievements.length) throw new Error('Duplicate achievement IDs');
  
  for (const a of achievements) {
    if (!catIds.has(a.categoryId)) throw new Error(`Invalid category ID ${a.categoryId} on achievement ${a.id}`);
    if (!a.name) throw new Error(`Empty name on achievement ${a.id}`);
    if (typeof a.primogems !== 'number' || a.primogems < 0) throw new Error(`Invalid primogems on achievement ${a.id}`);
  }
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function runGenerator(isCheck = false) {
  console.log(`Fetching pinned sources...`);
  
  const [groupsBuf, achBuf, versionDict] = await Promise.all([
    fetchGzipBuffer(GROUPS_URL),
    fetchGzipBuffer(ACHIEVEMENTS_URL),
    fetchJson(VERSION_URL)
  ]);
  
  const rawGroups = parseGzipJson(groupsBuf);
  const rawAchievements = parseGzipJson(achBuf);
  
  const categories = normalizeCategories(rawGroups);
  const stats = {};
  const achievements = normalizeAchievements(rawAchievements, versionDict, stats);
  
  validateDataset(categories, achievements);
  
  const catJson = JSON.stringify(categories, null, 2) + '\n';
  const achJson = JSON.stringify(achievements, null, 2) + '\n';
  
  const manifest = {
    schemaVersion: 1,
    gameVersion: GAME_VERSION,
    source: {
      definitions: {
        repository: SOURCE_REPO,
        revision: SOURCE_REVISION,
        genshinDbVersion: GENSHIN_DB_VERSION,
        artifacts: {
          groups: {
            path: 'data/gzips/english-achievementgroups.min.json.gzip',
            sha256: sha256(groupsBuf)
          },
          achievements: {
            path: 'data/gzips/english-achievements.min.json.gzip',
            sha256: sha256(achBuf)
          }
        }
      },
      metadata: {
        repository: METADATA_REPO,
        revision: METADATA_REVISION,
        artifacts: {
          versions: {
            path: 'src/data/version/achievements.json',
            sha256: sha256(JSON.stringify(versionDict))
          }
        }
      }
    },
    artifacts: {
      categories: {
        count: categories.length,
        sha256: sha256(catJson)
      },
      achievements: {
        count: achievements.length,
        sha256: sha256(achJson)
      }
    }
  };
  const manJson = JSON.stringify(manifest, null, 2) + '\n';
  
  if (isCheck) {
    try {
      const diskCat = await fs.readFile(path.join(OUTPUT_DIR, 'categories.json'), 'utf8');
      const diskAch = await fs.readFile(path.join(OUTPUT_DIR, 'achievements.json'), 'utf8');
      const diskMan = await fs.readFile(path.join(OUTPUT_DIR, 'manifest.json'), 'utf8');
      
      if (diskCat !== catJson || diskAch !== achJson || diskMan !== manJson) {
        console.error('Data drift detected! Generated data does not match on-disk data.');
        process.exit(1);
      } else {
        console.log('Check passed. Data is up to date.');
      }
    } catch (e) {
      console.error('Failed to read on-disk data for --check:', e.message);
      process.exit(1);
    }
  } else {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUTPUT_DIR, 'categories.json'), catJson);
    await fs.writeFile(path.join(OUTPUT_DIR, 'achievements.json'), achJson);
    await fs.writeFile(path.join(OUTPUT_DIR, 'manifest.json'), manJson);
    
    const hiddenCount = achievements.filter(a => a.hidden).length;
    const versionCount = achievements.filter(a => a.version !== null).length;
    
    console.log('--- Generation Snapshot ---');
    console.log(`Source Definitions: ${SOURCE_REPO} @ ${SOURCE_REVISION}`);
    console.log(`Source Metadata: ${METADATA_REPO} @ ${METADATA_REVISION}`);
    console.log(`Game version: ${GAME_VERSION}`);
    console.log(`Categories: ${categories.length}`);
    console.log(`Achievements Canonical: ${achievements.length}`);
    console.log(`Achievements Source Objects: ${stats.sourceObjects}`);
    console.log(`  - Scalar objects: ${stats.scalarSourceObjects}`);
    console.log(`  - Multi-stage objects: ${stats.multiStageSourceObjects}`);
    console.log(`  - Multi-stage unrolled records: ${stats.multiStageCanonicalRecords}`);
    console.log(`Versions mapped: ${versionCount} (Null: ${achievements.length - versionCount})`);
    console.log(`Hidden: ${hiddenCount}`);
    console.log(`Visible: ${achievements.length - hiddenCount}`);
    console.log(`Output categories hash: ${manifest.artifacts.categories.sha256}`);
    console.log(`Output achievements hash: ${manifest.artifacts.achievements.sha256}`);
    console.log('Generated successfully.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isCheck = process.argv.includes('--check');
  runGenerator(isCheck).catch(e => {
    console.error('Generation failed:', e);
    process.exit(1);
  });
}
