export function generateNodeScript(stagedUpdates) {
  const stagedStr = JSON.stringify(stagedUpdates, null, 2);
  return `const fs = require('fs');
const path = require('path');

// Auto-generated payload
const stagedData = ${stagedStr};

Object.keys(stagedData).forEach(filename => {
  if (stagedData[filename].length === 0) return;
  const filePath = path.join(__dirname, 'src', 'data', filename);
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const currentData = JSON.parse(fileContent);
    currentData.push(...stagedData[filename]);

    if (currentData.length > 0) {
      const hasReleaseOrder = currentData.some(item => 'release_order' in item);
      const hasSortOrder = currentData.some(item => 'sortOrder' in item);

      if (hasReleaseOrder) {
        currentData.sort((a, b) => (parseFloat(a.release_order) || 99999) - (parseFloat(b.release_order) || 99999));
      } else if (hasSortOrder) {
        currentData.sort((a, b) => (parseFloat(a.sortOrder) || 99999) - (parseFloat(b.sortOrder) || 99999));
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));
    console.log(\`✅ Successfully updated \${filename}\`);
  } catch (err) {
    console.error(\`❌ Failed to update \${filename}:\`, err.message);
  }
});

// --- AUTOMATED IMAGE DOWNLOADER ---
// Logic moved to download_assets.cjs
`;
}

export function generateAssetScript(stagedUpdates) {
  const stagedStr = JSON.stringify(stagedUpdates, null, 2);
  return `const fs = require('fs');
const path = require('path');

// Auto-generated payload
const stagedData = ${stagedStr};

// --- AUTOMATED IMAGE DOWNLOADER ---
const baseDir = __dirname;

const DIR_MAP = {
  "normal_boss.json": "normal_boss_materials",
  "local_specialty.json": "local_specialties",
  "weekly_boss.json": "weekly_boss_materials",
  "talent_materials.json": "talent_materials",
  "weapon_ascension.json": "weapon_ascension_materials",
  "common_enemy.json": "common_enhancement_materials",
  "elite_enemy.json": "elite_enhancement_materials",
  "characters.json": "characters",
  "weapons.json": "weapons"
};

const formatWikiName = (name) => name.replace(/[\\u00AD\\u200B-\\u200D\\uFEFF]/g, '').replace(/[:]/g, '').replace(/ /g, '_');
const toPascalCase = (str) => str
  .replace(/[\\u00AD\\u200B-\\u200D\\uFEFF]/g, '')
  .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
  .replace(/[^a-zA-Z0-9]/g, '');

const itemsToDownload = [];
Object.entries(stagedData).forEach(([filename, items]) => {
  const folderName = DIR_MAP[filename] || "misc";
  let wikiType = 'item';
  if (filename === 'characters.json') wikiType = 'character';
  if (filename === 'weapons.json') wikiType = 'weapon';

  items.forEach(item => {
    if (item.name && !item.tiers) {
      itemsToDownload.push({ name: item.name, wikiType, folderName });
    }
    if (item.tiers) {
      Object.values(item.tiers).forEach(tier => {
        if (tier.name) itemsToDownload.push({ name: tier.name, wikiType, folderName });
      });
    }
  });
});

// Create unique folders based on what is in the queue
const uniqueFolders = [...new Set(itemsToDownload.map(i => i.folderName))];
uniqueFolders.forEach(folder => {
  const dirPath = path.join(baseDir, folder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

const downloadImage = async (wikiFileName, filepath) => {
  const apiUrl = \`https://genshin-impact.fandom.com/api.php?action=query&titles=File:\${wikiFileName}&prop=imageinfo&iiprop=url&format=json\`;
  const apiResponse = await fetch(apiUrl, { headers: { 'User-Agent': 'TravelersToolkit/1.0' } });
  const apiData = await apiResponse.json();
  const pages = apiData.query.pages;
  const pageId = Object.keys(pages)[0];

  if (pageId === "-1" || !pages[pageId].imageinfo) throw new Error("Not found on Wiki");

  const imgResponse = await fetch(pages[pageId].imageinfo[0].url, { headers: { 'User-Agent': 'TravelersToolkit/1.0' } });
  if (!imgResponse.ok) throw new Error(\`CDN status \${imgResponse.status}\`);

  const arrayBuffer = await imgResponse.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(arrayBuffer));
};

const runDownloads = async () => {
  console.log("\\n🚀 Starting Fandom Image Rip...");
  for (const item of itemsToDownload) {
    const finalId = toPascalCase(item.name);
    const savePath = path.join(baseDir, item.folderName, \`\${finalId}.png\`);

    // Skip if we already downloaded it previously
    if (fs.existsSync(savePath)) continue;

    let prefix = "Item_";
    if (item.wikiType === "character") prefix = "";
    if (item.wikiType === "weapon") prefix = "Weapon_";

    const suffix = item.wikiType === "character" ? "_Icon.png" : ".png";
    const wikiFileName = \`\${prefix}\${formatWikiName(item.name)}\${suffix}\`;

    try {
      process.stdout.write(\`Downloading: \${item.name} -> \${finalId}.png... \`);
      await downloadImage(wikiFileName, savePath);
      console.log(\`✅ Success!\`);
    } catch (err) {
      console.log(\`❌ \${err.message}\`);
    }
  }
  console.log("🎉 Asset Rip complete!");
};

runDownloads();`;
}
