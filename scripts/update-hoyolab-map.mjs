import https from 'https';
import zlib from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SOURCE_REPO = 'theBowja/genshin-db-dist';
export const SOURCE_REVISION = '371c228cabc9e182995919e595d67409823a0bbe';
const BASE_URL = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_REVISION}`;
const CHARACTERS_URL = `${BASE_URL}/data/gzips/english-characters.min.json.gzip`;
const WEAPONS_URL = `${BASE_URL}/data/gzips/english-weapons.min.json.gzip`;

const OUTPUT_FILE = path.join(__dirname, '../src/data/hoyolabMap.json');

async function fetchGzipJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const gunzip = zlib.gunzipSync(buf);
        resolve(JSON.parse(gunzip.toString('utf8')));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

const normalizeName = (name) => name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

async function main() {
  const isCheck = process.argv.includes('--check');

  const [charsRaw, weaponsRaw] = await Promise.all([
    fetchGzipJson(CHARACTERS_URL),
    fetchGzipJson(WEAPONS_URL)
  ]);

  const dbChars = charsRaw.data.English.characters;
  const dbWeapons = weaponsRaw.data.English.weapons;

  // Load Toolkit data
  const toolkitChars = JSON.parse(await fs.readFile(path.join(__dirname, '../src/data/characters.json'), 'utf8'));
  const toolkitTravelers = JSON.parse(await fs.readFile(path.join(__dirname, '../src/data/traveler.json'), 'utf8'));
  const toolkitWeapons = JSON.parse(await fs.readFile(path.join(__dirname, '../src/data/weapons.json'), 'utf8'));

  const charNameToId = new Map();
  for (const tc of toolkitChars) {
    charNameToId.set(normalizeName(tc.name), tc.id);
  }

  const weaponNameToId = new Map();
  for (const tw of toolkitWeapons) {
    weaponNameToId.set(normalizeName(tw.name), tw.id);
  }

  const result = {
    characters: {},
    weapons: {}
  };

  for (const [key, dbChar] of Object.entries(dbChars)) {
    if (!dbChar.id || !dbChar.name) continue;

    // Traveler is handled specially by the map function, we just need to map the ID 10000005 to "Traveler"
    if (dbChar.id === 10000005 || dbChar.id === 10000007) {
      result.characters[dbChar.id.toString()] = "Traveler";
      continue;
    }

    const norm = normalizeName(dbChar.name);
    if (charNameToId.has(norm)) {
      result.characters[dbChar.id.toString()] = charNameToId.get(norm);
    }
  }

  for (const [key, dbWep] of Object.entries(dbWeapons)) {
    if (!dbWep.id || !dbWep.name) continue;

    const norm = normalizeName(dbWep.name);
    if (weaponNameToId.has(norm)) {
      result.weapons[dbWep.id.toString()] = weaponNameToId.get(norm);
    }
  }

  const outStr = JSON.stringify(result, null, 2) + '\n';

  if (isCheck) {
    try {
      const existing = await fs.readFile(OUTPUT_FILE, 'utf8');
      if (existing !== outStr) {
        console.error('Data is out of date. Run script without --check.');
        process.exit(1);
      }
      console.log('Data is up to date.');
    } catch (e) {
      console.error('File missing or out of date.');
      process.exit(1);
    }
  } else {
    await fs.writeFile(OUTPUT_FILE, outStr);
    console.log(`Generated map at ${OUTPUT_FILE}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
